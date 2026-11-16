#!/usr/bin/env node
// Writes lib/generated/addons.json for the admin "Add-ons" page: version
// (WordPress plugin header / WABEK_MODULE_VERSION), zip size + sha256, build
// date and the CHANGELOG.md entries of each add-on. Runs as `prebuild`; the
// generated file is committed so `next dev` works without running it.
//
//   node scripts/addons-manifest.mjs           (write)
//   node scripts/addons-manifest.mjs --check   (exit 1 when out of date)
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'lib/generated/addons.json')

const ADDONS = [
  {
    id: 'wordpress',
    name: 'WABEK WhatsApp for WooCommerce',
    zip: 'public/downloads/wabek-wordpress-plugin.zip',
    changelog: 'integrations/wordpress/wabek-whatsapp/CHANGELOG.md',
    version: () => match('integrations/wordpress/wabek-whatsapp/wabek-whatsapp.php', /^\s*\*\s*Version:\s*([0-9][0-9A-Za-z.+-]*)\s*$/m),
  },
  {
    id: 'whmcs',
    name: 'WABEK WhatsApp for WHMCS',
    zip: 'public/downloads/wabek-whmcs-addon.zip',
    changelog: 'integrations/whmcs/CHANGELOG.md',
    version: () => match('integrations/whmcs/modules/addons/wabek/bootstrap.php', /define\(\s*'WABEK_MODULE_VERSION'\s*,\s*'([^']+)'\s*\)/),
  },
]

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function match(rel, re) {
  const m = read(rel).match(re)
  if (!m) throw new Error(`addons-manifest: version not found in ${rel}`)
  return m[1]
}

/**
 * "## 1.1.0 — 2026-11-16" headings, "### Added" sub-sections and "- " items
 * (continuation lines joined). Text before the first sub-section goes to
 * `notes`. Markdown is kept as-is (the page renders `code` and **bold**).
 */
function parseChangelog(md) {
  const entries = []
  let entry = null
  let section = null
  let last = null
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const h2 = line.match(/^##\s+v?([0-9][^\s—–-]*)\s*(?:[—–-]+\s*(\d{4}-\d{2}-\d{2}))?/)
    if (h2) {
      entry = { version: h2[1], date: h2[2] || null, notes: [], sections: [] }
      entries.push(entry)
      section = null
      last = null
      continue
    }
    if (!entry) continue
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      section = { title: h3[1].trim(), items: [] }
      entry.sections.push(section)
      last = null
      continue
    }
    const item = line.match(/^\s*[-*]\s+(.+)$/)
    if (item) {
      if (!section) {
        section = { title: '', items: [] }
        entry.sections.push(section)
      }
      section.items.push(item[1].trim())
      last = { list: section.items }
      continue
    }
    if (!line.trim()) { last = null; continue }
    if (last) {
      last.list[last.list.length - 1] += ' ' + line.trim()
    } else if (!section) {
      entry.notes.push(line.trim())
    }
  }
  return entries.map(e => ({ ...e, notes: e.notes.join(' ') || null }))
}

function zipInfo(rel) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) return { size: null, sha256: null }
  const buf = readFileSync(path)
  return { size: statSync(path).size, sha256: createHash('sha256').update(buf).digest('hex') }
}

function build(previous) {
  const addons = ADDONS.map(a => ({
    id: a.id,
    name: a.name,
    version: a.version(),
    download: '/' + a.zip.replace(/^public\//, ''),
    ...zipInfo(a.zip),
    changelog: parseChangelog(read(a.changelog)),
  }))
  // Keep the previous build date when nothing else changed (stable diffs).
  const same = previous && JSON.stringify(previous.addons) === JSON.stringify(addons)
  return { generatedAt: same ? previous.generatedAt : new Date().toISOString(), addons }
}

const previous = existsSync(OUT) ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return null } })() : null
const manifest = build(previous)
const json = JSON.stringify(manifest, null, 2) + '\n'

if (process.argv.includes('--check')) {
  if (!previous || JSON.stringify(previous.addons) !== JSON.stringify(manifest.addons)) {
    console.error('lib/generated/addons.json is out of date — run: node scripts/addons-manifest.mjs')
    process.exit(1)
  }
  console.log('✓ lib/generated/addons.json is up to date')
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, json)
  for (const a of manifest.addons) console.log(`addons-manifest: ${a.id} ${a.version} (${a.size ?? 'no zip'} bytes, ${a.changelog.length} changelog entries)`)
}
