#!/usr/bin/env node
// Screenshot Pixel Alpha pages at desktop and phone width on SAMPLE data, then
// open a gallery in the default browser. See SKILL.md beside this file.
//
//   node .claude/skills/screenshots/shots.mjs [route ...] [--role admin|user]
//        [--theme dark|light] [--only desktop|phone] [--url http://localhost:5191] [--no-open]
//
// Safety: every request to an /api/ path (any host — the dev build may point
// at the LIVE API) is answered here from fixtures.mjs, and any other request
// to pixel-alpha.com is aborted. Nothing this script does can reach prod.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN_USER, DEFAULT_ROUTES, TRADER_USER, answer } from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const TITLE_MARK = 'Pixel Alpha' // proves the server is THIS app (5173 is often another project)

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const valued = new Set(['--role', '--theme', '--only', '--url'])
const routes = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]))
const ROUTES = routes.length ? routes.map((r) => (r.startsWith('/') ? r : `/${r}`)) : DEFAULT_ROUTES
const USER = option('role', 'admin') === 'user' ? TRADER_USER : ADMIN_USER
const THEME = option('theme', 'dark')
const ONLY = option('only', null)
const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1366, height: 900 }, scale: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, scale: 2, mobile: true },
].filter((v) => !ONLY || v.name === ONLY)

// ---------------------------------------------------------------- playwright-core
let chromium
try {
  ;({ chromium } = await import('playwright-core'))
} catch {
  console.error('playwright-core is missing: run `npm install` in the repo root (it is a devDependency).')
  process.exit(1)
}

// Playwright's own bundled browser does not match its version on this box
// (blank screenshots), so drive an installed Chrome or Edge.
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return candidates.find((p) => p && existsSync(p))
}

// ---------------------------------------------------------------- dev server
function freePort(start) {
  return new Promise((resolvePort) => {
    const probe = createServer()
    probe.once('error', () => resolvePort(freePort(start + 1)))
    probe.once('listening', () => probe.close(() => resolvePort(start)))
    probe.listen(start, 'localhost')
  })
}

async function isThisApp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.ok && (await res.text()).includes(TITLE_MARK)
  } catch {
    return false
  }
}

async function startServer() {
  const given = option('url', null)
  if (given) {
    if (!(await isThisApp(given))) throw new Error(`${given} is not serving Pixel Alpha (title check failed).`)
    return { url: given.replace(/\/$/, ''), stop: () => {} }
  }
  const port = await freePort(5191)
  // One command string: shell + an args array is deprecated (DEP0190). `port` is a number we chose.
  const child = spawn(`npx vite --port ${port} --strictPort --host localhost`, {
    cwd: REPO, shell: true, stdio: 'ignore', windowsHide: true,
  })
  const url = `http://localhost:${port}`
  for (let i = 0; i < 60; i++) {
    if (await isThisApp(url)) break
    if (i === 59) throw new Error(`The dev server did not come up on ${url}.`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  const stop = () => {
    // npx/shell wrap the real server; kill the whole tree.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
  return { url, stop }
}

// ---------------------------------------------------------------- capture
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
const OUT = join(tmpdir(), 'pixel-alpha-shots', stamp)
mkdirSync(OUT, { recursive: true })

const unanswered = new Set()
const problems = []

async function capture(browser, base, route, vp) {
  const context = await browser.newContext({
    viewport: vp.viewport, deviceScaleFactor: vp.scale, isMobile: !!vp.mobile, hasTouch: !!vp.mobile,
    colorScheme: THEME,
  })
  await context.addInitScript(([user, theme]) => {
    localStorage.setItem('sinegu-token', 'sample-token')
    localStorage.setItem('sinegu-user', JSON.stringify(user))
    localStorage.setItem('sinegu-theme', theme)
    localStorage.setItem('pixel-alpha-consent', JSON.stringify({ v: 2, choice: 'essential', at: new Date().toISOString() }))
  }, [USER, THEME])

  await context.route((u) => u.hostname.endsWith('pixel-alpha.com') && !u.pathname.startsWith('/api/'), (r) => r.abort())
  await context.route((u) => u.pathname.startsWith('/api/'), async (r) => {
    const req = r.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')
    const body = answer(req.method(), path, USER, url.searchParams)
    if (body === null) return r.fulfill({ status: 204, body: '' })
    if (body === undefined) {
      unanswered.add(`${req.method()} ${path}`)
      // A write is never forwarded anywhere; it just "succeeds" here.
      return req.method() === 'GET'
        ? r.fulfill({ status: 404, contentType: 'application/json', body: '{"success":false}' })
        : r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`${route} (${vp.name}): ${e.message}`))
  await page.goto(base + route, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  // AOS hides below-the-fold cards until they are scrolled to.
  // Transitions off too: a color/outline caught mid-transition reads as a faded frame.
  await page.addStyleTag({ content: '[data-aos]{opacity:1!important;transform:none!important} *{transition:none!important}' })
  // The dev build's "LIVE PROD DATA" badge would label sample data as real.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div,span')) {
      if (el.textContent.trim() === 'LIVE PROD DATA' && getComputedStyle(el).position === 'fixed') el.style.display = 'none'
    }
  })
  await page.waitForTimeout(700)

  const landed = new URL(page.url()).pathname
  if (!route.startsWith(landed)) problems.push(`${route} (${vp.name}) redirected to ${landed}`)
  const file = `${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}-${vp.name}.png`
  await page.screenshot({ path: join(OUT, file), fullPage: true })
  await context.close()
  return file
}

function gallery(shots) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const groups = ROUTES.map((route) => {
    const imgs = shots.filter((s) => s.route === route)
      .map((s) => `<figure class="${s.vp}"><figcaption>${s.vp}</figcaption><a href="${s.file}" target="_blank"><img src="${s.file}" alt="${esc(route)} at ${s.vp} width" loading="lazy"></a></figure>`)
      .join('')
    return `<section><h2>${esc(route)}</h2><div class="row">${imgs}</div></section>`
  }).join('')
  const notes = [
    unanswered.size ? `<p><b>No sample data for:</b> ${[...unanswered].map(esc).join(', ')}. Add them to <code>fixtures.mjs</code>.</p>` : '',
    problems.length ? `<p><b>Problems:</b></p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '',
  ].join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pixel Alpha screenshots</title><style>
:root{color-scheme:dark}body{margin:0;padding:24px 16px 48px;background:#0b0d12;color:#e8e6e1;font:14px/1.5 system-ui,sans-serif}
header{max-width:1500px;margin:0 auto 20px}h1{font-size:20px;margin:0 0 4px}header p{margin:4px 0;color:#9a9284}
section{max-width:1500px;margin:0 auto 28px;padding:16px;border:1px solid #232733;border-radius:14px;background:#11141b}
h2{font:600 15px ui-monospace,monospace;margin:0 0 12px;color:#d9b45a}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0}figure.desktop{flex:1 1 640px;min-width:0}figure.phone{flex:0 0 280px}figcaption{color:#9a9284;font-size:12px;margin-bottom:6px}
img{display:block;width:100%;border:1px solid #232733;border-radius:10px}code{color:#d9b45a}
</style></head><body><header><h1>Pixel Alpha screenshots</h1>
<p>${shots.length} captures · ${esc(USER.type)} view · ${esc(THEME)} theme · ${esc(new Date().toLocaleString())}</p>
<p>Sample data only: every API answer came from <code>.claude/skills/screenshots/fixtures.mjs</code>; nothing reached the live site. Click an image for full size.</p>${notes}
</header>${groups}</body></html>`
}

function openInBrowser(file) {
  const [cmd, args] = process.platform === 'win32' ? ['explorer.exe', [file]]
    : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]]
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

const executablePath = findBrowser()
if (!executablePath) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.')
  process.exit(1)
}

const server = await startServer()
const shots = []
try {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        shots.push({ route, vp: vp.name, file: await capture(browser, server.url, route, vp) })
        console.log(`captured ${route} (${vp.name})`)
      }
    }
  } finally {
    await browser.close()
  }
} finally {
  server.stop()
}

const index = join(OUT, 'index.html')
writeFileSync(index, gallery(shots))
console.log(`\nGallery: ${index}`)
if (unanswered.size) console.log(`No sample data for: ${[...unanswered].join(', ')}`)
if (problems.length) console.log(`Problems:\n  ${problems.join('\n  ')}`)
if (!flag('no-open')) openInBrowser(index)
