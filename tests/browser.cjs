// Browser checks: runs the real page under its real security headers and uses it the way a person would.
// Needs Playwright (npm i -D playwright, then npx playwright install chromium). Run:  node tests/browser.cjs
// Every fixture uses invented figures. Never add a real IDSR here.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures'), PORT = 8791, URL = `http://127.0.0.1:${PORT}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-'));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.cjs'), ROOT, String(PORT)], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(); const R = []; const errs = [], ext = [];
  const ok = (name, cond, info) => R.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && info ? '  — ' + String(info).slice(0, 200) : ''}`);
  const page = async (vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1366, height: 768 }, acceptDownloads: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Refused to|Content Security Policy|ERR_/.test(m.text())) errs.push(m.text()); });
    p.on('request', r => { if (!r.url().startsWith(URL) && !/^blob:|^data:/.test(r.url())) ext.push(r.url()); }); await p.goto(URL); await p.waitForTimeout(400); return p; };
  const doc = p => p.evaluate(() => document.getElementById('doc') ? document.getElementById('doc').innerText : '');
  const up = async (p, f) => { if (!(await p.isChecked('#attest'))) await p.check('#attest'); await p.setInputFiles('#file', path.join(FX, f)); await p.waitForTimeout(450); };
  const pages = async p => ((await p.pdf({ preferCSSPageSize: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const word = async (p, name) => { const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnWord')]); const f = path.join(TMP, name); await dl.saveAs(f); return execSync(`unzip -p "${f}" word/document.xml word/styles.xml`, { maxBuffer: 5e7 }).toString(); };

  // --- example and core functions
  let p = await page();
  ok('example loads, marked as invented', /Example Primary School/.test(await doc(p)) && /invented figures/i.test(await doc(p)));
  ok('security policy delivered as header and meta tag', (await (await p.request.get(URL)).headers())['content-security-policy'].includes("connect-src 'none'") && await p.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')));
  ok('Version A prints on one page', await pages(p) === 1);
  ok('Version A: no text spills out of its table cell', await p.evaluate(() => [...document.querySelectorAll('#doc td, #doc th')].every(c => c.scrollWidth <= c.clientWidth + 1)), await p.evaluate(() => [...document.querySelectorAll('#doc td, #doc th')].filter(c => c.scrollWidth > c.clientWidth + 1).map(c => c.innerText.slice(0, 30)).join(' | ')));
  ok('About, privacy and limits is a collapsed section that opens', await p.evaluate(() => { const d = [...document.querySelectorAll('details.about-box')].find(x => /About, privacy and limits/.test(x.querySelector('summary').textContent)); if (!d || d.open) return false; d.querySelector('summary').click(); return d.open && /Your data stays on this device/.test(d.innerText) && /Version 3\./.test(d.innerText); }));
  ok('first screen: headline, sample briefings, governor help, how it is checked', await p.evaluate(() => /ready for the governors. meeting/.test(document.querySelector('.brand').innerText) && !!document.querySelector('a[href="sample-briefing-one-page.pdf"]') && !!document.querySelector('a[href="sample-briefing-full.pdf"]') && /Ask your headteacher or clerk/.test(document.body.innerText) && /Checked against the IDSR/i.test(document.querySelector('details.about-box').textContent) && /25 September 2026/.test(document.getElementById('checkedLine').textContent)));
  for (const f of ['sample-briefing-one-page.pdf', 'sample-briefing-full.pdf', 'method.html']) { const r = await p.request.get(URL + f); ok(`${f} is served`, r.status() === 200 && (await r.body()).length > 3000 && (f !== 'method.html' || /Worked example/.test(await r.text()))); }
  await p.click('#btnCopyReq'); await p.waitForTimeout(200); ok('governor request message can be copied', /copied|selected/i.test(await p.textContent('#status')));
  ok('Version A: overall picture line', /Overall picture \(all pupils/.test(await doc(p)));
  await p.click('#tabB'); await p.waitForTimeout(250);
  ok('significant results are bold, others are not', await p.evaluate(() => { const w = [...document.querySelectorAll('#doc td span.up, #doc td span.down, #doc td span.flat')].filter(s => s.textContent.trim().length > 2); const sig = w.filter(s => /^sig\./.test(s.textContent)), non = w.filter(s => !/^sig\./.test(s.textContent)); return sig.length > 2 && non.length > 5 && non.every(s => getComputedStyle(s).fontWeight === '400') && sig.every(s => getComputedStyle(s).fontWeight === '700'); }));
  let B = await doc(p);
  ok('Version B order: headlines and how-to-read, then questions, then tables', (() => { const i = s => B.indexOf(s); return i('1. Key headlines') > -1 && i('Overall picture') > i('1. Key headlines') && i('How to read this briefing') < i('2. Key questions') && i('2. Key questions') < i('3. Attainment and progress') && i('3. Attainment and progress') < i('4. Pupil groups') && i('4. Pupil groups') < i('5. Trends over time') && i('5. Trends over time') < i('Appendix A'); })());
  ok('Version B: toolkit-linked questions, evidence trail, coverage', /What the toolkit looks for \(paraphrased\)/.test(B) && /\[Toolkit: /.test(B) && /Appendix A/.test(B) && /Appendix B/.test(B));
  ok('small numbers hidden by default', /5 or fewer/.test(B) && !/Suspension reasons in the latest year/.test(B));
  ok('a percentage implying 5 or fewer pupils is withheld', /5 or fewer pupils/.test(B));
  await p.uncheck('#optSuppress'); await p.waitForTimeout(250); B = await doc(p); ok('switch off shows counts and reasons', /Suspension reasons in the latest year/.test(B) && !/5 or fewer pupils/.test(B)); await p.check('#optSuppress'); await p.waitForTimeout(250);
  let dx = await word(p, 'example.docx'); ok('Word export: same reading order as the screen', (() => { const t = dx.replace(/<[^>]+>/g, ' '); const i = s => t.indexOf(s); return i('Overall picture') > -1 && i('How to read this briefing') < i('2. Key questions') && i('2. Key questions') < i('3. Attainment and progress') && i('5. Trends over time') < i('Appendix A'); })());
  ok('Word export: valid, toolkit links, small numbers hidden, language set', /Key questions for governors/.test(dx) && /Toolkit: /.test(dx) && /5 or fewer/.test(dx) && !/Suspension reasons in the latest year/.test(dx) && /en-GB/.test(dx));
  await p.focus('#tabB'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250); ok('tabs work with arrow keys', /Priority view/.test(await doc(p)));

  // --- edits are never lost without an explicit answer, and there is no timer
  await p.click('#btnEdit'); await p.click('#doc h1'); await p.keyboard.type('ZZ '); await p.waitForTimeout(150);
  await p.click('#btnReset'); await p.waitForTimeout(150); ok('Regenerate asks, with buttons', /ZZ/.test(await doc(p)) && await p.locator('#notice button', { hasText: 'Discard edits' }).count() === 1);
  await p.click('#tabB'); await p.waitForTimeout(150); ok('pressing a different control does not confirm the discard', /ZZ/.test(await doc(p)));
  await p.waitForTimeout(1200); await p.locator('#notice button', { hasText: 'Keep my edits' }).click(); await p.waitForTimeout(150); ok('Keep my edits keeps them', /ZZ/.test(await doc(p)));
  await p.uncheck('#optSuppress'); await p.waitForTimeout(150); await p.locator('#notice button', { hasText: 'Keep my edits' }).click(); await p.waitForTimeout(150); ok('declining puts the small-numbers box back', await p.isChecked('#optSuppress') && /ZZ/.test(await doc(p)));
  await p.click('#btnWord'); await p.waitForTimeout(150); ok('Word export warns that edits are not included', await p.locator('#notice button', { hasText: 'Download Word without my edits' }).count() === 1); await p.locator('#notice button', { hasText: 'Keep my edits' }).click();
  await p.click('#btnReset'); await p.locator('#notice button', { hasText: 'Discard edits' }).click(); await p.waitForTimeout(250); ok('Discard edits restores the briefing', !/ZZ/.test(await doc(p)));

  // --- uploads
  await up(p, 'primary.html'); ok('IDSR-shaped file builds a briefing', /Synthetic Oak Primary School/.test(await doc(p)));
  ok('Version A still one page for an uploaded school', await pages(p) === 1);
  await up(p, 'footnote_markers.html'); await p.click('#tabB'); await p.waitForTimeout(250); B = await doc(p); ok('figures with footnote markers are read, not replaced by last year', /Reading expected: 83% against 75% nationally in 2026/.test(B), B.slice(0, 600));
  await up(p, 'small_school.html'); ok('small school: no text spills out of a cell in Version A', await p.evaluate(() => [...document.querySelectorAll('#doc td, #doc th')].every(c => c.scrollWidth <= c.clientWidth + 1))); await p.click('#tabB'); await p.waitForTimeout(250); B = await doc(p); ok('small school: no cohort or count of 5 or fewer printed', !/n = [1-5]\b/.test(B) && !/\b[1-5] permanent exclusion/.test(B) && !/sexual misconduct/i.test(B), (B.match(/n = [1-5]\b[^\n]{0,60}/) || [''])[0]);
  dx = await word(p, 'small.docx'); ok('small school: Word agrees with the screen', !/n = [1-5]\b/.test(dx.replace(/<[^>]+>/g, ' ')) && !/sexual misconduct/i.test(dx));
  await p.click('#tabA'); await p.waitForTimeout(200); await up(p, 'secondary.html'); B = await doc(p); ok('secondary school loads and Version A fits', /Synthetic Riverside Academy/.test(B) && await pages(p) === 1);
  await up(p, 'special.html'); ok('special school loads, labelled as not yet supported', /Synthetic Meadow Special School/.test(await doc(p)) && /Special schools are not yet supported/.test(await p.textContent('#notice')));
  await up(p, 'pdf_not_html.html'); ok('PDF is refused and the previous briefing cleared', /PDF version/.test(await p.textContent('#notice')) && !(await p.$('#doc')));
  await up(p, 'changed_layout.html'); let n = await p.textContent('#notice'); ok('changed layout is refused; message never asks for the file', /No briefing has been produced/.test(n) && /Do not attach/.test(n) && !(await p.$('#doc')));
  await p.close();

  // --- hostile files
  p = await page(); let navigated = false; p.on('framenavigated', f => { if (f === p.mainFrame() && !f.url().startsWith(URL)) navigated = true; });
  await up(p, 'hostile_markup.html'); await p.waitForTimeout(900); for (const off of [false, true]) { if (off) { await p.uncheck('#optSuppress'); await p.waitForTimeout(200); } await p.click('#tabB'); await p.waitForTimeout(200); await p.click('#tabA'); await p.waitForTimeout(400); }
  ok('hostile markup stays text: no script, no injected elements, no redirect', !navigated && p.url().startsWith(URL) && !(await p.evaluate(() => window.__pwned || !!document.querySelector('#doc img, #doc meta, #doc a, #doc style, #doc script'))));
  await up(p, 'hostile_key.html'); await up(p, 'primary.html'); await p.click('#tabB'); await p.waitForTimeout(250); ok('one file cannot alter the next school\'s briefing', await p.evaluate(() => Object.keys({}).length === 0 && !('Phonics expected standard' in {})) );
  await p.close();

  // --- sizes
  p = await page({ width: 390, height: 844 }); ok('phone: stays at top, no sideways scroll', await p.evaluate(() => window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth));
  await p.click('#btnEdit'); await p.click('#doc h1'); await p.keyboard.type('ZZ '); await p.click('#btnReset'); await p.waitForTimeout(300);
  ok('phone: the discard question is on screen', await p.evaluate(() => { const r = document.getElementById('notice').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })); await p.close();
  p = await page({ width: 900, height: 700 }); await p.setViewportSize({ width: 1440, height: 1000 }); await p.waitForTimeout(500); ok('narrow then wide: Version A is re-fitted to one page', /fits one side/.test(await p.textContent('#fitcheck')) && await pages(p) === 1); await p.close();

  ok('no outside network requests', ext.length === 0, ext.join(',')); ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n')); const failed = R.filter(x => x.startsWith('FAIL')).length; console.log(`${R.length - failed} passed, ${failed} failed`);
  await b.close(); srv.kill(); process.exit(failed ? 1 : 0);
})();
