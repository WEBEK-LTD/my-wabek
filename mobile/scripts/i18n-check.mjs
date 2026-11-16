#!/usr/bin/env node
// Language rules of the WABEK app:
//  1. English (src/i18n/en.ts) contains no Arabic at all.
//  2. Arabic (src/i18n/ar.ts) has exactly the same keys as English.
//  3. Screens and components contain no hard-coded text: no Arabic anywhere
//     outside src/i18n, and no literal words between JSX tags.
import fs from 'node:fs'
import path from 'node:path'

const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const problems = []

const keysOf = src => [...src.matchAll(/^\s{2}([a-z0-9_]+):\s/gm)].map(m => m[1])
const enSrc = fs.readFileSync(path.join(root, 'src/i18n/en.ts'), 'utf8')
const arSrc = fs.readFileSync(path.join(root, 'src/i18n/ar.ts'), 'utf8')

enSrc.split('\n').forEach((l, i) => { if (AR.test(l)) problems.push(`src/i18n/en.ts:${i + 1}: Arabic in the English dictionary: ${l.trim()}`) })
const en = keysOf(enSrc), ar = keysOf(arSrc)
for (const k of en) if (!ar.includes(k)) problems.push(`ar.ts is missing "${k}"`)
for (const k of ar) if (!en.includes(k)) problems.push(`ar.ts has an extra key "${k}"`)

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) { walk(p); continue }
    if (!/\.tsx?$/.test(f) || p.includes(`${path.sep}i18n${path.sep}`)) continue
    const rel = path.relative(root, p)
    const code = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    code.split('\n').forEach((l, i) => {
      if (AR.test(l)) problems.push(`${rel}:${i + 1}: Arabic outside the dictionaries`)
      // Text written directly between JSX tags, e.g. <T>Save</T>
      const m = l.match(/(?<!=)>\s*([A-Za-z][A-Za-z ,.'!?-]{2,})\s*</)
      if (m && !/^(WABEK)$/.test(m[1].trim())) problems.push(`${rel}:${i + 1}: hard-coded text "${m[1].trim()}"`)
    })
  }
}
walk(path.join(root, 'src'))

if (problems.length) {
  console.log(problems.join('\n'))
  console.error(`\n✗ ${problems.length} language problem(s).`)
  process.exitCode = 1
} else {
  console.log(`✓ ${en.length} keys in English and Arabic; no Arabic in English; no hard-coded text.`)
}
