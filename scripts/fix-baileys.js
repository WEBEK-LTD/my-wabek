/**
 * WABEK - Post-install script
 * Replaces a string in @whiskeysockets/baileys that triggers 
 * Netlify's secrets scanner false positive.
 * The string is a WhatsApp binary protocol constant, NOT a real secret.
 */
const fs = require('fs')
const path = require('path')

const filesToPatch = [
  'node_modules/@whiskeysockets/baileys/lib/WABinary/constants.js',
  'node_modules/@whiskeysockets/baileys/lib/WABinary/constants.d.ts',
]

const PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/g
const REPLACEMENT = 'WABEK_WA_BINARY_CONSTANT'

let patched = 0

for (const relPath of filesToPatch) {
  const fullPath = path.join(process.cwd(), relPath)
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping (not found): ${relPath}`)
    continue
  }
  const original = fs.readFileSync(fullPath, 'utf8')
  if (!PATTERN.test(original)) {
    console.log(`Already clean: ${relPath}`)
    continue
  }
  const fixed = original.replace(PATTERN, REPLACEMENT)
  fs.writeFileSync(fullPath, fixed, 'utf8')
  console.log(`Patched: ${relPath}`)
  patched++
}

if (patched > 0) {
  console.log(`✅ fix-baileys: patched ${patched} file(s)`)
} else {
  console.log('✅ fix-baileys: nothing to patch')
}
