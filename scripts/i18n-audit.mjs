#!/usr/bin/env node
// Fails if Arabic text is hard-coded in UI code instead of a translation file.
//
//   node scripts/i18n-audit.mjs            # whole UI
//   node scripts/i18n-audit.mjs pages/admin components/admin
//
// Allowed places for Arabic:
//   - locales/**                 (per-page dictionaries, see lib/i18n-local.ts)
//   - lib/i18n.ts, lib/legal-i18n.ts, lib/blog-posts.ts, lib/blog-translations.ts (content data)
//   - lib/** server-side message templates sent to WhatsApp recipients
//   - comments
// Everything under pages/, components/ and hooks/ must be Arabic-free.
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['pages', 'components', 'hooks']
const SKIP_DIRS = new Set(['node_modules', '.next', 'api'])
const AR = /[؀-ۿ]/

function stripComments(src) {
  // Remove /* */ and // comments (good enough for TS/TSX; keeps line numbers).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

const hits = []
function walk(p) {
  const st = fs.statSync(p)
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(p))) return
    for (const f of fs.readdirSync(p)) walk(path.join(p, f))
    return
  }
  if (!/\.(tsx?|jsx?|mts)$/.test(p)) return
  const lines = stripComments(fs.readFileSync(p, 'utf8')).split('\n')
  lines.forEach((l, i) => { if (AR.test(l)) hits.push(`${p}:${i + 1}: ${l.trim().slice(0, 120)}`) })
}
for (const r of ROOTS) if (fs.existsSync(r)) walk(r)

if (hits.length) {
  console.log(hits.join('\n'))
  console.error(`\n✗ ${hits.length} line(s) with hard-coded Arabic. Move them to a dictionary under locales/ (see lib/i18n-local.ts).`)
  process.exit(1)
}
console.log('✓ No hard-coded Arabic in', ROOTS.join(', '))
