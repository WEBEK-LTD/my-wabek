#!/usr/bin/env node
/**
 * WABEK for WHMCS — screenshots + layout checks of the pages written by
 * tests/render-check.php (Playwright, Chromium).
 *
 *   node integrations/whmcs/tests/screenshot.mjs /tmp/wabek-theme-test/pages [/tmp/wabek-theme-test/shots]
 *
 * For every page, at 390px (phone) and 1280px (desktop):
 *   - no horizontal page overflow and nothing of ours sticks out of its column;
 *   - every form, button and input of ours is visible;
 *   - framework components are actually styled by the framework (buttons,
 *     panels/cards, alerts, badges/labels, form controls), i.e. no unstyled
 *     element;
 *   - RTL pages: our root is RTL, phone numbers stay LTR, the checkout
 *     checkbox sits on the start (right) side of its label.
 * Writes PNG screenshots and one contact sheet per state to the shots folder
 * (keep it outside the repository). Exit code 0 when every check passes.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const pagesDir = path.resolve(process.argv[2] || '/tmp/wabek-theme-test/pages');
const shotsDir = path.resolve(process.argv[3] || path.join(path.dirname(pagesDir), 'shots'));
fs.mkdirSync(shotsDir, { recursive: true });
const { pages } = JSON.parse(fs.readFileSync(path.join(pagesDir, 'manifest.json'), 'utf8'));
const widths = [390, 1280];

const failures = [];
let passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failures.push(what); console.error('FAIL:', what); } };

/** Runs in the page: returns a list of problems. */
function audit(dir) {
  const problems = [];
  const transparent = (c) => !c || c === 'transparent' || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c);
  const px = (v) => parseFloat(v) || 0;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.');

  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) problems.push(`horizontal overflow: scrollWidth ${doc.scrollWidth} > ${window.innerWidth}`);

  const roots = [...document.querySelectorAll('.wabek-ca, .wabek-co, .wabek-cs')];
  if (!roots.length) problems.push('no .wabek-ca / .wabek-co / .wabek-cs root');
  for (const root of roots) {
    if (!visible(root)) problems.push('root not visible');
    const rr = root.getBoundingClientRect();
    if (getComputedStyle(root).direction !== dir) problems.push(`root direction ${getComputedStyle(root).direction} != ${dir}`);
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el) || el.closest('.icheckbox')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > rr.right + 1.5 || r.left < rr.left - 1.5) {
        // Bootstrap's .checkbox/.form-check inputs hang into the parent's padding by design.
        if (!(el.matches('input[type=checkbox]') && r.left >= rr.left - 25 && r.right <= rr.right + 25)) {
          problems.push(`${name(el)} sticks out of the root (${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(rr.left)}–${Math.round(rr.right)})`);
        }
      }
      if (r.right > window.innerWidth + 1 || r.left < -1) problems.push(`${name(el)} outside the viewport`);
    }
    for (const el of root.querySelectorAll('form, button, .btn, input:not([type=hidden]), label')) {
      if (!visible(el)) problems.push(`${name(el)} not visible`);
    }
    for (const el of root.querySelectorAll('.btn')) {
      const s = getComputedStyle(el);
      if (el.classList.contains('btn-link')) { if (s.cursor !== 'pointer' && el.tagName === 'BUTTON') problems.push(`${name(el)} not styled as a link button`); continue; }
      if (px(s.paddingLeft) < 4 || px(s.paddingTop) < 2) problems.push(`${name(el)} has no button padding`);
      if (transparent(s.backgroundColor) && px(s.borderTopWidth) === 0) problems.push(`${name(el)} looks unstyled (no background, no border)`);
      if (!/inline-block|block|flex|inline-flex/.test(s.display)) problems.push(`${name(el)} display ${s.display}`);
      if (el.classList.contains('btn-primary') && transparent(s.backgroundColor)) problems.push(`${name(el)} primary without background`);
      if (s.textDecorationLine === 'underline') problems.push(`${name(el)} underlined like a plain link`);
    }
    for (const el of root.querySelectorAll('.panel, .card')) {
      const s = getComputedStyle(el);
      if (px(s.borderTopWidth) === 0 && s.boxShadow === 'none') problems.push(`${name(el)} has neither border nor shadow`);
      if (px(s.marginBottom) === 0 && el.nextElementSibling) problems.push(`${name(el)} has no bottom margin`);
    }
    for (const el of root.querySelectorAll('.panel-body, .card-body')) {
      if (px(getComputedStyle(el).paddingLeft) < 8) problems.push(`${name(el)} has no body padding`);
    }
    for (const el of root.querySelectorAll('.alert')) {
      const s = getComputedStyle(el);
      if (transparent(s.backgroundColor) || px(s.paddingLeft) < 8) problems.push(`${name(el)} unstyled alert`);
    }
    for (const el of root.querySelectorAll('.badge, .label')) {
      const s = getComputedStyle(el);
      if (transparent(s.backgroundColor)) problems.push(`${name(el)} badge/label without background`);
    }
    for (const el of root.querySelectorAll('.form-control')) {
      const s = getComputedStyle(el);
      if (s.display !== 'block' || px(s.borderTopWidth) === 0 || el.getBoundingClientRect().width < 150) problems.push(`${name(el)} unstyled form control`);
    }
    for (const el of root.querySelectorAll('.wabek-phone')) {
      if (getComputedStyle(el).direction !== 'ltr') problems.push('phone number not LTR');
    }
    for (const box of root.querySelectorAll('.wabek-co-check')) {
      const input = box.querySelector('input[type=checkbox]');
      const label = box.querySelector('label');
      const range = document.createRange();
      const text = [...label.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!input || !text) { problems.push('checkout box incomplete'); continue; }
      range.selectNodeContents(text);
      const t = range.getBoundingClientRect();
      const i = input.getBoundingClientRect();
      if (dir === 'ltr' ? i.left > t.left : i.right < t.right) problems.push(`checkbox on the wrong side of its label (${dir})`);
      if (Math.abs((i.top + i.bottom) / 2 - (t.top + Math.min(t.height, 24) / 2)) > 14) problems.push('checkbox not aligned with its label');
      if (dir === 'ltr' ? t.left - i.right > 16 : i.left - t.right > 16) problems.push('checkbox far from its label');
    }
  }
  return problems;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
const shots = [];
for (const p of pages) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('file://' + path.join(pagesDir, p.file));
    await page.waitForLoadState('load');
    const problems = await page.evaluate(audit, p.dir);
    check(problems.length === 0, `${p.file} @${w}px: ${problems.join('; ') || 'ok'}`);
    const out = path.join(shotsDir, p.file.replace(/\.html$/, `-${w}.png`));
    await page.screenshot({ path: out, fullPage: true });
    shots.push({ ...p, width: w, png: out });
  }
}

// Contact sheets: one per state and width, all themes × directions side by side.
const groups = {};
for (const s of shots) (groups[`${s.state}-${s.width}`] ||= []).push(s);
for (const [key, list] of Object.entries(groups)) {
  const cell = list[0].width === 390 ? 390 : 640;
  const html = `<!doctype html><body style="margin:0;background:#888;font:12px sans-serif"><div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px">${list
    .map((s) => `<figure style="margin:0;width:${cell}px;background:#fff"><figcaption style="padding:2px 4px;background:#222;color:#fff">${s.shell} ${s.dir}</figcaption><img src="file://${s.png}" style="width:${cell}px;display:block"></figure>`)
    .join('')}</div></body>`;
  const sheet = path.join(shotsDir, `sheet-${key}.html`);
  fs.writeFileSync(sheet, html);
  await page.setViewportSize({ width: list[0].width === 390 ? 2020 : 3300, height: 800 });
  await page.goto('file://' + sheet);
  await page.waitForLoadState('load');
  await page.screenshot({ path: sheet.replace(/\.html$/, '.png'), fullPage: true });
}
await browser.close();

console.log(`screenshot: ${passed} passed, ${failures.length} failed; ${shots.length} screenshots in ${shotsDir}`);
process.exit(failures.length ? 1 : 0);
