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
  fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sample.js'), 'utf8') +
  '\n;globalThis.T={num,bandInfo,judge,analyse,normaliseModel,validateModel,latest,termNote,fmtGap,renderA,renderB,SAMPLE_MODEL,TESTED_RELEASES,setSuppress:v=>{SUPPRESS=v;}};', ctx);
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
  vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'sample.js'), 'utf8') + '\n;globalThis.X={TOOLKIT,AREAS,refFor,analyse,normaliseModel,renderB,SAMPLE_MODEL};', ctx2);
  const X = ctx2.X; const m = X.normaliseModel(JSON.parse(JSON.stringify(X.SAMPLE_MODEL))); const an = X.analyse(m);
  for (const q of an.questions) { assert.ok(q.ref && X.TOOLKIT.refs[q.ref], 'no toolkit reference for: ' + q.q); }
  assert.equal(X.refFor('att', 'Suspension rates for all pupils are above national.'), 'att_beh');
  assert.equal(X.refFor('att', 'Attendance for all pupils is 93% against 95% nationally.'), 'att_lead');
  assert.equal(X.refFor('inc', 'How is pupil premium funding being used for these pupils?'), 'inc_dis');
  assert.equal(X.refFor('ach', 'Writing progress was below national in 2026.'), 'ach_prog');
  assert.equal(X.refFor('ach', 'Reading – expected was below national in 2026.'), 'ach_nat');
  const html = X.renderB(m, an, true);
  assert.match(html, /What the toolkit looks for \(paraphrased\)/); assert.match(html, /\[Toolkit: Achievement: Inclusive achievement/);
  assert.match(html, /State-funded school inspection toolkit, v2\.0/);
});
