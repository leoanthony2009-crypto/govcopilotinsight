// Rule tests for the v4 question bank: merging, compound rules, optional clauses, caps.
// No dependencies: run with  node --test tests/*.test.mjs     Every figure used here is invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = f => fs.readFileSync(path.join(root, f), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src('questions.js') + '\n' + src('core.js') + '\n' + src('sample.js') +
  '\n;globalThis.T={joinList,sortFigures,fillTemplate,pickOnePage,QUESTION_BANK,TOOLKIT,AREAS,num,bandInfo,analyse,normaliseModel,renderA,renderB,SAMPLE_MODEL,VERSION,setSuppress:v=>{SUPPRESS=v;}};', ctx);
const T = ctx.T;
const fresh = () => T.normaliseModel(JSON.parse(JSON.stringify(T.SAMPLE_MODEL)));
const row = (m, g, k, year) => m.annex[g][k].find(r => r.year === year);
const setBand = (r, school, text) => { if (school != null) { r.school = school; r.schoolN = T.num(school); } r.band = T.bandInfo(text); };
const run = m => T.analyse(T.normaliseModel(m));
const ids = an => an.questions.map(q => q.id);
const byId = (an, id) => an.questions.filter(q => q.id === id);
const one = (an, id) => { const l = byId(an, id); assert.equal(l.length, 1, `expected exactly one ${id}, got ${l.length}: ${ids(an).join(',')}`); return l[0]; };
const noWriting = m => ['Writing expected standard', 'Writing greater depth', 'Writing progress'].forEach(k => m.annex['All pupils'][k].forEach(r => setBand(r, null, 'Close to average (non-sig)')));
const isYearRow = r => /^\d{4}/.test(r.year || '');
const UNCLEAN = /undefined|null|NaN|[{}]|\[\[|\]\]| {2}| ,| \.|\.\.|\(\s*\)|,\s*[?.;]|;\s*[?.]|\s\?/;

// ---- 1. sentence assembly
test('joinList reads as natural English for one, two and three items', () => {
  assert.equal(T.joinList([]), '');
  assert.equal(T.joinList(['a']), 'a');
  assert.equal(T.joinList(['a', 'b']), 'a and b');
  assert.equal(T.joinList(['a', 'b', 'c']), 'a, b, and c');
});
test('joinList switches to semicolons when an item already contains a comma', () => {
  assert.equal(T.joinList(['reading 60% (2026, n = 30)', 'maths 61%', 'writing 50%']), 'reading 60% (2026, n = 30); maths 61%; and writing 50%');
});
test('sortFigures puts significant before non-significant, then latest year before multi-year, then catalogue order', () => {
  const out = T.sortFigures([
    { text: 'ns-avg', sig: false, avg: true, order: 1 }, { text: 'sig-avg', sig: true, avg: true, order: 5 },
    { text: 'ns-latest', sig: false, avg: false, order: 9 }, { text: 'sig-latest-b', sig: true, avg: false, order: 4 }, { text: 'sig-latest-a', sig: true, avg: false, order: 2 }]);
  assert.deepEqual(out.map(x => x.text), ['sig-latest-a', 'sig-latest-b', 'sig-avg', 'ns-latest', 'ns-avg']);
});

// ---- 3. optional clauses
test('fillTemplate keeps an optional clause when every token in it has a value', () => {
  assert.equal(T.fillTemplate('Reading was {x}[[, compared with {sim} in similar schools]]. Why?', { x: '60%', sim: '70%' }), 'Reading was 60%, compared with 70% in similar schools. Why?');
});
test('fillTemplate strips an optional clause cleanly when its token is missing, null or blank', () => {
  for (const sim of [undefined, null, '', '  ']) assert.equal(T.fillTemplate('Reading was {x}[[, compared with {sim} in similar schools]]. Why?', { x: '60%', sim }), 'Reading was 60%. Why?');
  assert.equal(T.fillTemplate('Below national[[ (a difference of {k})]]. Which pupils?', { }), 'Below national. Which pupils?');
});
test('fillTemplate returns null, never a broken sentence, when a required token is missing', () => {
  assert.equal(T.fillTemplate('Reading was {x}. Why?', {}), null);
  assert.equal(T.fillTemplate('Reading was {x}. Why?', { x: null }), null);
});
test('fillTemplate tidies spacing and punctuation left behind', () => {
  assert.equal(T.fillTemplate('A {a} , b[[ {c}]] . C?', { a: 'x' }), 'A x, b. C?');
  assert.equal(T.fillTemplate('Zero is a value: {n}.', { n: 0 }), 'Zero is a value: 0.');
});

// ---- the bank itself
test('every bank entry has an area, a toolkit theme, a priority, a question and an evidence line', () => {
  const B = T.QUESTION_BANK; assert.ok(Object.keys(B).length >= 36);
  for (const [id, e] of Object.entries(B)) {
    assert.ok(T.AREAS[e.area], `${id}: unknown area`); assert.ok(T.TOOLKIT.refs[e.ref], `${id}: unknown toolkit ref ${e.ref}`);
    assert.ok(Number.isInteger(e.pri) && e.pri >= 0 && e.pri <= 5, `${id}: priority`);
    if (e.addOn) { assert.ok(!e.ev, `${id}: an add-on sentence has no evidence line of its own`); continue; }
    assert.match(e.q, /\?$/, `${id}: must end with a question mark`); assert.ok(e.ev && e.ev.length > 10, `${id}: evidence line`);
    assert.equal(T.TOOLKIT.refs[e.ref].area.toLowerCase().slice(0, 4), T.AREAS[e.area].toLowerCase().slice(0, 4), `${id}: toolkit theme is in another area`);
  }
});
test('compound rules outrank the stand-alone rules they absorb', () => {
  const B = T.QUESTION_BANK;
  for (const id of ['I3', 'I10', 'L2', 'L6']) { assert.equal(B[id].compound, true); assert.ok(B[id].pri <= 1, `${id} priority`); }
  assert.ok(B.I3.pri < B.I1.pri && B.I10.pri <= B.B1.pri && B.L2.pri < B.L1T.pri && B.L6.pri < B.I8.pri);
});

// ---- sample school: merging
test('sample school: every question has an id, a toolkit theme and an evidence line', () => {
  const an = run(fresh()); assert.ok(an.questions.length > 0);
  for (const q of an.questions) { assert.ok(T.QUESTION_BANK[q.id], 'unknown id ' + q.id); assert.ok(q.ev, q.id + ' has no evidence line'); assert.ok(T.TOOLKIT.refs[q.ref]); }
});
test('sample school: one writing question carries all the writing evidence (was seven)', () => {
  const an = run(fresh()); const a1 = one(an, 'A1');
  assert.match(a1.q, /Writing expected 61% vs 72%, Writing greater depth 6% vs 13%, and Writing progress -1\.9 vs 0\.0/);
  assert.match(a1.q, /Writing expected 65% vs 73%/, 'latest-year figures move into the same question');
  assert.equal(byId(an, 'A3').length + byId(an, 'A3P').length, 0, 'the non-significant duplicates are suppressed');
  assert.equal(an.questions.filter(q => q.area === 'ach' && /writing/i.test(q.q)).length, 1);
});
test('sample school: fewer, merged questions than v3.5 produced (16)', () => {
  const an = run(fresh()); assert.ok(an.questions.length <= 10, ids(an).join(','));
  assert.equal(new Set(ids(an).filter(i => !/^(L1|A3)/.test(i))).size, ids(an).filter(i => !/^(L1|A3)/.test(i)).length, 'no rule fires twice');
});
test('stale or tiny prior-attainment groups do not get a question', () => {
  const an = run(fresh()); assert.equal(byId(an, 'A6').length, 0, 'sample groups are 2023 data with 6 to 12 pupils');
  const m = fresh(); for (const g of ['Low prior attainers', 'Middle prior attainers']) row(m, g, 'Writing progress', '2023').year = '2026';
  const a6 = one(run(m), 'A6'); assert.match(a6.q, /Middle prior attainers/); assert.doesNotMatch(a6.q, /Low prior attainers/, 'a group of 8 is below the minimum cohort');
});

// ---- achievement rules
test('A2: significantly below in the latest year only asks "one cohort or a pattern", and replaces A3 for that subject', () => {
  const m = fresh(); setBand(row(m, 'All pupils', 'Reading expected standard', '2026'), '60%', 'Below (sig-)');
  const an = run(m); const a2 = one(an, 'A2'); assert.match(a2.q, /Reading expected 60% vs 75%/); assert.match(a2.q, /one cohort or the start of a pattern/);
  assert.ok(!byId(an, 'A3').some(q => /Reading/.test(q.q)));
});
test('A3: one question per subject, with the gap in pupils, hidden when small numbers are hidden', () => {
  const m = fresh(); setBand(row(m, 'All pupils', 'Reading expected standard', '2026'), '65%', 'Below (non-sig)'); setBand(row(m, 'All pupils', 'Reading higher standard', '2026'), '20%', 'Below (non-sig)');
  T.setSuppress(true); let q = byId(run(m), 'A3').filter(x => /^Reading/.test(x.q)); assert.equal(q.length, 1);
  assert.match(q[0].q, /Reading expected 65% vs 75% and Reading higher 20% vs 31%/); assert.match(q[0].q, /not statistically significant/); assert.match(q[0].q, /a difference of 5 or fewer pupils/);
  T.setSuppress(false); q = byId(run(m), 'A3').filter(x => /^Reading/.test(x.q)); assert.match(q[0].q, /a difference of about 3 pupils/); T.setSuppress(true);
});
test('A3: the pupils clause disappears cleanly when the cohort is not published', () => {
  const m = fresh(); const r = row(m, 'All pupils', 'Reading expected standard', '2026'); setBand(r, '65%', 'Below (non-sig)'); r.cohort = null;
  const q = byId(run(m), 'A3').find(x => /^Reading/.test(x.q)); assert.ok(q); assert.doesNotMatch(q.q, /difference of/); assert.doesNotMatch(q.q, UNCLEAN);
});
test('A5: a sustained significant strength gets its own question, and it always makes the main list', () => {
  const an = run(fresh()); const a5 = one(an, 'A5'); assert.match(a5.q, /significantly above national/); assert.match(a5.q, /Reading progress 1\.6 vs 0\.0/);
  assert.ok(an.questionsTop.some(q => q.id === 'A5'));
});
test('A10 and the similar-schools add-on fire only when the IDSR publishes a usable similar-schools figure', () => {
  let an = run(fresh()); assert.equal(byId(an, 'A10').length, 0); assert.doesNotMatch(one(an, 'A1').q, /similar/i);
  let m = fresh(); let r = row(m, 'All pupils', 'Reading expected standard', '2026'); r.sim = '88%'; r.simBand = { text: 'Below (non-sig)' };
  let w = row(m, 'All pupils', 'Writing expected standard', '2026'); w.sim = '70%'; w.simBand = { text: 'Below (non-sig)' };
  an = run(m); assert.match(one(an, 'A10').q, /Reading expected 79% \(national 75%, similar schools 88%\)/);
  assert.match(one(an, 'A1').q, /also below the similar-schools figure \(70%\)/);
  m = fresh(); w = row(m, 'All pupils', 'Writing expected standard', '2026'); w.sim = '60%'; w.simBand = { text: 'Above (non-sig)' };
  assert.match(one(run(m), 'A1').q, /at or above the similar-schools figure \(60%\)/);
  for (const sup of ['SUPP', 'x', '', null]) { m = fresh(); r = row(m, 'All pupils', 'Reading expected standard', '2026'); r.sim = sup; w = row(m, 'All pupils', 'Writing expected standard', '2026'); w.sim = sup;
    an = run(m); assert.equal(byId(an, 'A10').length, 0); assert.doesNotMatch(one(an, 'A1').q, /similar/i); assert.doesNotMatch(one(an, 'A1').q, UNCLEAN); }
});

// ---- secondary measures (found by reading the secondary fixture's briefing)
const secRow = (school, nat, band, n = 178) => [{ year: '2025', cohort: n, school, schoolN: T.num(school), nat, natN: T.num(nat), band: { text: band }, trend: '' }];
test('secondary: "English and maths grade 5" is not mislabelled as maths, and the year is stated once', () => {
  const m = fresh(); m.staffing[4] = 'Teacher turnover was in the highest 20% of schools in 2025.';
  m.annex['All pupils']['English and maths grade 5 or above'] = secRow('36%', '45%', 'Below (sig-)'); m.annex['All pupils']['Attainment 8'] = secRow('41.2', '46.1', 'Below (sig-)');
  const an = run(m); const a2 = one(an, 'A2');
  assert.match(a2.q, /in the latest year \(2025\): Attainment 8 41\.2 vs 46\.1 \(n = 178\) and English and maths grade 5 or above 36% vs 45% \(n = 178\)\./);
  assert.match(one(an, 'L2').q, /Results in writing, Attainment 8, and English and maths grade 5 or above are significantly below national/);
});
test('secondary: Progress 8 has its own question and is not repeated in another', () => {
  const m = fresh(); m.annex['All pupils']['Progress 8'] = secRow('-0.45', '0.00', 'Below (sig-)'); m.annex['All pupils']['Attainment 8'] = secRow('41.2', '46.1', 'Below (sig-)');
  const an = run(m); one(an, 'A9'); assert.equal(an.questions.filter(q => /Progress 8/.test(q.q)).length, 1); assert.match(one(an, 'A2').q, /Attainment 8/);
});
test('a measure that is not a "standard" gets the general wording, without repeating its own name', () => {
  const m = fresh(); m.annex['All pupils']['EBacc entry'] = secRow('22%', '40%', 'Below');
  const q = one(run(m), 'A3G'); assert.match(q.q, /^EBacc entry was below national in 2025: 22% vs 40%; the IDSR gives no significance test/); assert.doesNotMatch(q.q, /did not reach the standard/);
});

// ---- 2. compound rules absorb their parts
test('I3: absence plus gap for disadvantaged pupils becomes one question; I1 and the FSM6 part of B1 are absorbed', () => {
  const m = fresh(); setBand(row(m, 'FSM6', 'Persistent absence', '2025/26 (1 term)'), '31.0%', 'Above (non-sig)');
  const an = run(m); const q = one(an, 'I3'); assert.match(q.q, /31\.0% vs 25\.3%/); assert.match(q.q, /Writing \(−24 pp\)/);
  assert.equal(byId(an, 'I1').length, 0); const b1 = one(an, 'B1'); assert.doesNotMatch(b1.q, /FSM6/); assert.match(b1.q, /pupils with SEN/);
  assert.equal(an.questions.filter(x => /31\.0%/.test(x.q)).length, 1, 'the figure appears once');
});
test('I10: SEN absence plus SEN suspensions becomes one question; SEN leaves B1 and B4', () => {
  const m = fresh(); T.setSuppress(false); setBand(row(m, 'SEN', '1 or more suspensions', '2024/25 (3 term)'), '20.00%', 'Above (non-sig)');
  const an = run(m); T.setSuppress(true); one(an, 'I10');
  assert.equal(byId(an, 'B1').length, 0, 'SEN was the only group in B1'); assert.equal(byId(an, 'B4').length, 0);
});
test('L2: a staffing flag plus a significant weakness is one question; without the weakness the plain staffing question is asked', () => {
  let m = fresh(); m.staffing[4] = 'Staff turnover is in the highest 20% of schools.';
  let an = run(m); assert.match(one(an, 'L2').q, /Staff turnover is in the highest 20% of schools/); assert.match(one(an, 'L2').q, /Results in writing are significantly below national/); assert.equal(byId(an, 'L1T').length, 0);
  m = fresh(); m.staffing[4] = 'Staff turnover is in the highest 20% of schools.'; noWriting(m);
  an = run(m); assert.equal(byId(an, 'L2').length, 0); assert.match(one(an, 'L1T').q, /Why are staff leaving/);
  m = fresh(); m.staffing[1] = 'Teacher sickness absence is in the highest 20% of schools.'; noWriting(m); assert.match(one(run(m), 'L1S').q, /How is teaching covered/);
});
test('L6: low stability plus a below-national subject is one question; the plain stability question is absorbed', () => {
  const m = fresh(); const y = m.charYears[m.charYears.length - 1]; m.characteristics['School % stability'][y].band = 'Below average';
  const an = run(m); assert.match(one(an, 'L6').q, /throughout the key stage/); assert.equal(byId(an, 'I8').length, 0);
  const m2 = fresh(); m2.characteristics['School % stability'][y].band = 'Below average'; noWriting(m2); const an2 = run(m2); one(an2, 'I8'); assert.equal(byId(an2, 'L6').length, 0);
});

// ---- other new rules
test('context and trend rules: I5, I11, B5, B7 and L5 fire on their own patterns and not on the sample school', () => {
  const base = ids(run(fresh())); for (const id of ['I5', 'I11', 'B5', 'B7', 'L5']) assert.ok(!base.includes(id), id + ' should not fire on the sample');
  const m = fresh(); const y = m.charYears[m.charYears.length - 1];
  m.characteristics['School % SEN support'][y].band = 'Above average'; m.characteristics['School % FSM6'][y].band = 'Well above average';
  m.suspensions.rows['Total number of suspensions']['2024/25 (3 term)'] = 14; m.school.type = 'Academy Converter';
  setBand(row(m, 'All pupils', 'Persistent absence', '2025/26 (1 term)'), '6.0%', 'Below (sig-)');
  const an = run(m); for (const id of ['I5', 'I11', 'B5', 'B7', 'L5']) one(an, id);
  assert.match(one(an, 'B5').q, /7 → 9 → 14/); assert.match(one(an, 'I5').q, /SEN support \(14\.3%\)/);
});
test('B1 merges every group above national into one question and says when absence is rising', () => {
  const m = fresh(); const r = row(m, 'All pupils', 'Persistent absence', '2025/26 (1 term)'); setBand(r, '20.0%', 'Above (sig+)'); r.trend = 'Sig increase';
  const q = one(run(m), 'B1'); assert.match(q.q, /all pupils \(20\.0% vs 14\.4%\) and pupils with SEN \(29\.7% vs 22\.9%\)/); assert.match(q.q, /rising significantly/); assert.equal(q.pri, 1);
});

// ---- caps
test('the full briefing leads with at most 10 questions; the rest are further prompts', () => {
  const m = fresh(); const y = m.charYears[m.charYears.length - 1];
  ['School % SEN support', 'School % EAL', 'School % CIN'].forEach(k => { if (m.characteristics[k]) m.characteristics[k][y].band = 'Above average'; });
  m.characteristics['School % FSM6'][y].band = 'Well above average'; m.school.type = 'Academy Converter'; m.suspensions.rows['Total number of suspensions']['2024/25 (3 term)'] = 14;
  setBand(row(m, 'All pupils', 'Reading expected standard', '2026'), '65%', 'Below (non-sig)'); setBand(row(m, 'All pupils', 'Maths expected standard', '2026'), '65%', 'Below (non-sig)');
  const an = run(m); assert.ok(an.questions.length > 10, 'this school should trigger more than 10: ' + an.questions.length);
  assert.equal(an.questionsTop.length, 10); assert.equal(an.questionsTop.length + an.questionsMore.length, an.questions.length);
  assert.ok(an.questionsTop.some(q => T.QUESTION_BANK[q.id].strength), 'one strength question is always kept');
  const html = T.renderB(m, an, true); assert.match(html, /Further prompts/); assert.match(html, /Evidence to expect/);
});
test('the one-page briefing takes questions in priority order but no more than two from one area', () => {
  const qs = ['ach', 'ach', 'ach', 'att', 'inc'].map((area, i) => ({ id: 'X' + i, area, pri: i }));
  assert.deepEqual(T.pickOnePage(qs, 4).map(q => q.id), ['X0', 'X1', 'X3', 'X4']);
  assert.deepEqual(T.pickOnePage(qs, 2).map(q => q.id), ['X0', 'X1']);
  assert.deepEqual(T.pickOnePage(qs.slice(0, 3), 3).map(q => q.id), ['X0', 'X1', 'X2'], 'the cap gives way when nothing else is left');
});
test('the one-page briefing uses the short form of a long question; the full briefing keeps the full form', () => {
  const m = fresh(); const w = row(m, 'All pupils', 'Writing expected standard', '2026'); w.sim = '70%'; w.simBand = { text: 'Below (non-sig)' };
  const an = run(m); const a1 = one(an, 'A1'); assert.ok(a1.brief && a1.brief.length < a1.q.length * 0.6, 'A1 needs a short form');
  assert.match(a1.brief, /Writing expected 61% vs 72%/); assert.doesNotMatch(a1.brief, /Latest year|similar-schools/);
  const A = T.renderA(m, an, true).replace(/<[^>]+>/g, ' '), B = T.renderB(m, an, true).replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(A, /Latest year: Writing|Evidence to expect/); assert.match(B, /Latest year: Writing/); assert.match(B, /similar-schools figure \(70%\)/);
  for (const [id, e] of Object.entries(T.QUESTION_BANK)) if (e.brief) { assert.match(e.brief, /\?$/, id); assert.ok(e.brief.length < e.q.length, id + ': the short form must be shorter'); }
});
test('questions still follow priority order', () => {
  const pris = run(fresh()).questions.map(q => q.pri); assert.equal(JSON.stringify(pris), JSON.stringify([...pris].sort((a, b) => a - b)));
});

// ---- audit: no broken sentence in any combination
test('audit: across hundreds of data combinations no question or evidence line is malformed', () => {
  const BANDS = ['Well below (sig-)', 'Below (sig-)', 'Below (non-sig)', 'Below', 'Close to average (sig-)', 'Close to average (non-sig)', 'Above (non-sig)', 'Above (sig+)', 'Well above (sig+)', 'No data', ''];
  const SIMS = [[undefined, undefined], ['SUPP', ''], ['70%', 'Below (non-sig)'], ['99%', 'Below (sig-)'], ['1%', 'Above (non-sig)'], ['x', 'No data'], ['55%', '']];
  const CTX = ['Well below average', 'Below average', 'Close to average', 'Above average', 'Well above average', null];
  let seed = 7; const rnd = n => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) % n; };   // mulberry32: fixed seed, so every run checks the same combinations
  let checked = 0; const fired = new Set();
  for (let i = 0; i < 600; i++) {
    const m = fresh(); T.setSuppress(i % 2 === 0);
    for (const g of Object.keys(m.annex)) for (const k of Object.keys(m.annex[g])) for (const r of m.annex[g][k]) {
      if (rnd(3) === 0) r.band = { text: BANDS[rnd(BANDS.length)] };
      if (rnd(9) === 0) r.cohort = [null, 0, 3, 8, 11, 200][rnd(6)];
      if (rnd(11) === 0) { r.school = 'SUPP'; r.schoolN = null; }
      if (rnd(13) === 0) { r.nat = 'x'; r.natN = null; }
      if (rnd(6) === 0) { const s = SIMS[rnd(SIMS.length)]; r.sim = s[0]; r.simBand = s[1] == null ? undefined : { text: s[1] }; }
      if (isYearRow(r) && /prior attainers/.test(g) && rnd(4) === 0) r.year = '2026';
      if (rnd(15) === 0) r.trend = ['Sig increase', 'Relative decline', 'Relative improvement', ''][rnd(4)];
      if (r.gap != null && rnd(8) === 0) { r.gap = 'x'; r.gapN = null; }
    }
    if (i % 3 === 2) {   // a school with no weak results, so the stand-alone rules that compound rules absorb are exercised too
      const CALM = ['Close to average (non-sig)', 'Above (non-sig)', 'Above (sig+)'];
      for (const g of Object.keys(m.annex)) for (const k of Object.keys(m.annex[g])) if (!/attendance|absence|suspension/i.test(k)) for (const r of m.annex[g][k]) { r.band = { text: CALM[rnd(3)] }; if (r.gap != null) { r.gap = '3'; r.gapN = 3; if (r.schoolN != null && r.natOtherN != null) { r.natOtherN = r.schoolN - 3; r.natOther = String(r.natOtherN); } } }
    }
    for (const by of Object.values(m.characteristics)) for (const c of Object.values(by)) { if (rnd(3) === 0) c.band = CTX[rnd(CTX.length)]; if (rnd(10) === 0) c.value = null; }
    if (rnd(3) === 0) m.staffing[rnd(m.staffing.length)] = ['Staff turnover is in the highest 20% of schools.', 'Teacher sickness absence is in the highest 20% of schools', 'The proportion of education support staff is low.'][rnd(3)];
    if (rnd(4) === 0) m.staffing = [];
    if (rnd(3) === 0) m.suspensions.rows['Total number of suspensions']['2024/25 (3 term)'] = [null, 0, 3, 14, 60][rnd(5)];
    if (rnd(5) === 0) m.suspensions = null;
    if (rnd(3) === 0) m.exclusions.rows['Total number of permanent exclusions']['2024/25 (3 term)'] = [1, 2, 7][rnd(3)];
    if (rnd(3) === 0) m.ap = ['2 pupils were placed in alternative provision.'];
    if (rnd(4) === 0) m.school.type = ['Academy Converter', 'Academy Sponsor Led', 'Free School', ''][rnd(4)];
    if (rnd(7) === 0) m.phase.isSpecial = true;
    if (rnd(7) === 0) delete m.annex['Disadvantaged pupils'];
    if (rnd(9) === 0) m.sen.needs = [];
    if (rnd(9) === 0) m.eyfs = {};
    let an; assert.doesNotThrow(() => { an = run(m); }, 'analyse threw on combination ' + i);
    assert.ok(an.questionsTop.length <= 10);
    for (const q of an.questions) { fired.add(q.id); checked++;
      assert.doesNotMatch(q.q, UNCLEAN, `combination ${i}, ${q.id}: ${q.q}`); assert.match(q.q, /\?$/, `combination ${i}, ${q.id}: ${q.q}`); assert.match(q.q, /^[A-Z0-9"]/, `${q.id}: ${q.q}`);
      assert.ok(q.ev && !UNCLEAN.test(q.ev), `${q.id} evidence`); assert.ok(q.brief && !UNCLEAN.test(q.brief) && /\?$/.test(q.brief), `combination ${i}, ${q.id} short form: ${q.brief}`); assert.ok(T.TOOLKIT.refs[q.ref]); }
    const seen = ids(an).filter(x => !/^(L1|A3)/.test(x));   // L1 is asked per workforce flag, A3 per subject assert.equal(new Set(seen).size, seen.length, `combination ${i}: a rule fired twice: ${seen.join(',')}`);
    if (seen.includes('I3')) assert.ok(!seen.includes('I1'), 'I3 must absorb I1');
    if (seen.includes('L2')) assert.ok(!ids(an).some(x => /^L1/.test(x)), 'L2 must absorb L1');
    if (seen.includes('L6')) assert.ok(!seen.includes('I8'), 'L6 must absorb I8');
    const html = T.renderB(m, an, true) + T.renderA(m, an, true); assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /undefined|NaN|\[\[|\]\]|\{[a-zA-Z]+\}/, 'combination ' + i);
  }
  T.setSuppress(true);
  assert.ok(checked > 3000, 'too few questions checked: ' + checked);
  const never = Object.keys(T.QUESTION_BANK).filter(id => !T.QUESTION_BANK[id].addOn && !fired.has(id) && !['A9', 'A3G', 'C1'].includes(id));
  assert.deepEqual(never, [], 'bank entries the audit never exercised');
});
test('version is 4.0 and the question bank is its own file', () => {
  assert.match(T.VERSION, /^4\.0 /); assert.match(src('idsr.html'), /<script src="\/questions\.js"><\/script>\s*<script src="\/core\.js"><\/script>/);
});
