// Rule tests for the parser helpers and the analysis. No dependencies: run with  node --test tests/
// Every figure used here is invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(path.join(root, 'questions.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sample.js'), 'utf8') +
  '\n;globalThis.T={fewPupils,cnt,num,bandInfo,judge,analyse,normaliseModel,validateModel,latest,termNote,fmtGap,renderA,renderB,SAMPLE_MODEL,TESTED_RELEASES,setSuppress:v=>{SUPPRESS=v;}};', ctx);
const T = ctx.T;
const fresh = () => T.normaliseModel(JSON.parse(JSON.stringify(T.SAMPLE_MODEL)));
const row = (m, g, k, year) => m.annex[g][k].find(r => r.year === year);
const setBand = (r, school, text) => { r.school = school; r.schoolN = T.num(school); r.band = T.bandInfo(text); };
const texts = list => list.map(x => x.text).join('\n');

test('number reader: plain numbers', () => {
  assert.equal(T.num('75%'), 75); assert.equal(T.num('23.7'), 23.7); assert.equal(T.num('+2.2'), 2.2);
  assert.equal(T.num('1,234'), 1234); assert.equal(T.num(' 20 '), 20); assert.equal(T.num('8.00%'), 8);
});
test('number reader: a minus sign is a minus sign, whichever character Ofsted uses', () => {
  assert.equal(T.num('-0.45'), -0.45); assert.equal(T.num('−0.45'), -0.45); assert.equal(T.num('–12'), -12);
});
test('number reader: suppression markers and ranges never become figures', () => {
  for (const s of ['x', 'c', 'S', 'R', 'SUPP', 'Suppressed', 'Small cohort', 'Not available', '-', '–', '', '<5', '< 5', '1 to 4', '10-14', 'fewer than 5', '5 (3%)'])
    assert.equal(T.num(s), null, `"${s}" must not be read as a number`);
});

test('banding and significance: the seven published outcomes, with either minus character', () => {
  const cases = [
    ['Above (sig+)', 2, '+'], ['Above (non-sig)', 1, null], ['Close to average (sig+)', 2, '+'], ['Close to average (non-sig)', 0, null],
    ['Close to average (sig-)', -2, '-'], ['Close to average (sig−)', -2, '-'], ['Below (non-sig)', -1, null], ['Below (sig-)', -2, '-'], ['Below (sig−)', -2, '-'],
  ];
  for (const [text, dir, sig] of cases) { const b = T.bandInfo(text); assert.equal(b.dir, dir, text); assert.equal(b.sig, sig, text); }
  assert.equal(T.bandInfo('Close to average (sig+)').band, 0);
  const well = T.bandInfo('Well above average'); assert.equal(well.band, 2); assert.equal(well.sig, null);
  assert.equal(T.bandInfo('Not available'), null); assert.equal(T.bandInfo('Small cohort'), null);
});
test('wording: significance and "well above" are never confused', () => {
  assert.equal(T.judge(T.bandInfo('Well above average')).word, 'well above');
  assert.equal(T.judge(T.bandInfo('Above (sig+)')).word, 'sig. above');
  assert.match(T.judge(T.bandInfo('Close to average (sig+)')).word, /^sig\. above/);
  assert.match(T.judge(T.bandInfo('Close to average (sig−)')).word, /^sig\. below/);
  assert.equal(T.judge(T.bandInfo('Above (sig+)'), true).word, 'sig. worse');      // absence: higher is worse
  assert.equal(T.judge(T.bandInfo('Below (non-sig)'), true).word, 'better than nat.');
});

test('"Close to average (sig+)" is reported as significantly above, never below', () => {
  T.setSuppress(true); const m = fresh();
  setBand(row(m, 'All pupils', 'RWM expected standard', '2026'), '66%', 'Close to average (sig+)');
  const an = T.analyse(m);
  assert.match(texts(an.strengths), /RWM expected: 66% against 63% nationally in 2026 .* statistically significantly above/);
  assert.doesNotMatch(texts(an.concerns), /RWM expected: 66%/);
});
test('"Below (sig−)" with a typographic minus is still significant', () => {
  const m = fresh(); setBand(row(m, 'All pupils', 'Reading expected standard', '2026'), '60%', 'Below (sig−)');
  assert.match(texts(T.analyse(m).concerns), /Reading expected: 60% against 75% nationally in 2026 .* statistically significantly below/);
});

test('rows in any order: the newest year is always "latest"', () => {
  const m = JSON.parse(JSON.stringify(T.SAMPLE_MODEL));
  Object.values(m.annex).forEach(ms => Object.keys(ms).forEach(k => ms[k].reverse()));
  const a = T.analyse(T.normaliseModel(m)), b = T.analyse(fresh());
  assert.equal(texts(a.strengths), texts(b.strengths)); assert.equal(texts(a.concerns), texts(b.concerns));
  assert.equal(T.latest(fresh().annex['All pupils']['RWM expected standard']).year, '2026');
});

test('an unfamiliar measure is flagged, not treated as "higher is better"', () => {
  const m = fresh();
  m.annex['All pupils']['Severe absence'] = [{ year: '2024/25 (3 term)', cohort: 230, school: '5.0%', schoolN: 5, nat: '2.0%', natN: 2, band: { text: 'Above (sig+)' }, trend: '' }];
  m.annex['All pupils']['Pupils with a made-up measure'] = [{ year: '2026', cohort: 30, school: '90%', schoolN: 90, nat: '50%', natN: 50, band: { text: 'Above (sig+)' }, trend: '' }];
  const an = T.analyse(T.normaliseModel(m));
  assert.doesNotMatch(texts(an.strengths), /Severe absence|made-up measure/);
  assert.ok(an.coverage.verify.some(v => /Severe absence/.test(v))); assert.ok(an.coverage.verify.some(v => /made-up measure/.test(v)));
});

test('disadvantaged gap: sign, unit and cross-check', () => {
  assert.equal(T.fmtGap(-20.2, 'Attainment 8'), '−20.2 pts'); assert.equal(T.fmtGap(3, 'RWM expected standard'), '+3 pp');
  const m = fresh(); const r = row(m, 'Disadvantaged pupils', 'RWM expected standard', '2026');
  r.gap = '12'; r.gapN = 12;                                   // published gap contradicts school minus national
  const an = T.analyse(m);
  assert.doesNotMatch(texts(an.strengths) + texts(an.concerns), /RWM \(\+12 pp\)/);
  assert.ok(an.coverage.verify.some(v => /Disadvantaged gap left out/.test(v)));
});

test('suspension totals: a missing year never shifts a figure or invents a trend', () => {
  const m = fresh(); const y = m.suspensions.years; m.suspensions.rows['Total number of suspensions'] = { [y[0]]: 10, [y[1]]: null, [y[2]]: 14 };
  const all = texts(T.analyse(m).strengths) + texts(T.analyse(m).concerns);
  assert.doesNotMatch(all, /Total suspensions/);
});

test('small numbers: hidden everywhere when the switch is on, shown when it is off', () => {
  const m = fresh(); const y = m.exclusions.years;
  m.exclusions.rows['Total number of permanent exclusions'][y[2]] = 1; m.exclusions.reasons = [{ reason: 'An Invented Reason', byYear: { [y[2]]: 1 } }];
  m.suspensions.reasons[0].reason = 'Another Invented Reason';
  T.setSuppress(true); let an = T.analyse(m); let html = T.renderA(m, an, true) + T.renderB(m, an, true);
  assert.doesNotMatch(html, /invented reason/i); assert.doesNotMatch(html, /\b1 permanent exclusion/); assert.match(html, /Permanent exclusions were recorded .*\(5 or fewer\)/);
  assert.match(html, /5 or fewer with EHC plans/);
  T.setSuppress(false); an = T.analyse(m); html = T.renderA(m, an, false) + T.renderB(m, an, false);
  assert.match(html, /1 permanent exclusion/); assert.match(html, /an invented reason/); T.setSuppress(true);
});

test('text from the uploaded file is escaped before it reaches the page', () => {
  const m = fresh(); m.suspensions.reasons[0].reason = '<img src=x onerror=alert(1)>'; m.school.name = '<script>bad()</script>';
  T.setSuppress(false); const an = T.analyse(m); const html = T.renderA(m, an, false) + T.renderB(m, an, false); T.setSuppress(true);
  assert.doesNotMatch(html, /<img src=x/i); assert.doesNotMatch(html, /<script>bad/i); assert.match(html, /&lt;img src=x/);
});

test('part-year attendance is labelled as part-year', () => {
  assert.equal(T.termNote('2025/26 (1 term)'), ', autumn term only'); assert.equal(T.termNote('2025/26 (2 term)'), ', autumn and spring terms only'); assert.equal(T.termNote('2024/25 (3 term)'), '');
  const m = fresh(); const an = T.analyse(m); assert.match(T.renderA(m, an, true), /2025\/26, autumn term only/);
});

test('template check: refuses when the measure tables or key columns are missing', () => {
  const m = fresh();
  m.schema = { candidates: 12, tables: 0, noValue: 0, noNat: 0, noBand: 0, noCohort: 0, disTables: 0, noGap: 0 };
  assert.ok(T.validateModel(m).fatal.length > 0);
  m.schema = { candidates: 12, tables: 12, noValue: 0, noNat: 0, noBand: 12, noCohort: 0, disTables: 2, noGap: 0 };
  assert.ok(T.validateModel(m).fatal.some(f => /banding column/.test(f)));
  m.schema = { candidates: 12, tables: 12, noValue: 0, noNat: 0, noBand: 0, noCohort: 0, disTables: 2, noGap: 2 };
  const v = T.validateModel(m); assert.equal(v.fatal.length, 0); assert.ok(v.warn.some(w => /gap column/.test(w)));
});
test('template check: an IDSR newer than the last checked release loads with a warning', () => {
  const m = fresh(); m.school.release = '14 November 2031';
  assert.ok(T.validateModel(m).warn.some(w => /after the latest release/.test(w)));
  m.school.release = T.TESTED_RELEASES[T.TESTED_RELEASES.length - 1]; assert.equal(T.validateModel(m).warn.length, 0);
});
test('a mainstream school with no national comparisons at all is refused', () => {
  const m = fresh(); Object.values(m.annex).forEach(ms => Object.values(ms).forEach(rows => rows.forEach(r => { r.band = null; })));
  assert.ok(T.validateModel(m).fatal.length > 0);
});

test('the built-in example is marked as invented and produces both briefings', () => {
  const m = fresh(); assert.equal(m.invented, true); assert.equal(m.school.urn, '000000');
  const an = T.analyse(m); assert.ok(an.strengths.length > 0 && an.concerns.length > 0 && an.questions.length > 0);
  assert.match(T.renderA(m, an, true), /invented figures/i); assert.match(T.renderB(m, an, true), /EXAMPLE WITH INVENTED FIGURES/);
});
test('questions follow the priority of their headline', () => {
  const an = T.analyse(fresh()); const pris = an.questions.map(q => q.pri);
  assert.equal(JSON.stringify(pris), JSON.stringify([...pris].sort((a, b) => a - b)));
});

test('every generated question is tied to a toolkit theme in the right area', () => {
  const ctx2 = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(root, 'questions.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sample.js'), 'utf8') + '\n;globalThis.X={TOOLKIT,AREAS,refFor,analyse,normaliseModel,renderB,SAMPLE_MODEL};', ctx2);
  const X = ctx2.X; const m = X.normaliseModel(JSON.parse(JSON.stringify(X.SAMPLE_MODEL))); const an = X.analyse(m);
  for (const q of an.questions) { assert.ok(q.ref && X.TOOLKIT.refs[q.ref], 'no toolkit reference for: ' + q.q); }
  assert.equal(X.refFor('att', 'Suspension rates for all pupils are above national.'), 'att_beh');
  assert.equal(X.refFor('att', 'Attendance for all pupils is 93% against 95% nationally.'), 'att_att');
  assert.equal(X.refFor('inc', 'How is pupil premium funding being used for these pupils?'), 'inc_dis');
  assert.equal(X.refFor('ach', 'Year 1 phonics was 70% against 80% nationally.'), 'ach_found');
  assert.equal(X.refFor('ach', 'Reading – expected was below national in 2026.'), 'ach_nat');
  const html = X.renderB(m, an, true);
  assert.match(html, /What the toolkit looks for \(paraphrased\)/); assert.match(html, /\[Toolkit: Achievement: Inclusive achievement/);
  assert.match(html, /State-funded school inspection toolkit, v2\.0/);
});

test('number reader: footnote markers do not stop a figure being read', () => {
  for (const [s, v] of [['83% *', 83], ['62%¹', 62], ['79%[1]', 79], ['71% (provisional)', 71], ['12.0%†', 12], ['+.5', 0.5], ['83%*', 83]]) assert.equal(T.num(s), v, s);
  assert.equal(T.num('<5 *'), null);
});
test('small numbers: cohort sizes of 5 or fewer are never printed', () => {
  T.setSuppress(true); const m = fresh();
  for (const k of Object.keys(m.annex['Disadvantaged pupils'])) m.annex['Disadvantaged pupils'][k].forEach(r => { r.cohort = 4; });
  for (const g of ['Low prior attainers', 'High prior attainers']) for (const k of Object.keys(m.annex[g])) m.annex[g][k].forEach(r => { r.cohort = 2; });
  const an = T.analyse(m); const html = T.renderA(m, an, true) + T.renderB(m, an, true);
  assert.doesNotMatch(html, /n = [1-5]\b/); assert.doesNotMatch(html, /n = [1-5]\)/);
});
test('small numbers: a suspension or absence percentage that implies 5 or fewer pupils is withheld', () => {
  T.setSuppress(true); const m = fresh(); const r = m.annex['SEN']['1 or more suspensions'][0];
  r.cohort = 40; r.school = '7.50%'; r.schoolN = 7.5; r.band = T.bandInfo('Above (sig+)');           // 3 pupils
  let an = T.analyse(m); let html = T.renderA(m, an, true) + T.renderB(m, an, true);
  assert.doesNotMatch(html, /7\.50%/); assert.match(html, /5 or fewer pupils/);
  T.setSuppress(false); an = T.analyse(m); html = T.renderB(m, an, false); assert.match(html, /7\.50%/); T.setSuppress(true);
});
test('small numbers: no trend is given when a suspension total is hidden', () => {
  T.setSuppress(true); const m = fresh(); const y = m.suspensions.years; m.suspensions.rows['Total number of suspensions'] = { [y[0]]: 2, [y[1]]: 3, [y[2]]: 4 };
  const an = T.analyse(m); assert.doesNotMatch(texts(an.strengths) + texts(an.concerns), /Total suspensions/);
});
test('significant disadvantaged progress and multi-year progress results are reported', () => {
  T.setSuppress(true); const m = fresh(); const r = m.annex['Disadvantaged pupils']['Reading progress'].find(x => x.year === '2026');
  r.school = '-3.1'; r.schoolN = -3.1; r.band = T.bandInfo('Below (sig-)');
  const an = T.analyse(m);
  assert.match(texts(an.concerns), /Disadvantaged pupils: Reading progress -3\.1 in 2026 .* statistically significantly below/);
  assert.match(texts(an.strengths), /Reading progress 1\.6 vs 0\.0/);          // the example's significant 3-year progress average
  assert.match(texts(an.concerns), /Writing progress -1\.9 vs 0\.0/);
});
test('disadvantaged summary line in Version A is escaped', () => {
  T.setSuppress(true); const m = fresh(); const r = m.annex['Disadvantaged pupils']['RWM expected standard'].find(x => x.year === '2026');
  r.natOther = '<meta http-equiv=refresh content=0;url=https://example.invalid>'; r.nat = '<b>x</b>';
  const an = T.analyse(m); const html = T.renderA(m, an, true) + T.renderB(m, an, true);
  assert.doesNotMatch(html, /<meta http-equiv/i); assert.doesNotMatch(html, /<b>x<\/b>/);
});
test('release date: other formats are understood, and an unreadable date warns', () => {
  const m = fresh();
  for (const d of ['25th September 2027', '14 Nov 2031', '2031-11-14', '25/09/2027']) { m.school.release = d; assert.ok(T.validateModel(m).warn.some(w => /after the latest release/.test(w)), d); }
  for (const d of ['', 'November 2031', 'soon']) { m.school.release = d; assert.ok(T.validateModel(m).warn.some(w => /could not be read/.test(w)), d || '(empty)'); }
});
test('multi-year rows: label variants are recognised and mixed periods are not mislabelled', () => {
  T.setSuppress(true); const m = fresh(); const rows = m.annex['All pupils']['Phonics expected standard']; rows.find(r => !/^\d{4}/.test(r.year)).year = '3 year average';
  const an = T.analyse(T.normaliseModel(m)); assert.match(texts(an.strengths), /Y1 phonics expected 89% vs 80%/);
  assert.doesNotMatch(texts(an.strengths) + texts(an.concerns), /the IDSR's 2-year average[^.]*Writing expected/);
});

test('the vendored Word library is the file that was reviewed', async () => {
  const { createHash } = await import('node:crypto');
  const h = createHash('sha256').update(fs.readFileSync(path.join(root, 'vendor', 'docx-9.5.1.iife.js'))).digest('hex');
  assert.equal(h, 'bb2908d72ffd8a3d896b455563733d3a2e708e1384a5140e05b3c6dd0b2f676d');
});

test('overall picture: a plain count of significant results, with no adjectives', () => {
  T.setSuppress(true); const an = T.analyse(fresh());
  assert.match(an.overall, /Latest year \(15 results with a significance test\): 0 significantly above national, 0 significantly below, 15 no significant difference\./);
  assert.match(an.overall, /Multi-year average \(15 results\): 3 significantly above national, 3 significantly below, 9 no significant difference\./);
  assert.match(an.overall, /a count, not a score/); assert.doesNotMatch(an.overall, /strong|weak|good|poor|concerning|excellent/i);
  assert.doesNotMatch(texts(an.strengths) + texts(an.concerns), /of \d+ attainment measures above national/);
});
test('special schools are labelled as not yet supported and get no overall picture', () => {
  const m = fresh(); m.phase.isSpecial = true;
  assert.ok(T.validateModel(m).warn.some(w => /Special schools are not yet supported/.test(w)));
  assert.equal(T.analyse(m).overall, '');
});

test('the sample PDFs were rebuilt after the last change to the briefing', async () => {
  const { createHash } = await import('node:crypto'); const h = createHash('sha256');
  for (const f of ['questions.js', 'core.js', 'sample.js', 'idsr.html']) h.update(fs.readFileSync(path.join(root, f)));
  assert.equal(fs.readFileSync(path.join(root, 'sample-briefing.sha256'), 'utf8').trim(), h.digest('hex'), 'run: node tests/make-sample.cjs');
});
test('similar-schools comparisons are quoted as published and only when the IDSR has them', () => {
  T.setSuppress(true); let m = fresh(); let an = T.analyse(m); assert.equal(an.hasSim, false); assert.doesNotMatch(T.renderB(m, an, true), /Similar schools \(as published\)/);
  m = fresh(); const r = m.annex['All pupils']['Reading expected standard'].find(x => x.year === '2026'); r.sim = '71%'; r.simBand = { text: 'Above (non-sig)' };
  m = T.normaliseModel(m); an = T.analyse(m); const html = T.renderB(m, an, true);
  assert.equal(an.hasSim, true); assert.match(html, /Similar schools \(as published\)/); assert.match(html, /71% · Above \(non-sig\)/);
  assert.doesNotMatch(T.renderA(m, an, true), /Similar schools/);
});
test('data rows have real row headers; group rows do not', () => {
  T.setSuppress(true); const m = fresh(); const an = T.analyse(m); const html = T.renderA(m, an, true) + T.renderB(m, an, true);
  assert.ok((html.match(/<th scope="row" class="rh"/g) || []).length > 40); assert.doesNotMatch(html, /<tr><td(>| style=)/);   // evidence-trail rows start with a reference-number cell and are left as they are assert.match(html, /<tr class="grp"><td colspan/);
});
