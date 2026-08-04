#!/usr/bin/env node
/**
 * Auto-allowlist hook for Claude Code (this project).
 *
 * "request" (PermissionRequest): a tool call is about to show a permission
 *   prompt — remember its fingerprint in a temp pending file.
 * "post" (PostToolUse): the same call ran successfully, which means the user
 *   approved it — persist a GENERALIZED allow rule (command-prefix, not the
 *   full one-off command) into .claude/settings.local.json so the next
 *   similar command never prompts again.
 *
 * Never blocks: every failure path exits 0 silently.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MODE = process.argv[2] // "request" | "post"
const PENDING_DIR = join(tmpdir(), 'claude-auto-allow')
const MAX_AGE_MS = 30 * 60 * 1000

// CLIs whose first two words form the meaningful prefix (git push, npm run, ...)
const TWO_WORD = new Set([
  'git', 'npm', 'npx', 'php', 'python', 'py', 'node', 'composer',
  'docker', 'pip', 'pip3', 'flutter', 'dart', 'cargo', 'dotnet', 'gh',
])
// Even an approved one-off of these must never become a standing allow rule.
const NEVER_ALLOW = new Set([
  'rm', 'del', 'rmdir', 'format', 'mkfs', 'shutdown', 'reboot',
  'remove-item', 'stop-computer', 'restart-computer', 'clear-disk',
  'format-volume', 'stop-process',
])

function fingerprint(input) {
  const raw = `${input.session_id ?? ''}|${input.tool_name ?? ''}|${JSON.stringify(input.tool_input ?? {})}`
  return createHash('sha1').update(raw).digest('hex')
}

function deriveRule(tool, inp = {}) {
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(inp.command ?? '').trim()
    if (!cmd) return null
    const tokens = cmd.split('\n')[0].trim().split(/\s+/)
    const t0 = tokens[0] ?? ''
    if (!t0 || NEVER_ALLOW.has(t0.toLowerCase())) return null
    let prefix = t0
    const t1 = tokens[1]
    if (TWO_WORD.has(t0.toLowerCase()) && t1 && !t1.startsWith('-')) {
      if (NEVER_ALLOW.has(t1.toLowerCase())) return null
      prefix = `${t0} ${t1}`
    }
    return `${tool}(${prefix} *)`
  }
  if (tool === 'WebFetch') {
    try {
      return `WebFetch(domain:${new URL(String(inp.url)).hostname})`
    } catch {
      return null
    }
  }
  if (typeof tool === 'string' && tool.startsWith('mcp__')) return tool
  return null // file tools (Read/Edit/Write) are deliberately not auto-widened
}

function addRule(rule) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const file = join(projectDir, '.claude', 'settings.local.json')
  let settings = {}
  if (existsSync(file)) {
    settings = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))
  }
  settings.permissions ??= {}
  settings.permissions.allow ??= []
  if (settings.permissions.allow.includes(rule)) return
  settings.permissions.allow.push(rule)
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8')
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const pendingFile = join(PENDING_DIR, `${fingerprint(input)}.json`)

  if (MODE === 'request') {
    mkdirSync(PENDING_DIR, { recursive: true })
    writeFileSync(pendingFile, String(Date.now()), 'utf8')
    // GC stale entries (user said no / call errored)
    for (const f of readdirSync(PENDING_DIR)) {
      const p = join(PENDING_DIR, f)
      try {
        if (Date.now() - statSync(p).mtimeMs > MAX_AGE_MS) unlinkSync(p)
      } catch {}
    }
  } else if (MODE === 'post') {
    if (existsSync(pendingFile)) {
      const fresh = Date.now() - statSync(pendingFile).mtimeMs <= MAX_AGE_MS
      try { unlinkSync(pendingFile) } catch {}
      if (fresh) {
        const rule = deriveRule(input.tool_name, input.tool_input)
        if (rule) addRule(rule)
      }
    }
  }
} catch {
  // never block the session
}
process.exit(0)
