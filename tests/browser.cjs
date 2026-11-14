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

  // --- consent gate: no file is read until the box is ticked, and the page says why
  p = await page(); let chooser = 0; p.on('filechooser', () => chooser++);
  const gate = () => p.evaluate(() => { const a = document.getElementById('attest'), e = document.getElementById('attestErr'); return { err: !e.hidden, mark: a.closest('.opts').classList.contains('err'), focus: document.activeElement.id, invalid: a.getAttribute('aria-invalid'), by: a.getAttribute('aria-describedby'), alert: e.getAttribute('role'), notice: !document.getElementById('notice').hidden }; });
  const dropFile = f => p.evaluate(h => { const dt = new DataTransfer(); dt.items.add(new File([h], 'idsr.html', { type: 'text/html' })); document.getElementById('drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, fs.readFileSync(path.join(FX, f), 'utf8'));
  const untick = async () => { await p.check('#attest'); await p.uncheck('#attest'); await p.focus('#btnSample'); };
  ok('consent: the upload control is a named button and the error is hidden until needed', !(await gate()).err && await p.getAttribute('#drop', 'role') === 'button' && !(await p.getAttribute('#drop', 'aria-disabled')) && /Choose IDSR file/.test(await p.textContent('#drop')));
  await p.click('#drop'); await p.waitForTimeout(250); let g = await gate();
  ok('consent: choosing a file without the tick opens no file picker, shows one error tied to the box and moves focus there', chooser === 0 && g.err && g.mark && g.focus === 'attest' && g.alert === 'alert' && g.invalid === 'true' && g.by === 'attestErr' && !g.notice, JSON.stringify(g));
  await p.check('#attest'); await p.waitForTimeout(150); g = await gate();
  ok('consent: ticking the box clears the error', !g.err && !g.mark && g.invalid === null && g.by === null, JSON.stringify(g));
  let keys = true; for (const k of ['Enter', ' ']) { await untick(); await p.focus('#drop'); await p.keyboard.press(k); await p.waitForTimeout(200); g = await gate(); keys = keys && chooser === 0 && g.err && g.focus === 'attest'; }
  ok('consent: Enter and Space without the tick do the same', keys, JSON.stringify(g));
  await untick(); await dropFile('primary.html'); await p.waitForTimeout(450); g = await gate();
  ok('consent: a file dropped without the tick is not read', /Example Primary School/.test(await doc(p)) && g.err && g.focus === 'attest', JSON.stringify(g));
  await p.setInputFiles('#file', path.join(FX, 'primary.html')); await p.waitForTimeout(450);
  ok('consent: a file handed straight to the input without the tick is not read, and the input is emptied', /Example Primary School/.test(await doc(p)) && await p.evaluate(() => document.getElementById('file').value === ''));
  await p.check('#attest'); await p.click('#drop'); await p.waitForTimeout(250); const afterClick = chooser; await p.focus('#drop'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('consent: with the tick, click and Enter open the file picker', afterClick === 1 && chooser === 2, `${afterClick},${chooser}`);
  const before = await doc(p); await dropFile('primary.html'); await p.waitForTimeout(450); ok('consent: with the tick, a dropped file builds a briefing', !/Example Primary School/.test(await doc(p)) && (await doc(p)) !== before);
  ok('a file dropped outside the upload area does not navigate away', await p.evaluate(() => { const e = new DragEvent('drop', { bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; }));
  await p.close();

  // --- name, independence statement, search basics and the redirect file
  p = await page();
  ok('heading: the product name is the page heading, with the independence statement beside it and in the footer', await p.evaluate(() => { const h = [...document.querySelectorAll('h1')].filter(x => !x.closest('#doc')); return h.length === 1 && h[0].textContent.trim() === 'GovernorBrief' && /not an Ofsted or DfE service/i.test(document.querySelector('.brand .eyebrow').textContent) && /not affiliated with or endorsed by Ofsted/i.test(document.querySelector('#controls > p.note:last-child').textContent); }));
  ok('both briefings say in their footer that the tool is independent', /independent tool not affiliated with Ofsted or the DfE/.test(await doc(p)) && await (async () => { await p.click('#tabB'); await p.waitForTimeout(300); const b = /independent tool not affiliated with or endorsed by Ofsted or the DfE/.test(await doc(p)); await p.click('#tabA'); await p.waitForTimeout(300); return b; })());
  ok('panel sections are headings', await p.evaluate(() => ['Choose your IDSR file', 'Data coverage', 'Output'].every(t => [...document.querySelectorAll('#controls h2')].some(h => h.textContent.trim() === t))));
  const mth = await (await p.request.get(URL + 'method.html')).text(), wm = await (await p.request.get(URL + 'site.webmanifest')).text(), raw = await (await p.request.get(URL)).text();
  ok('rename: GovernorBrief in both page titles and the manifest; the old name appears nowhere a visitor sees', /<title>GovernorBrief/.test(raw) && /<title>[^<]*GovernorBrief/.test(mth) && /"name":\s*"GovernorBrief/.test(wm) && !/GovCopilot/i.test(raw + mth + wm + await p.evaluate(() => document.body.innerText)));
  const SITE = 'https://governorbrief.co.uk/';
  ok('canonical link on both pages, and a link-preview picture that exists', await p.evaluate(() => [...document.querySelectorAll('link[rel="canonical"]')].map(l => l.getAttribute('href')).join()) === SITE && mth.includes(`<link rel="canonical" href="${SITE}method.html">`) && raw.includes(`property="og:image" content="${SITE}link-preview.png"`) && (await p.request.get(URL + 'link-preview.png')).status() === 200);
  const rb = await p.request.get(URL + 'robots.txt'), rbt = await rb.text(), sm = await p.request.get(URL + 'sitemap.xml'), locs = ((await sm.text()).match(/<loc>[^<]+<\/loc>/g) || []).map(x => x.slice(5, -6));
  ok('robots.txt allows the site, keeps crawlers out of the tests folder and points to the sitemap', rb.status() === 200 && /^Allow: \/$/m.test(rbt) && /^Disallow: \/tests\/$/m.test(rbt) && !/^Disallow: \/\s*$/m.test(rbt) && rbt.includes(`Sitemap: ${SITE}sitemap.xml`));
  let live = sm.status() === 200 && locs.length >= 2 && locs.includes(SITE) && locs.includes(SITE + 'method.html'); for (const l of locs) live = live && l.startsWith(SITE) && (await p.request.get(URL + l.slice(SITE.length))).status() === 200;
  ok('sitemap.xml is served and every address in it is a real page', live, locs.join(','));
  const rd = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/)), old = rd.filter(r => /govcopilot\.netlify\.app/.test(r[0]));
  ok('_redirects: the old address goes to the new one, path kept, permanent and forced, for http and https', old.length === 2 && old.every(r => r.length === 3 && /^https?:\/\/govcopilot\.netlify\.app\/\*$/.test(r[0]) && r[1] === SITE + ':splat' && r[2] === '301!') && old.some(r => r[0].startsWith('https:')) && old.some(r => r[0].startsWith('http:')), JSON.stringify(rd));
  ok('development files are not public: the tests folder and README return "not found"', rd.some(r => r[0] === '/tests/*' && r[2] === '404!') && rd.some(r => r[0] === '/README.md' && r[2] === '404!') && (await p.request.get(URL + 'tests/fixtures/hostile_markup.html')).status() === 404 && (await p.request.get(URL + 'README.md')).status() === 404 && fs.existsSync(path.join(ROOT, '404.html')));
  await p.close();

  // --- contact route and booking
  p = await page();
  ok('contact: a booking button opens a ready-written email to the enquiry address, and it asks for no IDSR', await p.evaluate(() => { const a = document.getElementById('btnBook'), u = a && a.getAttribute('href'); return !!u && u.startsWith('mailto:enquiry@governorbrief.co.uk?subject=') && /face-to-face/i.test(decodeURIComponent(u)) && /do not attach or forward an IDSR/i.test(decodeURIComponent(u)) && a.getBoundingClientRect().height >= 44 && /enquiry@governorbrief\.co\.uk/.test(document.querySelector('#controls > p.note:last-child').textContent); }));
  ok('workshop: the section below the tool carries the offer and a request button, and is left out of print', await p.evaluate(() => { const s = document.getElementById('board'), b = document.getElementById('btnWorkshop'); return !!s && /Three minutes before the meeting/.test(s.textContent) && /From Information to Assurance · 90 minutes/.test(s.textContent) && /confirm availability before any booking is made/.test(s.textContent) && /12 short issues/.test(s.textContent) && /March–July 2027/.test(s.textContent) && [...s.querySelectorAll('.steps li')].map(x => x.textContent).join('>') === 'Enquiry>Discussion>Proposal>Confirmation' && b.getAttribute('href') === document.getElementById('btnBook').getAttribute('href') && [...document.styleSheets].some(ss => [...ss.cssRules].some(r => r.media && r.media.mediaText === 'print' && /\.more/.test(r.cssText))); }));
  ok('contact: one product address everywhere; no personal or school address in the published files', ['index.html', 'app.js', 'core.js', 'method.html', '404.html'].every(f => { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'), m = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || []; return m.every(x => x === 'enquiry@governorbrief.co.uk'); }) && /enquiry@governorbrief\.co\.uk/.test(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')));
  await p.close();

  // --- readable text and touch targets (every panel section opened first)
  const sizes = p => p.evaluate(() => { document.querySelectorAll('#controls details').forEach(d => d.open = true); const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, tag = e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`;
    const small = [...document.querySelectorAll('#controls *, #notice, #notice *, #toOpts')].filter(e => vis(e) && !e.classList.contains('vh') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 15).map(e => tag(e) + ' ' + getComputedStyle(e).fontSize);
    const short = [...document.querySelectorAll('button')].filter(e => vis(e) && e.getBoundingClientRect().height < 44).map(e => tag(e) + ' ' + e.getBoundingClientRect().height);
    const boxes = [...document.querySelectorAll('.opts input[type="checkbox"]')].map(e => e.getBoundingClientRect()).every(r => r.width >= 24 && r.height >= 24);
    const pr = document.getElementById('controls').getBoundingClientRect(), wide = [...document.querySelectorAll('#controls *')].filter(e => vis(e) && !e.classList.contains('vh') && (e.getBoundingClientRect().right > pr.right + 0.5 || e.getBoundingClientRect().left < pr.left - 0.5)).map(tag);
    return { body: parseFloat(getComputedStyle(document.body).fontSize), small, short, boxes, wide, side: document.documentElement.scrollWidth - innerWidth }; });
  p = await page(); await p.click('#drop'); let z = await sizes(p);
  ok('desktop: body text at least 17px, nothing in the panel under 15px, buttons at least 44px high, tick boxes 24px, nothing sticks out', z.body >= 17 && z.small.length === 0 && z.short.length === 0 && z.boxes && z.wide.length === 0 && z.side <= 0, JSON.stringify(z)); await p.close();
  for (const w of [390, 320]) { p = await page({ width: w, height: 800 }); await p.click('#drop'); z = await sizes(p);
    ok(`${w}px wide: body text at least 16px, nothing under 15px, buttons 44px, nothing sticks out`, z.body >= 16 && z.small.length === 0 && z.short.length === 0 && z.boxes && z.wide.length === 0 && z.side <= 0, JSON.stringify(z));
    ok(`${w}px wide: the floating options button is hidden while the options are on screen`, await p.evaluate(() => getComputedStyle(document.getElementById('toOpts')).display === 'none'));
    await p.click('#btnEdit'); await p.click('#doc h1'); await p.keyboard.type('ZZ '); await p.click('#btnReset'); await p.waitForTimeout(400);
    ok(`${w}px wide: the keep-or-discard buttons are not covered by anything`, await p.evaluate(() => { const b = [...document.querySelectorAll('#notice button')]; return b.length === 2 && b.every(x => { const r = x.getBoundingClientRect(); return [[r.left + 4, r.top + 4], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 4, r.bottom - 4]].every(([x0, y0]) => document.elementFromPoint(x0, y0) === x); }); })); await p.close(); }

  { p = await page(); const said = await p.evaluate(() => document.body.textContent.match(/(\d+) rule tests and (\d+) browser tests/)); const rules = (fs.readFileSync(path.join(__dirname, 'core.test.mjs'), 'utf8').match(/^test\(/gm) || []).length; await p.close();
    ok('"How it\'s checked" states the real test counts', !!said && +said[1] === rules && +said[2] === R.length + 3, `page says ${said && said[1]} and ${said && said[2]}; actual ${rules} and ${R.length + 3}`); }

  ok('no outside network requests', ext.length === 0, ext.join(',')); ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n')); const failed = R.filter(x => x.startsWith('FAIL')).length; console.log(`${R.length - failed} passed, ${failed} failed`);
  await b.close(); srv.kill(); process.exit(failed ? 1 : 0);
})();
