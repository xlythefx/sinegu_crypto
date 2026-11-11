---
name: screenshots
description: Screenshot Pixel Alpha pages at desktop and phone width on sample data, then open a gallery in the user's browser. Use when the user asks to see, screenshot, preview or "show how it looks" for any page, or to check a UI change visually before shipping.
---

# Screenshots

One command starts this repo's dev server, captures each page at desktop
(1366 px) and phone (390 px) width, writes a gallery page and **opens it in
the default browser**:

```bash
node .claude/skills/screenshots/shots.mjs                      # the default admin pages
node .claude/skills/screenshots/shots.mjs /admin/invoices "/admin?view=attention"
node .claude/skills/screenshots/shots.mjs /dashboard --role user
```

Options: `--role admin|user` (the signed-in role, default admin), `--theme
dark|light`, `--only desktop|phone`, `--url http://localhost:5191` (reuse a
running server), `--no-open` (skip the browser). The gallery lands in
`%TEMP%\pixel-alpha-shots\<timestamp>\index.html`; the script prints the
path. Tell the user that path, then **look at the screenshots yourself**
(Read the PNGs) before calling a change done. A blank or cut-off frame is a
finding.

## It never touches the live site

The dev build can point its API at **production** (the red "LIVE PROD DATA"
badge). So every request to an `/api/` path, on any host, is answered from
`fixtures.mjs`. A write is answered `{success:true}` and goes nowhere, and any
other request to `pixel-alpha.com` is aborted. Keep it that way: never
"pass through" a request, never put a real customer's name or figure in
`fixtures.mjs` (this repo is public).

## When the gallery says "No sample data for: GET /…"

That page called an endpoint `fixtures.mjs` has no answer for, so it got a
404 and probably shows an error state. Add a sample to the `GET` map,
shaped like the TypeScript type the page reads (`src/types/*`), and rerun.
`DEFAULT_ROUTES` there is what runs with no arguments.

## Gotchas (all hit for real)

- **Port 5173 is often ANOTHER project.** The script starts its own server
  on a free port from 5191 and checks the page title says "Pixel Alpha".
- **Playwright's bundled Chromium does not match its version on this box**
  (blank screenshots), so the script drives the installed Chrome or Edge
  (`CHROME_PATH` to override). `playwright-core` is a devDependency.
- **AOS hides cards until they scroll into view**; the script forces them
  visible, or full-page captures come out empty below the fold.
- **The app loads no Tailwind preflight.** Screenshots are where its effects
  show: browser bullets on lists, and 3 px borders on every side of a
  `border-dashed` line.
- **The red "LIVE PROD DATA" badge is hidden** in every capture: the
  pictures are sample data, and that badge would tell a reader otherwise.
- Interactions (click a tab, hover a bar) are not built in. For a one-off,
  copy `capture()` into a scratch script and add the clicks. To show a
  reader WHERE to click, outline the element and pin a numbered badge
  appended to `document.documentElement` (not `body`, which is offset),
  and hover a sidebar link first: the admin rail shows its labels only on
  hover.

## Sample pages worth knowing

`/admin/users/u-daniel` is a full sample customer profile (an invented
"Daniel Moreau", fixture `SAMPLE_USER_ID`): Overview, Performance Analytics
(after-fees card, monthly table with each month's invoice) and Invoices, with
three invoices worked out from the sample closes the way billing does it.

## Screenshots for ClickUp

When the team asks "where do I check", attach the PNGs to the task with
`clickup_request_attachment_upload` (local files) and reply to the comment
with the click path and the live link. Say the figures are sample data.
