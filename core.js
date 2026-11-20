const VERSION='4.0 (November 2026)';
/* IDSR releases this version has been checked against. An IDSR released after the last one still loads, with a warning. */
const TESTED_RELEASES=['25 September 2026'];
/* Ofsted suppresses cohorts of 5 or fewer in the IDSR; this tool uses the same line for small counts. */
const SMALL=5;
let SUPPRESS=true;                      // set by the app from the "Hide small numbers" box before analyse/render/export
const cnt=n=>n==null?'–':(SUPPRESS&&n>0&&n<=SMALL?`${SMALL} or fewer`:String(n));
 /* A percentage printed beside its cohort size gives the count away (2.50% of 40 pupils is 1 pupil). For the sensitive
   measures (persistent absence and suspensions) the figure is withheld when it implies 5 or fewer pupils. */
const HIDDEN_PCT='5 or fewer pupils';
const fewPupils=r=>{ if(!SUPPRESS||!r||!r.cohort||r.schoolN==null) return false; const k=Math.round(r.schoolN*r.cohort/100); return k>0&&k<=SMALL; };
const maskFew=r=>fewPupils(r)?Object.assign({},r,{school:HIDDEN_PCT,schoolN:null,band:null,trend:'',masked:true}):r;
const safeKey=k=>!/^(__proto__|constructor|prototype)$/.test(String(k));
const UNREAD=[];                        // examples of cell texts that could not be read as a number in the last parse
let UNREAD_N=0;                         // how many cells that happened to
/* ============================================================
   1. PARSER — reads the Ofsted IDSR HTML (GOV.UK template)
   ============================================================ */
const clean=s=>(s||'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
const normMinus=s=>String(s).replace(/[\u2212\u2012\u2013\u2014\uFE63\uFF0D]/g,'-');
const SUPPRESSED_RE=/^(|R|S|x|c|z|u|SUPP|Suppressed|Redacted|NA|N\/A|NE|-|\.\.|:|LOWCOV|NP|Not available|Not applicable|No data|Small cohort|Low entries|Low coverage)$/i;
/* Strict number reader. A suppressed marker is "no value". Anything that is not one plain number ("<5", "1 to 4",
   "10-14") is also "no value" and is recorded, so a marker can never turn into a figure. */
/* Footnote markers after a figure ("83% *", "62%¹", "71% (provisional)") are dropped for reading and for display. */
const unmark=s=>s==null?s:String(s).replace(/\u00a0/g,' ').trim().replace(/\s*(\((provisional|revised|final|unvalidated|validated)\)|\[\w{1,3}\]|[*\u2020\u2021\u00a7\u00b9\u00b2\u00b3\u2074-\u2079]+)\s*$/i,'').trim();
const num=s=>{ if(s==null) return null; const t=unmark(normMinus(s)); if(SUPPRESSED_RE.test(t)) return null;
  const m=t.replace(/(\d),(?=\d{3}\b)/g,'$1').match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|pp|days?|pupils?)?$/i);
  if(!m){ UNREAD_N++; if(UNREAD.length<5&&!UNREAD.includes(t.slice(0,40))) UNREAD.push(t.slice(0,40)); return null; }
  return parseFloat(m[1]); };
const isYear=s=>/^\d{4}/.test(s||'');

/* The IDSR publishes two separate things: a BAND (where the school sits in the national distribution) and, for most
   measures, a SIGNIFICANCE test against the national figure (sig+ / sig- / non-sig). They are kept apart here:
     band = -2..2   well below / below / close to average / above / well above
     sig  = '+' | '-' | null
     dir  = the direction headlines use: the significance sign when there is one, otherwise the band.
   So "Close to average (sig+)" is significantly ABOVE national (dir 2), never "below". */
function bandInfo(text){
  const t=normMinus(text||'').toLowerCase();
  if(!t||/no data|not available|not applicable|small cohort|suppressed|low entries|^-$/.test(t)) return null;
  const sig=/sig\s*\+/.test(t)?'+':/sig\s*-/.test(t)?'-':null;
  let band=null;
  if(/well above/.test(t)) band=2; else if(/well below/.test(t)) band=-2;
  else if(/above/.test(t)) band=1; else if(/below/.test(t)) band=-1;
  else if(/close|in line|average/.test(t)) band=0;
  if(band===null) return null;
  const dir=sig==='+'?2:sig==='-'?-2:band;
  return {dir,band,sig,text:clean(text)};
}

/* A banding in plain words for a sentence: "Below average (sig-)" becomes "below average, and statistically significantly below national". */
function bandWords(b){ const base=clean(b.text).replace(/\s*\((?:non-?\s*)?sig\s*[+-]?\)\s*/i,' ').trim().toLowerCase(); return base+(b.sig?`, and statistically significantly ${b.sig==='+'?'above':'below'} national`:''); }

function parseIDSR(htmlString){
  UNREAD.length=0; UNREAD_N=0;
  if(/^\s*%PDF/.test(htmlString)) throw new Error('This is the PDF version. On the IDSR site choose "Download this page" or save the page as "Webpage, HTML only", then choose that .html file here.');
  const doc=new DOMParser().parseFromString(htmlString,'text/html');
  doc.querySelectorAll('script,style,nav,header.govuk-header').forEach(e=>e.remove());
  doc.querySelectorAll('details').forEach(d=>{ const sum=clean((d.querySelector('summary')||{}).textContent); if(!/^(Chart|Table)$/i.test(sum)) d.remove(); });
  const fullText=clean(doc.body.textContent);
  if(!/Inspection Data Summary Report/i.test(fullText)) throw new Error('This file does not look like an Ofsted IDSR. Download the IDSR page from the Ofsted IDSR site as HTML and try again.');

  const top=fullText.slice(0,20000);
  const school={
    name:clean((doc.querySelector('h1')||{}).textContent)||'School',
    urn:(top.match(/URN:\s*(\d{5,7})/)||[])[1]||'',
    la:(top.match(/Local authority:\s*(.+?)\s+Phase of education/)||[])[1]||'',
    phase:(top.match(/Phase of education:\s*(.+?)\s+Type of\s*education/)||[])[1]||'',
    type:(top.match(/Type of\s*education:\s*(.+?)\s+(Ofsted:|Trust)/)||[])[1]||'',
    release:(top.match(/Release date:\s*(\d{1,2}\s+\w+\s+\d{4})/)||[])[1]||'',
    msoa:clean((top.match(/School local area \(MSOA\) = (.{3,40}?)(?= \d{4} \d{4}| School number)/)||[])[1]||''),
  };

  const tables=[],paras=[],h2s=[];
  let heading='',h2='';
  doc.body.querySelectorAll('h1,h2,h3,h4,table,p,li').forEach(el=>{
    const tag=el.tagName;
    if(/^H[1-4]$/.test(tag)){ heading=clean(el.textContent); if(tag==='H2'){h2=heading;h2s.push(heading);} return; }
    if(tag==='P'||tag==='LI'){ if(tag==='LI'&&(el.closest('.govuk-tabs__list')||el.closest('table'))) return; const t=clean(el.textContent).replace(/\s*Back to (contents|top)\s*$/i,''); if(t) paras.push({heading,h2,text:t}); return; }
    const ths=[...el.querySelectorAll('thead th')].map(th=>clean(th.textContent));
    const rows=[];
    el.querySelectorAll('tbody tr').forEach(tr=>{ const cells=[...tr.children]; if(!cells.length) return; const row={_cells:cells.map(c=>clean(c.textContent))}; cells.forEach(c=>{ const id=clean(c.getAttribute('headers')||''); if(id&&row[id]==null) row[id]=clean(c.textContent); }); rows.push(row); });
    tables.push({heading,h2,ths,rows});
  });

  // phase detection from section headings
  const achievementH2s=h2s.filter(h=>/achievement/i.test(h));
  const isSpecial=/special/i.test(school.type)||/special/i.test(school.phase);
  const hasKS4=achievementH2s.some(h=>/key stage 4/i.test(h)), hasKS2=achievementH2s.some(h=>/key stage 2|phonics/i.test(h)), has16=achievementH2s.some(h=>/16 to 18|sixth/i.test(h));

  const characteristics=Object.create(null); let charYears=[];
  const charT=tables.find(t=>/School characteristics/i.test(t.heading)&&t.rows.some(r=>r.measure!=null&&r.banding_1!=null));
  if(charT){ charYears=charT.ths.filter(x=>/^\d{4}$/.test(x));
    charT.rows.forEach(r=>{ if(r.measure==null) return; const name=r.measure.replace(/\*$/,'').trim(); const byYear={};
      [1,2,3,4].forEach(i=>{ const c=r['banding_'+i]; if(c==null) return; const y=charYears[i-1]; if(!y) return; const bm=c.match(/well above average|well below average|above average|below average|close to average/i); const b=bandInfo(bm?bm[0]:''); const v=num(c.replace(/well above average|well below average|above average|below average|close to average/ig,'')); byYear[y]={band:bm?bm[0]:null,dir:b?b.dir:null,value:v}; });
      characteristics[name]=byYear; }); }

  const yearGroups=[]; const ygT=tables.find(t=>t.rows.some(r=>r.yeargroup!=null&&r.number_on_roll!=null));
  if(ygT) ygT.rows.forEach(r=>{ if(r.yeargroup) yearGroups.push({yg:r.yeargroup,nor:num(r.number_on_roll),fsm6:num(r.percent_fsm6),eal:num(r.percent_eal),yc:num(r.number_young_carers),cin:num(r.number_cin),cla:num(r.number_cla)}); });

  const sen={support:null,ehcp:null,needs:[]};
  tables.filter(t=>t.rows.some(r=>r.primary_need!=null)).forEach(t=>{ const head=t.ths.join(' '); const isE=/EHC/i.test(head); const m=head.match(/(SEN support|EHC plan)\s*\((\d+)\)/i); if(m){ if(isE) sen.ehcp=+m[2]; else sen.support=+m[2]; }
    t.rows.forEach(r=>{ if(r.primary_need&&!/totals/i.test(r.primary_need)) sen.needs.push({need:r.primary_need,n:num(r.total),type:isE?'EHCP':'SEN support'}); }); });
  const senParas=paras.filter(p=>p.heading==='SEN').map(p=>p.text);
  sen.resourced=clean(((senParas.find(p=>/resourced provision|SEN provision/i.test(p))||'').match(/provision:\s*(.+?)(?=\s+Number of|$)/i)||[])[1]||'');
  sen.alsoFsmCla=num((senParas.find(p=>/also FSM6/i.test(p))||'').split(':').pop());

  const ethnicity=[]; const ethT=tables.find(t=>t.rows.some(r=>r.pupilgroup!=null&&r.value_whole_school!=null));
  if(ethT) ethT.rows.forEach(r=>{ if(r.pupilgroup) ethnicity.push({group:r.pupilgroup,school:num(r.value_whole_school),nat:num(r.value_nat_whole_school)}); });

  const staffing=paras.filter(p=>p.heading==='Staffing'&&!/^Data source|^Back to/i.test(p.text)).map(p=>p.text);

  const ygAbsence={}; const ygaT=tables.find(t=>t.rows.some(r=>r.overall_absence_band!=null));
  if(ygaT){ ygAbsence.years=ygaT.ths.filter(x=>/^Y\d+$|^R$/.test(x)); ygaT.rows.forEach(r=>{ const o={}; ygAbsence.years.forEach(y=>o[y]=num(r[y])); ygAbsence[r.overall_absence_band]=o; }); }

  function totalsTable(pred){ const t=tables.find(t=>t.rows.some(r=>r.measure_type!=null&&pred(r.measure_type))); if(!t) return null; const yrs=t.ths.filter(x=>/\d{4}\/\d{2}/.test(x)); const out={years:yrs,rows:{}}; t.rows.forEach(r=>{ const vals={}; yrs.forEach((y,i)=>vals[y]=num(r._cells[i+1])); out.rows[r.measure_type]=vals; }); return out; }
  const suspensions=totalsTable(m=>/suspensions/i.test(m)), exclusions=totalsTable(m=>/permanent exclusions/i.test(m));
  const reasonTables=tables.filter(t=>t.rows.some(r=>r.reason!=null));
  const reasons=t=>{ if(!t) return []; const yrs=t.ths.filter(x=>/\d{4}\/\d{2}/.test(x)); return t.rows.map(r=>{ const o={reason:r.reason,byYear:{}}; yrs.forEach((y,i)=>o.byYear[y]=num(r._cells[i+1])); return o; }); };
  const nextReasons=pred=>{ const i=tables.findIndex(t=>t.rows.some(r=>r.measure_type!=null&&pred(r.measure_type))); if(i<0) return []; const nt=tables.slice(i+1).find(t=>t.rows.some(r=>r.reason!=null)||t.rows.some(r=>r.measure_type!=null)); return nt&&nt.rows.some(r=>r.reason!=null)?reasons(nt):[]; };
  if(suspensions) suspensions.reasons=nextReasons(m=>/suspensions/i.test(m)); if(exclusions) exclusions.reasons=nextReasons(m=>/permanent exclusions/i.test(m));
  const apParas=paras.filter(p=>/Links to AP/i.test(p.heading)&&!/^Data source|^Back to/i.test(p.text)).map(p=>p.text);

  const annex=Object.create(null), measureSection=Object.create(null);
  /* Template fingerprint: how many measure tables were found, and how many of them were missing a column we rely on. */
  const schema={candidates:0,tables:0,noValue:0,noNat:0,noBand:0,noCohort:0,disTables:0,noGap:0};
  const has=(t,k)=>t.rows.some(r=>r[k]!==undefined);
  tables.forEach(t=>{ const m=t.heading.match(/^(.+?)\s[-–]\s(.+)$/); if(!m) return; schema.candidates++; if(!t.rows.some(r=>r.datayear!=null)) return;
    schema.tables++; if(!has(t,'value_rounded')) schema.noValue++; if(!has(t,'nat_value_rounded')) schema.noNat++; if(!has(t,'banding_table_text')) schema.noBand++; if(!has(t,'cohort')) schema.noCohort++;
    if(/^Disadvantaged/i.test(m[1])){ schema.disTables++; if(!has(t,'dis_gap_rounded')) schema.noGap++; }
    let group=m[1].trim(), measure=m[2].trim().replace(/^Reading, writing and maths/i,'RWM');
    group=group.replace(/^Disadvantaged$/,'Disadvantaged pupils').replace(/^FSM6?$/,'FSM6');
    const rows=t.rows.filter(r=>r.datayear).map(r=>({year:r.datayear,cohort:num(r.cohort),school:unmark(r.value_rounded),schoolN:num(r.value_rounded),nat:unmark(r.nat_value_rounded),natN:num(r.nat_value_rounded),band:bandInfo(r.banding_table_text),trend:r.trend_text||'',sim:r.sim_sch_value_rounded,simBand:bandInfo(r.sim_sch_banding_table_text),ctx:r.above_average_school_characteristics_table_text||'',natOther:unmark(r.other_nat_value_rounded),natOtherN:num(r.other_nat_value_rounded),gap:unmark(r.dis_gap_rounded),gapN:num(r.dis_gap_rounded)}));
    if(!safeKey(group)||!safeKey(measure)) return;
    annex[group]=annex[group]||Object.create(null);
    if(measureSection[measure]&&measureSection[measure]!==t.h2&&!/attendance|behaviour/i.test(t.h2)){ const tag=(t.h2.match(/key stage \d|16 to 18|phonics/i)||[t.h2])[0].toLowerCase(); measure=`${measure} (${tag})`; }
    measureSection[measure]=measureSection[measure]||t.h2;
    if(annex[group][measure]){ const seen=new Set(annex[group][measure].map(r=>r.year)); rows.forEach(r=>{ if(!seen.has(r.year)) annex[group][measure].push(r); }); } else annex[group][measure]=rows; });

  const provisional=paras.filter(p=>/achievement/i.test(p.h2)&&/provisional (\d{4})/i.test(p.text)).map(p=>p.text.match(/provisional (\d{4})/i)[1]);
  const eyfs=Object.create(null); const eyT=tables.find(t=>/EYFS/i.test(t.heading)&&t.rows.some(r=>r.measure!=null&&r.value_rounded!=null));
  if(eyT) eyT.rows.forEach(r=>{ if(r.measure) eyfs[r.measure]=num(r.value_rounded); });

  return normaliseModel({school,provisional:[...new Set(provisional)],phase:{isSpecial,hasKS2,hasKS4,has16,achievementH2s},charYears,characteristics,yearGroups,sen,ethnicity,staffing,ygAbsence,suspensions,exclusions,ap:apParas,annex,measureSection,eyfs,schema,unread:UNREAD.slice(),unreadCount:UNREAD_N,generated:new Date().toISOString()});
}

/* One place that puts any model (parsed or the built-in example) into the shape the analysis relies on:
   bandings re-read from their published text, and rows ordered multi-year average first, then newest year first. */
const yearKey=y=>isYear(y)?parseInt(y,10):-1;
function normaliseModel(m){
  Object.values(m.annex||{}).forEach(ms=>Object.keys(ms).forEach(k=>{
    ms[k].forEach(r=>{ if(r.band&&r.band.text!=null) r.band=bandInfo(r.band.text); if(r.simBand&&r.simBand.text!=null) r.simBand=bandInfo(r.simBand.text); });
    ms[k]=ms[k].map((r,i)=>({r,i})).sort((a,b)=>(yearKey(b.r.year)-yearKey(a.r.year))||(a.i-b.i)).map(x=>x.r);
    const avgs=ms[k].filter(r=>!isYear(r.year)); ms[k]=avgs.concat(ms[k].filter(r=>isYear(r.year)));
  }));
  Object.values(m.characteristics||{}).forEach(by=>Object.values(by).forEach(c=>{ if(c&&c.band){ const b=bandInfo(c.band); c.dir=b?b.band:null; } }));
  ['suspensions','exclusions'].forEach(k=>{ if(m[k]&&m[k].years) m[k].years=m[k].years.map((y,i)=>({y,i})).sort((a,b)=>(yearKey(a.y)-yearKey(b.y))||(a.i-b.i)).map(x=>x.y); });
  return m;
}

/* Fail loudly. Returns {fatal:[...], warn:[...]}; a fatal problem means no briefing is produced. */
function validateModel(m){
  const fatal=[],warn=[]; const s=m.schema; const special=m.phase&&m.phase.isSpecial;
  const all=(m.annex||{})['All pupils']||{}; const bandedRows=Object.values(all).reduce((a,rows)=>a+rows.filter(r=>r.band).length,0);
  if(s){
    if(!special&&s.tables===0) fatal.push(s.candidates?'The measure tables were found but their columns could not be matched.':'No measure tables were found.');
    if(s.tables&&s.noValue===s.tables) fatal.push('The school-value column was not found in any table.');
    if(s.tables&&s.noNat===s.tables) fatal.push('The national-comparison column was not found in any table.');
    if(!special&&s.tables&&s.noBand===s.tables) fatal.push('The banding column was not found in any table.');
    if(!fatal.length){
      if(s.noBand) warn.push(`${s.noBand} of ${s.tables} measure tables had no banding column and were read without a national banding.`);
      if(s.noNat) warn.push(`${s.noNat} of ${s.tables} measure tables had no national-comparison column.`);
      if(s.noCohort) warn.push(`${s.noCohort} of ${s.tables} measure tables had no pupil-count column, so n is missing for those measures.`);
      if(s.disTables&&s.noGap===s.disTables) warn.push('Disadvantaged tables were found but their gap column could not be read; the disadvantaged comparison is not shown.');
    }
  }
  if(!special&&!fatal.length&&bandedRows===0) fatal.push('No national comparisons could be read for a mainstream school.');
  if(m.unreadCount){ const n=m.unreadCount; warn.push(`${n} cell${n>1?'s':''} held something that is not a plain number (for example ${m.unread.map(x=>`"${x}"`).join(', ')}) and ${n>1?'were':'was'} treated as not available, not as a figure. Check those figures in the IDSR.`); }
  const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const day=s=>{ const t=String(s||''); let x=t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{4})/); if(x){ const mo=MONTHS.findIndex(mn=>mn.startsWith(x[2].toLowerCase().slice(0,3))); return mo<0?NaN:(+x[3])*10000+(mo+1)*100+(+x[1]); } x=t.match(/(\d{4})-(\d{2})-(\d{2})/); if(x) return (+x[1])*10000+(+x[2])*100+(+x[3]); x=t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(x) return (+x[3])*10000+(+x[2])*100+(+x[1]); return NaN; };
  const rel=day(m.school&&m.school.release); const last=Math.max(...TESTED_RELEASES.map(day));
  if(!special&&m.phase&&m.phase.hasKS4&&!m.phase.hasKS2) warn.push('Secondary IDSRs have had little testing with this tool. Check each figure against the IDSR before sharing this briefing.');
  if(special) warn.push('Special schools are not yet supported. The IDSR publishes no national comparisons for them, so this briefing shows context, attendance and pupil profile only and has no achievement headlines.');
  if(isNaN(rel)) warn.push(`The IDSR's release date could not be read, so it cannot be confirmed that this is a release this version was checked against (${TESTED_RELEASES[TESTED_RELEASES.length-1]}). Check every figure against the IDSR.`);
  if(!isNaN(rel)&&rel>last) warn.push(`This IDSR was released on ${m.school.release}, after the latest release this version was checked against (${TESTED_RELEASES[TESTED_RELEASES.length-1]}). Ofsted may have changed the layout: check every figure against the IDSR.`);
  return {fatal,warn};
}

/* ============================================================
   2. ANALYSIS — generic across phases
   ============================================================ */
const BEHAV_RE=/attendance|absence|absent|suspension|exclusion/i;
const PROG_RE=/progress|value added|\bVA\b/i;
const LOWER_BETTER_RE=/absence|absent|suspension|exclusion/i;
/* Only measures recognised here are treated as "higher is better" achievement measures. Anything else found in the
   IDSR is left out of the headlines and listed under "check manually", so an unfamiliar measure cannot be misread. */
const ACH_RE=/expected standard|higher standard|greater depth|MTC|multiplication|phonics|attainment 8|progress|value added|\bVA\b|grade [3-9]|EBacc|English and maths|average point|\bAPS\b|destination|retention|entries|entered|good level of development/i;
const CATALOGUE=[ // [annex name regex, display, exec short]
  [/^RWM expected standard$/i,'Reading, writing & maths – expected','RWM expected'],[/^RWM higher standard$/i,'Reading, writing & maths – higher','RWM higher'],
  [/^Reading expected standard$/i,'Reading – expected','Reading expected'],[/^Reading higher standard$/i,'Reading – higher','Reading higher'],
  [/^Writing expected standard$/i,'Writing – expected','Writing expected'],[/^Writing greater depth$/i,'Writing – greater depth','Writing greater depth'],
  [/^Maths expected standard$/i,'Maths – expected','Maths expected'],[/^Maths higher standard$/i,'Maths – higher','Maths higher'],
  [/^EGPS expected standard$/i,'Grammar, punctuation & spelling – expected','GPS expected'],[/^EGPS higher standard$/i,'Grammar, punctuation & spelling – higher','GPS higher'],
  [/^Year 4 MTC score$/i,'Year 4 multiplication check – mean score (of 25)','Y4 times tables (of 25)'],[/^Phonics expected standard$/i,'Year 1 phonics – expected standard','Y1 phonics expected'],
  [/attainment 8/i,null,null],[/grade 5/i,null,null],[/grade 4/i,null,null],[/EBacc/i,null,null],[/progress 8/i,null,null],
  [/^Reading progress$/i,'Reading progress','Reading progress'],[/^Writing progress$/i,'Writing progress','Writing progress'],[/^Maths progress$/i,'Maths progress','Maths progress'],
];
const AREAS={ach:'Achievement',inc:'Inclusion',att:'Attendance & behaviour',lead:'Leadership & governance',cur:'Curriculum & teaching',ey:'Early years'};
/* Each question is tied to a theme of Ofsted's toolkit. "gist" is a short PARAPHRASE of the expected standard for that
   theme, written for this tool; it is not Ofsted's wording and must be re-checked whenever the toolkit is updated.
   Leadership and governance is cited by area only. Safeguarding and personal development and wellbeing are not
   evidenced by IDSR data, so no questions are generated for them. */
const TOOLKIT={title:'Ofsted, State-funded school inspection toolkit, v2.0 (June 2026), for use on inspections from 7 September 2026. Contains public sector information licensed under the Open Government Licence v3.0',refs:{
  ach_nat:{area:'Achievement',theme:'Inclusive achievement: national tests and examinations',gist:'achievement in national tests and examinations is typically broadly in line with national averages'},
  ach_prog:{area:'Achievement',theme:'Inclusive achievement: across the curriculum',gist:"disadvantaged pupils, pupils with SEND, pupils known to children's social care and others generally make suitable progress from their starting points"},
  ach_found:{area:'Achievement',theme:'Foundational knowledge',gist:'pupils largely secure accurate, fluent reading, spelling, handwriting and number facts early, and gaps close quickly'},
  ach:{area:'Achievement',theme:'',gist:''},
  inc_id:{area:'Inclusion',theme:'Identifying, assessing and meeting needs, and reducing barriers',gist:"leaders identify needs, including emerging needs, quickly and accurately and work with families; any alternative provision is commissioned appropriately and used in pupils' best interests"},
  inc_dis:{area:'Inclusion',theme:'Supporting disadvantaged pupils',gist:'the pupil premium strategy is based on evidence, and understood and implemented by staff'},
  inc_send:{area:'Inclusion',theme:'Supporting pupils with SEND',gist:"a graduated approach is used and staff are trained to meet pupils' needs"},
  inc_csc:{area:'Inclusion',theme:"Supporting pupils who are known (or previously known) to children's social care",gist:'these pupils, including looked-after pupils, are supported well'},
  att_lead:{area:'Attendance and behaviour',theme:'Strategic leadership of attendance and behaviour',gist:'leaders have an accurate, informed understanding of attendance and behaviour and effective strategies to tackle issues'},
  att_att:{area:'Attendance and behaviour',theme:'Attendance',gist:''},
  att_beh:{area:'Attendance and behaviour',theme:'Behaviour, including bullying',gist:'rules and sanctions are generally applied effectively, and suspension and permanent exclusion are used appropriately'},
  cur_found:{area:'Curriculum and teaching',theme:'Securing strong foundations for all pupils',gist:'pupils who lack core foundations in reading, writing, language and number are identified and helped, and early readers are taught systematic synthetic phonics'},
  cur_teach:{area:'Curriculum and teaching',theme:'Teaching',gist:"teaching draws on pupils' starting points and checks their understanding"},
  ey_ach:{area:'Early years',theme:'Achievement in early years',gist:'the proportion of children reaching a good level of development is typically broadly in line with national averages'},
  lead:{area:'Leadership and governance',theme:'',gist:''}}};
/* Which toolkit theme a generated question belongs to. Ordered: the first matching rule wins. */
const REF_RULES=[
  ['lead',/Cohorts are small/i,'ach'],['lead',/./,'lead'],
  ['ach',/phonics|multiplication/i,'ach_found'],['ach',/special schools|prior attainers/i,'ach_prog'],['ach',/./,'ach_nat'],
  ['att',/exclusion|suspension|suspended/i,'att_beh'],['att',/attendance|absen/i,'att_att'],['att',/./,'att_lead'],
  ['inc',/pupil premium|disadvantaged/i,'inc_dis'],['inc',/children in need|social care|looked.after/i,'inc_csc'],['inc',/primary need|Persistent absence for pupils with SEN/i,'inc_send'],['inc',/./,'inc_id'],
  ['cur',/additional language|vocabulary/i,'cur_found'],['cur',/./,'cur_teach'],
  ['ey',/./,'ey_ach']];
const refFor=(area,q)=>{ const r=REF_RULES.find(([a,re])=>a===area&&re.test(q)); return r?r[2]:null; };
const refLabel=k=>{ const r=TOOLKIT.refs[k]; return r?(r.theme?`${r.area}: ${r.theme}`:r.area):''; };
/* ---- v4 question helpers ----
   joinList: a list as natural English ("a", "a and b", "a, b, and c"); semicolons when an item already holds a comma. */
const joinList=items=>{ const a=(items||[]).filter(x=>x!=null&&String(x).trim()!=='').map(x=>String(x).trim()); if(a.length<2) return a[0]||'';
  const comma=a.some(x=>x.includes(',')); if(a.length===2&&!comma) return a[0]+' and '+a[1]; const sep=comma?'; ':', '; return a.slice(0,-1).join(sep)+sep+'and '+a[a.length-1]; };
/* sortFigures: statistically significant before not significant, latest year before multi-year average, then the usual measure order. */
const sortFigures=items=>(items||[]).map((x,i)=>({x,i})).sort((p,q)=>((p.x.sig?0:1)-(q.x.sig?0:1))||((p.x.avg?1:0)-(q.x.avg?1:0))||((p.x.order||0)-(q.x.order||0))||(p.i-q.i)).map(o=>o.x);
/* fillTemplate: {name} is replaced by data.name. [[ ... ]] is an optional clause, dropped whole when any {name} inside it has no
   value. A {name} outside [[ ]] with no value means the sentence cannot be written: null is returned and the question is left out.
   A value is never re-read as a template, and the leftovers of a dropped clause (stray spaces, a comma before a full stop) are tidied. */
function fillTemplate(tpl,data){ data=data||{}; const has=k=>{ const v=data[k]; return v!=null&&(typeof v!=='number'||isFinite(v))&&String(v).trim()!==''&&!/^(undefined|null|NaN)$/.test(String(v).trim()); };
  let miss=false; const keysOf=t=>[...t.matchAll(/\{(\w+)\}/g)].map(x=>x[1]);
  let out=String(tpl).replace(/\[\[([\s\S]*?)\]\]/g,(_,inner)=>keysOf(inner).every(has)?inner:'');
  out=out.replace(/\{(\w+)\}/g,(_,k)=>{ if(!has(k)){ miss=true; return ''; } return String(data[k]).trim(); });
  if(miss) return null;
  return out.replace(/\s+/g,' ').replace(/\s+([,.;:?!)])/g,'$1').replace(/\(\s+/g,'(').replace(/\(\)/g,'').replace(/[,;:](?=[.?;])/g,'').replace(/\s+([,.;:?!)])/g,'$1').trim(); }
/* The one-page briefing: questions in priority order, at most two from one area unless nothing else is left. */
function pickOnePage(qs,n){ const out=[],held=[],count={}; for(const q of qs||[]){ if(out.length>=n) break; if((count[q.area]||0)<2){ out.push(q); count[q.area]=(count[q.area]||0)+1; } else held.push(q); }
  for(const q of held){ if(out.length>=n) break; out.push(q); } return n>0?(qs||[]).filter(q=>out.includes(q)).slice(0,n):[]; }
const TOP_QUESTIONS=10;
const latest=rows=>(rows||[]).filter(r=>isYear(r.year)&&r.schoolN!=null).sort((a,b)=>yearKey(b.year)-yearKey(a.year))[0];
/* "2025/26 (1 term)" is a part-year figure: say so wherever it is quoted. "(3 term)" is a full year. */
const termNote=y=>{ const m=(y||'').match(/\((\d)\s*term/i); return !m||m[1]==='3'?'':m[1]==='1'?', autumn term only':', autumn and spring terms only'; };
const avgRow=rows=>(rows||[]).find(r=>!isYear(r.year)&&/average|avg|^\d[- ]?(year|yr)/i.test(r.year)&&r.schoolN!=null);
const yearLabel=y=>(y||'').replace(/\s*\(.*\)$/,'');
const fmtGap=(g,k)=>g==null?'':(g>0?'+':g<0?'−':'')+Math.abs(g)+(k&&/attainment 8|progress|score|point|value added/i.test(k)?' pts':' pp');
const nameOf=k=>{ const c=CATALOGUE.find(c=>c[0].test(k)); return c&&c[1]?c[1]:k; };
const shortOf=k=>{ const c=CATALOGUE.find(c=>c[0].test(k)); return c&&c[2]?c[2]:k; };
const orderOf=k=>{ const i=CATALOGUE.findIndex(c=>c[0].test(k)); return i<0?50:i; };
const ARROWS={2:'▲▲',1:'▲',0:'≈','-1':'▼','-2':'▼▼'};
/* What the reader sees. Double arrows mean statistically significant (or, for context measures with no test,
   "well above/below average"); the words always say which. lb = lower is better (absence, suspensions). */
function judge(b,lb){ if(!b) return null; const band=b.band==null?Math.max(-2,Math.min(2,b.dir)):b.band; const s=b.sig==='+'?1:b.sig==='-'?-1:0;
  if(s){ const d=lb?-2*s:2*s; const close=band===0; const word=(lb?(d>0?'sig. better':'sig. worse'):(d>0?'sig. above':'sig. below'))+(close?' (close band)':''); return {dir:d,arrow:ARROWS[d],word,sig:true,raw:b.text}; }
  const d=lb?-band:band; const word=lb?({2:'well below nat. (better)',1:'better than nat.',0:'close to nat.','-1':'worse than nat.','-2':'well above nat. (worse)'})[d]:({2:'well above',1:'above',0:'close to av.','-1':'below','-2':'well below'})[d];
  return {dir:d,arrow:ARROWS[d],word,sig:false,raw:b.text}; }

/* Words for a result that is not statistically significant: the IDSR either tested it ("non-sig") or published no test at all. */
const nsg=b=>/sig/i.test((b&&b.text)||'')?'not statistically significant':'the IDSR gives no significance test';

function analyse(m){
  if(SUPPRESS){ const ax=Object.create(null); Object.keys(m.annex||{}).forEach(g=>{ ax[g]=Object.create(null); Object.keys(m.annex[g]).forEach(k=>{ ax[g][k]=m.annex[g][k].filter(r=>!(r.cohort!=null&&r.cohort<=SMALL)); }); }); m=Object.assign({},m,{annex:ax}); }
  const A=m.annex, all=A['All pupils']||{}, dis=A['Disadvantaged pupils']||{};
  const strengths=[],concerns=[],questions=[];
  const S=(t,pri,ev)=>strengths.push({text:t,pri,ev:[].concat(ev||[])}); const Cn=(t,pri,ev)=>concerns.push({text:t,pri,ev:[].concat(ev||[])});
  const EV=(group,measure,r,section)=>r?{section:section||m.measureSection[measure]||'',group,measure,year:r.year,cohort:r.cohort,school:r.school,nat:r.nat,natOther:r.natOther,gap:r.gap,band:r.band?r.band.text:(r.bandText||'not banded'),trend:r.trend||''}:null;
  const F={}, fUp=[], fDown=[];   // facts the question rules need (see QUESTIONS below)
  const notAnalysed=[];
  const achLabel=m.phase.hasKS4&&!m.phase.hasKS2?'key stage 4':m.phase.hasKS2?'key stage 2':'achievement';

  // ---- Attainment and progress measures (all pupils)
  const BEHAV_KNOWN=/^(Attendance|Persistent absence|[12] or more suspensions)$/i;
  Object.keys(all).forEach(k=>{ if(BEHAV_RE.test(k)?!BEHAV_KNOWN.test(k):!ACH_RE.test(k)) notAnalysed.push(k); });
  const measureKeys=Object.keys(all).filter(k=>!BEHAV_RE.test(k)&&ACH_RE.test(k)).sort((a,b)=>orderOf(a)-orderOf(b));
  const attKeys=measureKeys.filter(k=>!PROG_RE.test(k)), progKeys=measureKeys.filter(k=>PROG_RE.test(k));
  const mk=k=>({key:k,name:nameOf(k),short:shortOf(k),row:latest(all[k]),avg:avgRow(all[k])});
  const latestAtt=attKeys.map(mk).filter(x=>x.row), latestProg=progKeys.map(mk).filter(x=>x.row);
  const banded=latestAtt.filter(x=>x.row.band);
  const above=banded.filter(x=>x.row.band.dir>0), below=banded.filter(x=>x.row.band.dir<0);
  const mainRow=(latestAtt.find(x=>/RWM expected|attainment 8/i.test(x.key))||latestAtt[0]||{}).row;
  /* Overall picture: a plain count of results that carry a significance test. No adjectives, and not a score. */
  const tested=x=>x&&x.band&&/sig/i.test(x.band.text||''); const tally=rows=>{ const t=rows.filter(tested); return {n:t.length,up:t.filter(r=>r.band.sig==='+').length,down:t.filter(r=>r.band.sig==='-').length}; };
  const oL=tally([...latestAtt,...latestProg].map(x=>x.row)), oA=tally([...latestAtt,...latestProg].map(x=>x.avg));
  const say=o=>`${o.up} significantly above national, ${o.down} significantly below, ${o.n-o.up-o.down} no significant difference`;
  const overall=!m.phase.isSpecial&&oL.n>=4?`Overall picture, all pupils. Latest year (${oL.n} results with a significance test): ${say(oL)}.${oA.n>=4?` Multi-year average (${oA.n} results): ${say(oA)}.`:''} The measures overlap, so this is a count, not a score.`:'';
  const brief=o=>`${o.up} significantly above national, ${o.down} below, ${o.n-o.up-o.down} no significant difference`;
  const overallShort=overall?`Overall picture (all pupils, results with a significance test). Latest year: ${brief(oL)}.${oA.n>=4?` Multi-year average: ${brief(oA)}.`:''} A count, not a score.`:'';
  latestAtt.forEach(x=>{ const r=x.row; if(!r.band||!r.band.sig) return; const t=`${x.short}: ${r.school} against ${r.nat} nationally in ${yearLabel(r.year)} (n = ${cnt(r.cohort)}) – statistically significantly ${r.band.dir>0?'above':'below'}.`; (r.band.dir>0?S:Cn)(t,1,EV('All pupils',x.key,r)); });
  const sustUp=[],sustDown=[],evUp=[],evDown=[]; const avgLabs=new Set();
  [...latestAtt,...latestProg].forEach(x=>{ const a=x.avg; if(!a||!a.band||!a.band.sig) return; avgLabs.add(a.year.toLowerCase().replace(/\s*(average|avg)/,'').trim()); (a.band.dir>0?sustUp:sustDown).push(`${x.short} ${a.school} vs ${a.nat}`); (a.band.dir>0?evUp:evDown).push(EV('All pupils',x.key,a)); (a.band.dir>0?fUp:fDown).push({x,a}); });
  const avgLabel=avgLabs.size===1?[...avgLabs][0]:'multi-year';
  if(sustUp.length) S(`Above national over the IDSR's ${avgLabel} average, each statistically significant: ${sustUp.join('; ')}.`,0,evUp);
  if(sustDown.length){ Cn(`Below national over the IDSR's ${avgLabel} average, each statistically significant: ${sustDown.join('; ')}.`,0,evDown); }
  // higher-standard gap pattern (primary)
  const pairs=[['Reading expected standard','Reading higher standard','reading'],['Maths expected standard','Maths higher standard','maths'],['Writing expected standard','Writing greater depth','writing greater depth'],['RWM expected standard','RWM higher standard','RWM']];
  const hs=[],hsClear=[],hsEv=[]; pairs.forEach(([e,h,lab])=>{ const re=latest(all[e]),rh=latest(all[h]); if(!(re&&rh&&re.band&&rh.band&&re.band.dir>0&&rh.band.dir<=0)) return; if(rh.schoolN==null||rh.natN==null||rh.schoolN>rh.natN) return; hs.push(`${lab} ${rh.school} vs ${rh.nat}`); const one=rh.cohort?100/rh.cohort:0; const av=avgRow(all[h]); if(rh.natN-rh.schoolN>one&&!(av&&av.band&&av.band.dir>0)){ hsClear.push(`${lab} ${rh.school} vs ${rh.nat}`); hsEv.push(EV('All pupils',h,rh)); } });
  if(hs.length){ F.hs=hs; if(hsClear.length>=2) Cn(`Higher-standard outcomes are below national by more than one pupil's difference, despite expected-standard results above national (${hsClear.join('; ')}); not statistically significant.`,5,hsEv); }
  // secondary pattern: P8 / A8
  const p8=latestProg.find(x=>/progress 8/i.test(x.key)); if(p8&&p8.row.band&&p8.row.band.dir<0) F.p8=p8.row;
  // progress
  latestProg.forEach(x=>{ const r=x.row; if(r.band&&r.band.sig){ const t=`${x.name} ${r.school} in ${yearLabel(r.year)} (n = ${cnt(r.cohort)}): statistically significantly ${r.band.dir>0?'above':'below'} national.`; (r.band.dir>0?S:Cn)(t,1,EV('All pupils',x.key,r)); } });
  const paGroups=['Low prior attainers','Middle prior attainers','High prior attainers'].filter(g=>A[g]);
  const groupProg=paGroups.map(g=>({g,cells:progKeys.map(k=>latest((A[g]||{})[k]))})).filter(o=>o.cells.some(Boolean));

  // ---- Disadvantaged
  const disKeys=Object.keys(dis).filter(k=>!BEHAV_RE.test(k)&&(!PROG_RE.test(k)||/progress 8/i.test(k))).sort((a,b)=>orderOf(a)-orderOf(b));
  const gapMismatch=[];
  const disRows=disKeys.map(k=>({k,name:nameOf(k),short:shortOf(k),r:latest(dis[k])})).filter(x=>x.r&&x.r.gapN!=null).filter(x=>{ const r=x.r; if(r.schoolN!=null&&r.natOtherN!=null&&Math.abs(r.gapN-(r.schoolN-r.natOtherN))>1.5){ gapMismatch.push(`${x.name}: published gap ${r.gap} does not match school ${r.school} minus national non-disadvantaged ${r.natOther}`); return false; } return true; });
  if(disRows.length){ const n=disRows[0].r.cohort, onePupil=n?100/n:0; const ok=disRows.filter(x=>x.r.gapN>=0), behindAll=disRows.filter(x=>x.r.gapN<0), one=x=>/%/.test(String(x.r.school))?onePupil:0, behind=behindAll.filter(x=>Math.abs(x.r.gapN)>=one(x)), within=behindAll.filter(x=>Math.abs(x.r.gapN)<one(x)); const gapTag=`${(m.provisional||[]).includes(yearLabel(disRows[0].r.year))?', provisional':''}; a gap to the national figure, not a significance test`; const y=yearLabel(disRows[0].r.year);
    if(ok.length&&ok.length>=behind.length) S(`Disadvantaged pupils (${y}, n = ${cnt(n)}${gapTag}) are at or above national non-disadvantaged pupils in ${ok.map(x=>x.short.replace(/ expected$/,'')).join(', ')} (gaps ${ok.map(x=>fmtGap(x.r.gapN,x.k)).join(', ')}).`,3,ok.map(x=>EV('Disadvantaged pupils',x.k,x.r)));
    if(behind.length){ Cn(`Disadvantaged pupils are behind national non-disadvantaged pupils in ${behind.map(x=>`${x.short.replace(/ expected$/,'')} (${fmtGap(x.r.gapN,x.k)})`).join(', ')} (${y}, n = ${cnt(n)}${gapTag}).`,3,behind.map(x=>EV('Disadvantaged pupils',x.k,x.r))); const w=[...behind].sort((a,b)=>a.r.gapN-b.r.gapN)[0]; F.dis={behind,w,n,onePupil}; }
    else if(ok.length) F.disOk={within};
    disRows.forEach(x=>{ if(x.r.band&&x.r.band.sig&&!PROG_RE.test(x.k)) (x.r.band.dir>0?S:Cn)(`Disadvantaged ${x.short.replace(/ expected$/,'').toLowerCase()} ${x.r.school} vs ${x.r.nat} national disadvantaged – statistically significantly ${x.r.band.dir>0?'above':'below'} (${yearLabel(x.r.year)}).`,1,EV('Disadvantaged pupils',x.k,x.r)); }); }
  /* Significant disadvantaged progress results are reported too (they were left out before). */
  Object.keys(dis).filter(k=>PROG_RE.test(k)).forEach(k=>{ const r=latest(dis[k]); if(r&&r.band&&r.band.sig) (r.band.dir>0?S:Cn)(`Disadvantaged pupils: ${nameOf(k)} ${r.school} in ${yearLabel(r.year)} (n = ${cnt(r.cohort)}) – statistically significantly ${r.band.dir>0?'above':'below'} national.`,1,EV('Disadvantaged pupils',k,r)); });

  // ---- Attendance and behaviour
  const groups=[['All pupils','all pupils'],['FSM6','FSM6 pupils'],['SEN','pupils with SEN']];
  const attLines=[];
  groups.forEach(([g,label])=>{ const G=A[g]||{}; const att=(G['Attendance']||[]).filter(r=>!/half terms/.test(r.year)); const aL=latest(att); const daily=(G['Attendance']||[]).find(r=>/half terms/.test(r.year)); const full=k=>(G[k]||[]).filter(r=>!/half terms/.test(r.year)); const paL=maskFew(latest(full('Persistent absence'))); const s1=maskFew(latest(full('1 or more suspensions'))); const s2=maskFew(latest(full('2 or more suspensions')));
    attLines.push({g,label,att:aL,daily,pa:paL,s1,s2});
    if(paL&&paL.band){ const worse=paL.band.dir>0; const t=`Persistent absence of ${label} is ${paL.school} against ${paL.nat} nationally (${yearLabel(paL.year)}${termNote(paL.year)}, n = ${cnt(paL.cohort)})${worse?(paL.band.sig?' – statistically significantly higher':' – higher than national, not statistically significant'):paL.band.dir<0?(paL.band.sig?' – statistically significantly lower':' – lower than national'):''}${/Sig increase/i.test(paL.trend)?', and rising significantly':''}.`; const evp=EV(g,'Persistent absence',paL,'Attendance and behaviour'); if(worse){ Cn(t,paL.band.sig?1:4,evp); } else if(paL.band.dir<0) S(t,3,evp); }
    const evA=aL?EV(g,'Attendance',aL,'Attendance and behaviour'):null;
    if(aL&&aL.band&&aL.band.dir<0){ Cn(`Attendance of ${label} is ${aL.school} against ${aL.nat} nationally, below average (${yearLabel(aL.year)}${termNote(aL.year)})${/decline/i.test(aL.trend)?', and declining relative to the national trend':''}${aL.band.sig?' – statistically significantly below national':'; '+nsg(aL.band)}.`,3,evA); }
    else if(aL&&/Relative decline/i.test(aL.trend)){ Cn(`Attendance of ${label} (${aL.school} against ${aL.nat} nationally, ${yearLabel(aL.year)}${termNote(aL.year)}) has declined relative to the national trend (IDSR trend: "relative decline").`,5,evA); }
    if(aL&&aL.band&&aL.band.dir>0&&g!=='All pupils') S(`Attendance of ${label} is above national (${aL.school} vs ${aL.nat}, ${yearLabel(aL.year)}${termNote(aL.year)})${/improvement/i.test(aL.trend)?' and has improved relative to the national trend (IDSR trend: "relative improvement")':''}.`,4,evA);
    if(s1&&s1.band&&s1.band.dir>0){ const sp=s1.band.sig?1:5; Cn(`Suspensions: ${s1.school} of ${label} were suspended at least once in ${yearLabel(s1.year)}${termNote(s1.year)} against ${s1.nat} nationally (n = ${cnt(s1.cohort)})${s1.band.sig?' – statistically significantly higher':' – higher than national, '+nsg(s1.band)}${s2&&s2.band&&s2.band.dir>0?`; repeat suspensions also above national (${s2.school})`:''}.`,sp,[EV(g,'1 or more suspensions',s1,'Attendance and behaviour'),s2?EV(g,'2 or more suspensions',s2,'Attendance and behaviour'):null].filter(Boolean)); } });
  if(m.suspensions){ const yrs=m.suspensions.years, tot=Object.values(m.suspensions.rows)[0]||{}; const pts=yrs.map((y,i)=>({y,i,v:tot[y]})).filter(p=>p.v!=null);
    /* Year and value stay paired, so a year that is suppressed or missing can never shift a figure onto the wrong year. */
    if(pts.length>=2){ const last=pts[pts.length-1], prev=pts[pts.length-2]; const adjacent=last.i-prev.i===1; const missing=yrs.filter(y=>tot[y]==null).map(yearLabel); const shown=pts.map(p=>cnt(p.v)).join(' → '); const yrsTxt=pts.map(p=>yearLabel(p.y)).join(', ');
      const hid=v=>SUPPRESS&&v>0&&v<=SMALL; if(adjacent&&last.v>prev.v&&!hid(last.v)&&!hid(prev.v)){ const t=`Total suspensions ${shown} (${yrsTxt}${missing.length?`; ${missing.join(', ')} not published`:''}) – rising.${Math.max(...pts.map(p=>p.v))<50?' Small counts change a lot from year to year: read with caution.':''}`; F.suspRise=shown; Cn(t,4,{section:'Attendance and behaviour',group:'Whole school',measure:'Total number of suspensions',year:yrsTxt,cohort:null,school:shown,nat:'–',band:'count, not banded',trend:''}); } } }
  if(m.exclusions){ const yrs=m.exclusions.years, tot=Object.values(m.exclusions.rows)[0]||{}; const n=yrs.map(y=>tot[y]).filter(v=>v).reduce((a,b)=>a+b,0); if(n>0){ const small=SUPPRESS&&n<=SMALL; const rs=SUPPRESS?[]:(m.exclusions.reasons||[]).filter(r=>Object.values(r.byYear).some(v=>v)).map(r=>r.reason.toLowerCase()); const natRow=Object.entries(m.exclusions.rows).find(([k])=>/national/i.test(k)); const natVals=natRow?yrs.map(y=>natRow[1][y]).filter(v=>v!=null):[]; const natTxt=natVals.length?(natVals.every(v=>v===0)?'; the national average for this phase rounds to 0':`; national average ${natVals[natVals.length-1]}`):''; const span=yrs.length>1?` between ${yearLabel(yrs[0])} and ${yearLabel(yrs[yrs.length-1])}`:yrs.length?` in ${yearLabel(yrs[0])}`:''; const nTxt=small?`Permanent exclusions were recorded${span} (${SMALL} or fewer)`:`${n} permanent exclusion${n>1?'s':''}${span}`; Cn(`${nTxt}${rs.length?` (${rs.join('; ')})`:''}${natTxt}.`,2,{section:'Attendance and behaviour',group:'Whole school',measure:'Total number of permanent exclusions',year:yrs.map(yearLabel).join(', '),cohort:null,school:yrs.map(y=>tot[y]==null?'–':cnt(tot[y])).join(' → '),nat:natVals.join(' → ')||'–',band:'count, not banded',trend:''}); F.excl=small?`Permanent exclusions were recorded${span}`:`There ${n>1?'were':'was'} ${n} permanent exclusion${n>1?'s':''}${span}`; } }
  if(m.ygAbsence&&m.ygAbsence.years){ const k=Object.keys(m.ygAbsence).find(k=>/10% and above/.test(k)); if(k){ const hot=m.ygAbsence.years.map(y=>({y,v:m.ygAbsence[k][y]})).filter(x=>x.v!=null&&x.v>=15); if(hot.length) F.hot=hot.map(x=>`${x.y.replace('Y','Year ')} (${x.v}%)`); } }
  if(m.ap&&m.ap.some(t=>/\d/.test(t)&&!/no data/i.test(t))) F.ap=true;

  // ---- Context / inclusion
  const ch=m.characteristics, y=m.charYears[m.charYears.length-1]; const val=n=>{ const o=ch[n]; return o&&o[y]?o[y]:null; };
  const ctx={nor:val('School number on roll'),fsm:val('School % FSM6'),senS:val('School % SEN support'),ehcp:val('School % EHC plan'),eal:val('School % EAL'),stab:val('School % stability'),cin:val('School % CIN'),dep:val('School location deprivation'),laSen:val('Local area % SEN support'),year:y};
  if(m.sen.needs.length){ const byNeed=Object.create(null); m.sen.needs.forEach(n=>byNeed[n.need]=(byNeed[n.need]||0)+(n.n||0)); const top=Object.entries(byNeed).sort((a,b)=>b[1]-a[1])[0]; const partHidden=top&&SUPPRESS&&m.sen.needs.some(n=>n.need===top[0]&&n.n>0&&n.n<=SMALL); if(top) F.need={name:top[0].toLowerCase(),n:partHidden?null:cnt(top[1])}; }

  // ---- Leadership / staffing
  const staffHigh=m.staffing.filter(s=>!/nothing to highlight|no full-time vacant|there were no/i.test(s));
  staffHigh.forEach(s=>{ Cn(s.replace(/\.$/,'')+'.',4,{section:'Context of the school',group:'Staffing',measure:'School workforce census statement',year:'',cohort:null,school:'–',nat:'–',band:'Ofsted highlight',trend:s}); });
  if(!staffHigh.length&&m.staffing.length) S('Workforce census: nothing flagged for the support-staff ratio, teacher sickness absence, vacancies or turnover.',6,m.staffing.map(st=>({section:'Context of the school',group:'Staffing',measure:'School workforce census statement',year:'',cohort:null,school:'–',nat:'–',band:'"nothing to highlight"',trend:st})));
  // ---- QUESTIONS (v4). The wording is in questions.js (QUESTION_BANK); the rules here decide which entries fire.
  //      One finding, one question: figures are merged by subject and by measure, and a compound rule absorbs its parts.
  const ask=(id,data,o)=>{ const e=QUESTION_BANK[id]; if(!e) return null; let q=fillTemplate(e.q,data||{}); if(!q) return null; const brief=(e.brief&&fillTemplate(e.brief,data||{}))||q; if(o&&o.add) q+=' '+o.add;
    const item={id,area:e.area,q,brief,ev:e.ev,pri:o&&o.sig&&e.priSig!=null?e.priSig:e.pri,ref:e.ref}; questions.push(item); return item; };
  const fig=(x,r)=>`${x.short} ${r.school} vs ${r.nat}`;
  const usable=r=>r&&r.schoolN!=null&&r.natN!=null;
  const subjOf=k=>/^RWM/i.test(k)?'Reading, writing and maths combined':/^Writing\b/i.test(k)?'Writing':/^Reading\b/i.test(k)?'Reading':/^Maths\b/i.test(k)?'Maths':/^EGPS\b/i.test(k)?'Grammar, punctuation and spelling':shortOf(k);
  const OWN_RE=/^(Phonics expected standard|Year 4 MTC score)$|progress 8/i;   // measures with a question of their own (A7, A8, A9): kept out of the merged lists so a figure is not repeated
  const lc=s=>/^(English|EBacc|Progress 8|Attainment 8|Year )/.test(s)?s:s.replace(/^[A-Z](?=[a-z])/,c=>c.toLowerCase());
  const latestYear=Math.max(-1,...latestAtt.map(x=>yearKey(x.row.year)));
  const fresh=r=>latestYear<0||!isYear(r.year)||yearKey(r.year)>=latestYear-1;       // no question on data more than a year older than the latest results
  const pupilsWord=(gap,cohort)=>{ if(gap==null||!cohort) return null; const k=Math.round(Math.abs(gap)/(100/cohort)); if(!(k>=1)) return null; return SUPPRESS&&k<=SMALL?`${SMALL} or fewer pupils`:`about ${k} pupil${k===1?'':'s'}`; };
  const sigNoteOf=rows=>{ const s=rows.filter(r=>r.band&&r.band.sig).length; if(s===rows.length) return 'statistically significant'; if(s) return null; const n=[...new Set(rows.map(r=>nsg(r.band)))]; return n.length===1?n[0]:'not statistically significant, or not tested'; };
  const simNum=r=>r&&r.sim!=null?num(unmark(String(r.sim))):null;
  const simAdd=keys=>{ for(const k of keys){ if(PROG_RE.test(k)) continue; const r=latest(all[k]), s=simNum(r); if(r&&s!=null&&r.schoolN!=null) return fillTemplate(QUESTION_BANK[r.schoolN<s?'SIMB':'SIMA'].q,{year:yearLabel(r.year),measure:shortOf(k),school:r.school,sim:unmark(String(r.sim))}); } return null; };
  const texts=items=>joinList(sortFigures(items).map(i=>i.text));
  const pct=v=>v==null?'':` (${v}%)`;

  // Achievement
  const sigSubjects=new Set(), belowSubjects=new Set();
  const down=fDown.filter(({a})=>usable(a));
  if(down.length){ down.forEach(({x})=>sigSubjects.add(subjOf(x.key)));
    const items=sortFigures(down.map(({x,a})=>({text:fig(x,a),sig:true,avg:true,order:orderOf(x.key),key:x.key})));
    const lat=[...latestAtt,...latestProg].filter(x=>sigSubjects.has(subjOf(x.key))&&usable(x.row)&&x.row.band&&x.row.band.dir<0&&fresh(x.row));
    let latestTxt=null; if(lat.length){ const yrs=[...new Set(lat.map(x=>yearLabel(x.row.year)))], note=sigNoteOf(lat.map(x=>x.row));
      const li=lat.map(x=>({text:fig(x,x.row)+(yrs.length>1?` in ${yearLabel(x.row.year)}`:'')+(!note&&x.row.band.sig?' (significant)':''),sig:!!x.row.band.sig,avg:false,order:orderOf(x.key)}));
      latestTxt=`${texts(li)} (${[yrs.length===1?yrs[0]:null,note||'the others not statistically significant'].filter(Boolean).join('; ')})`; }
    ask('A1',{avgLabel,figures:joinList(items.map(i=>i.text)),latest:latestTxt},{add:simAdd(items.map(i=>i.key))}); }
  const a1Subjects=new Set(sigSubjects);
  [...latestAtt,...latestProg].forEach(x=>{ if(OWN_RE.test(x.key)&&usable(x.row)&&x.row.band&&x.row.band.dir<0&&fresh(x.row)){ belowSubjects.add(subjOf(x.key)); if(x.row.band.sig) sigSubjects.add(subjOf(x.key)); } });
  const dip=[...latestAtt,...latestProg].filter(x=>!OWN_RE.test(x.key)&&usable(x.row)&&x.row.band&&x.row.band.sig&&x.row.band.dir<0&&fresh(x.row)&&!a1Subjects.has(subjOf(x.key)));
  if(dip.length){ const dy=[...new Set(dip.map(x=>yearLabel(x.row.year)))], one=dy.length===1; const tag=x=>{ const p=[one?null:yearLabel(x.row.year),x.row.cohort!=null?`n = ${cnt(x.row.cohort)}`:null].filter(Boolean).join(', '); return p?` (${p})`:''; };
    const items=sortFigures(dip.map(x=>({text:fig(x,x.row)+tag(x),sig:true,avg:false,order:orderOf(x.key),key:x.key})));
    if(ask('A2',{year:one?dy[0]:null,avgLabel:dip.every(x=>x.avg)?avgLabel:null,figures:joinList(items.map(i=>i.text))},{add:simAdd(items.map(i=>i.key))})) dip.forEach(x=>sigSubjects.add(subjOf(x.key))); }
  sigSubjects.forEach(s=>belowSubjects.add(s));
  const weak=[...latestAtt,...latestProg].filter(x=>!OWN_RE.test(x.key)&&usable(x.row)&&x.row.band&&!x.row.band.sig&&x.row.band.dir<0&&fresh(x.row)&&!sigSubjects.has(subjOf(x.key)));
  [...new Set(weak.map(x=>subjOf(x.key)))].forEach(subject=>{ const rows=weak.filter(x=>subjOf(x.key)===subject), yrs=[...new Set(rows.map(x=>yearLabel(x.row.year)))].sort();
    const bare=rows.length===1&&rows[0].short===subject;   // the subject already names the measure
    const items=sortFigures(rows.map(x=>({text:(bare?`${x.row.school} vs ${x.row.nat}`:fig(x,x.row))+(yrs.length>1?` in ${yearLabel(x.row.year)}`:''),sig:false,avg:false,order:orderOf(x.key),key:x.key})));
    const firstPct=items.map(i=>rows.find(x=>x.key===i.key)).find(x=>!PROG_RE.test(x.key)&&/%/.test(String(x.row.school))); const kWord=firstPct?pupilsWord(firstPct.row.natN-firstPct.row.schoolN,firstPct.row.cohort):null;
    const onlyProgress=rows.every(x=>PROG_RE.test(x.key)), standards=rows.every(x=>PROG_RE.test(x.key)||/standard|greater depth/i.test(x.key));
    if(ask(onlyProgress?'A3P':standards?'A3':'A3G',{subject,year:joinList(yrs),figures:joinList(items.map(i=>i.text)),sigNote:sigNoteOf(rows.map(x=>x.row)),kPupils:kWord?kWord+(rows.length>1?` for ${firstPct.short}`:''):null},{add:simAdd(items.map(i=>i.key))})) belowSubjects.add(subject); });
  if(F.hs) ask('A4',{figures:joinList(F.hs)});
  const up=fUp.filter(({a})=>usable(a)); if(up.length) ask('A5',{avgLabel,figures:texts(up.map(({x,a})=>({text:fig(x,a),sig:true,avg:true,order:orderOf(x.key)})))});
  { const g6=[]; groupProg.forEach(o=>o.cells.forEach((r,i)=>{ if(r&&r.schoolN!=null&&r.band&&r.band.dir<0&&fresh(r)&&(r.band.sig||(r.cohort!=null&&r.cohort>=11))) g6.push({text:`${o.g} in ${lc(subjOf(progKeys[i]))} (${r.school} in ${yearLabel(r.year)}${r.cohort!=null?`, n = ${cnt(r.cohort)}`:''}; ${r.band.sig?'statistically significant':'not statistically significant'})`,sig:!!r.band.sig,avg:false,order:i}); }));
    if(g6.length) ask('A6',{figures:texts(g6)},{sig:g6.some(i=>i.sig)}); }
  { const ph=latest(all['Phonics expected standard']); if(usable(ph)&&ph.band&&ph.band.dir<=0) ask('A7',{school:ph.school,nat:ph.nat});
    const mtc=latest(all['Year 4 MTC score']); if(usable(mtc)&&mtc.band&&mtc.band.dir<=0) ask('A8',{school:mtc.school,nat:mtc.nat}); }
  if(F.p8&&F.p8.schoolN!=null&&!down.some(({x})=>/progress 8/i.test(x.key))) ask('A9',{school:F.p8.school,band:bandWords(F.p8.band)});
  { const sims=latestAtt.filter(x=>{ const r=x.row, s=simNum(r); if(PROG_RE.test(x.key)||!usable(r)||s==null||!r.band||r.band.dir<0||s<=r.schoolN||!/%/.test(String(r.school))) return false; return r.simBand?r.simBand.dir<0:!!(r.cohort&&s-r.schoolN>100/r.cohort); });
    if(sims.length) ask('A10',{figures:joinList(sims.map(x=>`${x.short} ${x.row.school} (national ${x.row.nat}, similar schools ${unmark(String(x.row.sim))})`))}); }
  if(m.phase.isSpecial) ask('SP1');

  // Inclusion (compound rules first: each absorbs the stand-alone questions it is built from)
  const gFSM=attLines.find(x=>x.g==='FSM6'), gSEN=attLines.find(x=>x.g==='SEN'), gAll=attLines.find(x=>x.g==='All pupils');
  const isAbove=r=>!!(r&&r.schoolN!=null&&r.natN!=null&&r.band&&r.band.dir>0);
  const gapName=x=>x.short.replace(/ expected$/,'');
  const i3=!!(F.dis&&gFSM&&isAbove(gFSM.pa)&&ask('I3',{pa:gFSM.pa.school,paNat:gFSM.pa.nat,gaps:joinList(F.dis.behind.map(x=>`${gapName(x)} (${fmtGap(x.r.gapN,x.k)})`))}));
  const i10=!!(gSEN&&isAbove(gSEN.pa)&&isAbove(gSEN.s1)&&ask('I10',{pa:gSEN.pa.school,paNat:gSEN.pa.nat,susp:gSEN.s1.school,suspNat:gSEN.s1.nat}));
  if(F.dis&&!i3){ const w=F.dis.w, isPct=/%/.test(String(w.r.school)), k=isPct?pupilsWord(w.r.gapN,w.r.cohort):null; ask('I1',{subject:gapName(w),subjectLc:lc(gapName(w)),gap:fmtGap(w.r.gapN,w.k),kPupils:k,n:k&&w.r.cohort!=null?cnt(w.r.cohort):null}); }
  if(F.disOk) ask('I2',{within:joinList(F.disOk.within.map(x=>`${gapName(x)} ${fmtGap(x.r.gapN,x.k)}`))});
  if(ctx.senS&&ctx.senS.dir<0) ask('I4',{value:ctx.senS.value,la:ctx.laSen?ctx.laSen.value:null});
  { const hi=[]; if(ctx.senS&&ctx.senS.dir>0) hi.push('SEN support'+pct(ctx.senS.value)); if(ctx.ehcp&&ctx.ehcp.dir>0) hi.push('an EHC plan'+pct(ctx.ehcp.value)); if(hi.length) ask('I5',{figures:joinList(hi)}); }
  if(F.need) ask('I6',{need:F.need.name,n:F.need.n});
  if(ctx.cin&&ctx.cin.dir>0&&ctx.cin.band) ask('I7',{value:ctx.cin.value,band:ctx.cin.band.toLowerCase()});
  if(F.ap) ask('I9');
  { const hi=[]; if(ctx.fsm&&ctx.fsm.dir>=2) hi.push('FSM6 eligibility well above average'+pct(ctx.fsm.value)); if(ctx.dep&&ctx.dep.dir>=2) hi.push('location deprivation well above average'); if(hi.length) ask('I11',{figures:joinList(hi)}); }
  if(!i10&&gSEN&&gSEN.pa&&gSEN.pa.schoolN!=null&&gSEN.pa.natN!=null&&gSEN.pa.schoolN>gSEN.pa.natN&&!(gSEN.pa.band&&gSEN.pa.band.dir>0)) ask('I12',{pa:gSEN.pa.school,paNat:gSEN.pa.nat,n:gSEN.pa.cohort!=null?cnt(gSEN.pa.cohort):null});

  // Attendance and behaviour (one question per measure, covering every group that fires)
  const absorbed=g=>(g==='FSM6'&&i3)||(g==='SEN'&&i10);
  const sameTerm=rows=>{ const t=[...new Set(rows.map(r=>termNote(r.year)))]; return t.length===1&&t[0]?t[0].replace(/^,\s*/,''):null; };
  const grp=(x,r,i)=>({text:`${x.label} (${r.school} vs ${r.nat})`,sig:!!(r.band&&r.band.sig),avg:false,order:i});
  { const g=attLines.map((x,i)=>({x,i})).filter(o=>isAbove(o.x.pa)&&!absorbed(o.x.g));
    if(g.length) ask('B1',{groups:texts(g.map(o=>grp(o.x,o.x.pa,o.i))),term:sameTerm(g.map(o=>o.x.pa)),rising:g.some(o=>/Sig increase/i.test(o.x.pa.trend||''))?'rising significantly':null},{sig:g.some(o=>o.x.pa.band.sig)}); }
  { const lowA=r=>!!(r&&r.schoolN!=null&&r.natN!=null&&r.band&&r.band.dir<0); const g=attLines.map((x,i)=>({x,i})).filter(o=>lowA(o.x.att));
    if(g.length) ask('B2',{groups:texts(g.map(o=>grp(o.x,o.x.att,o.i))),term:sameTerm(g.map(o=>o.x.att)),declining:g.some(o=>/decline/i.test(o.x.att.trend||''))?'declining against the national trend':null});
    const d=attLines.map((x,i)=>({x,i})).filter(o=>o.x.att&&o.x.att.schoolN!=null&&!lowA(o.x.att)&&/Relative decline/i.test(o.x.att.trend||''));
    if(d.length) ask('B2D',{groups:joinList(d.map(o=>`${o.x.label} (${o.x.att.school})`)),term:sameTerm(d.map(o=>o.x.att))}); }
  if(F.hot) ask('B3',{hot:joinList(F.hot)});
  { const g=attLines.map((x,i)=>({x,i})).filter(o=>isAbove(o.x.s1)&&!absorbed(o.x.g));
    if(g.length) ask('B4',{groups:texts(g.map(o=>grp(o.x,o.x.s1,o.i))),repeat:g.some(o=>isAbove(o.x.s2))?'including repeat suspensions':null},{sig:g.some(o=>o.x.s1.band.sig)}); }
  if(F.suspRise) ask('B5',{counts:F.suspRise});
  if(F.excl) ask('B6',{lead:F.excl});
  if(gAll&&gAll.pa&&gAll.pa.schoolN!=null&&gAll.pa.natN!=null&&gAll.pa.band&&gAll.pa.band.sig&&gAll.pa.band.dir<0) ask('B7',{school:gAll.pa.school,nat:gAll.pa.nat});

  // Leadership, curriculum and early years
  const flag=s=>s.replace(/\.$/,'').replace(/"/g,"'");
  const l2=!!(staffHigh.length&&sigSubjects.size&&ask('L2',{statement:staffHigh.map(flag).join('"; "'),subjects:joinList([...sigSubjects].map(lc))}));
  if(!l2) staffHigh.forEach(s=>ask(/turnover|leav/i.test(s)?'L1T':/sickness|absence|vacan/i.test(s)?'L1S':'L1O',{statement:flag(s)}));
  ask('L3');
  if(mainRow&&mainRow.cohort&&mainRow.cohort<40&&/%/.test(String(mainRow.school))) ask('L4',{n:mainRow.cohort,achLabel,pp:Math.round(100/mainRow.cohort*10)/10});
  if(/academy|free school/i.test(m.school.type||'')) ask('L5');
  const lowStab=ctx.stab&&ctx.stab.dir<0;
  const l6=!!(lowStab&&belowSubjects.size&&ask('L6',{value:ctx.stab.value,subjects:joinList([...belowSubjects].map(lc))}));
  if(lowStab&&!l6) ask('I8',{value:ctx.stab.value});
  if(ctx.eal&&ctx.eal.dir>0&&ctx.eal.band&&m.yearGroups.length){ const r=m.yearGroups.map(g=>g.eal).filter(v=>v!=null); ask('C1',{band:ctx.eal.band.toLowerCase(),value:ctx.eal.value,range:r.length&&ctx.eal.value!=null?`${Math.round(Math.min(...r))}–${Math.round(Math.max(...r))}`:null}); }
  if(m.phase.hasKS2&&m.eyfs['Good level of development']!=null){ const lit=m.eyfs['Literacy'], math=m.eyfs['Mathematics']; ask('E1',{gld:m.eyfs['Good level of development'],lit:lit!=null&&math!=null?lit:null,math:lit!=null&&math!=null?math:null}); }

  strengths.sort((a,b)=>a.pri-b.pri); concerns.sort((a,b)=>a.pri-b.pri);
  /* Questions follow the priority of the headline they belong to; within one priority they rotate across areas. */
  const areaOrder=['ach','att','inc','lead','cur','ey']; const rr=[]; [...new Set(questions.map(q=>q.pri))].sort((a,b)=>a-b).forEach(pri=>{ const tier=questions.filter(q=>q.pri===pri); const byArea=areaOrder.map(a=>tier.filter(q=>q.area===a)); let added=0; for(let i=0;added<tier.length;i++) byArea.forEach(l=>{ if(l[i]){ rr.push(l[i]); added++; } }); });
  /* The full briefing leads with the first TOP_QUESTIONS; the rest are listed as further prompts. One strength question is always kept. */
  const qTop=rr.slice(0,TOP_QUESTIONS), qMore=rr.slice(TOP_QUESTIONS); const isStrength=q=>!!(QUESTION_BANK[q.id]&&QUESTION_BANK[q.id].strength);
  if(qMore.some(isStrength)&&!qTop.some(isStrength)){ const i=qMore.findIndex(isStrength); const st=qMore.splice(i,1)[0]; qMore.unshift(qTop.pop()); qTop.push(st); }

  // ---- Tables
  const attTable=latestAtt.map(x=>({name:x.name,short:x.short,school:x.row.school,nat:x.row.nat,n:x.row.cohort,j:judge(x.row.band),year:yearLabel(x.row.year),avg:x.avg?x.avg.school:'',avgJ:x.avg?judge(x.avg.band):null,avgLabel:x.avg?x.avg.year:'',sim:x.row.sim?unmark(x.row.sim):'',simText:x.row.simBand?x.row.simBand.text:''}));
  const hasSim=attTable.some(r=>r.sim||r.simText);
  const progTable=latestProg.map(x=>({name:x.name,school:(x.row.schoolN>0&&!/^\+/.test(x.row.school)?'+':'')+x.row.school,nat:x.row.nat,n:x.row.cohort,j:judge(x.row.band),year:yearLabel(x.row.year)}));
  const groupProgTable=groupProg.map(o=>({label:o.g,cells:o.cells.map(r=>r?{v:(r.schoolN>0&&!/^\+/.test(r.school)?'+':'')+r.school,j:judge(r.band)}:null)}));
  const disTable=disRows.map(x=>({name:x.short.replace(/ expected$/,' expected'),school:x.r.school,natDis:x.r.nat,natNon:x.r.natOther,gap:fmtGap(x.r.gapN,x.k),sig:x.r.band&&x.r.band.sig?x.r.band.dir:0,n:x.r.cohort,year:yearLabel(x.r.year)}));
  const attendTable=attLines.filter(x=>x.att||x.pa||x.s1).map(x=>({label:x.label.charAt(0).toUpperCase()+x.label.slice(1),att:x.att,pa:x.pa,s1:x.s1,daily:x.daily}));
  // trends
  const series=(rows,lb)=>{ const rs=(rows||[]).filter(r=>isYear(r.year)&&r.schoolN!=null&&!/half terms/.test(r.year)).slice().reverse(); if(rs.length<2) return null; const last=rs[rs.length-1]; return {years:rs.map(r=>yearLabel(r.year)),values:rs.map(r=>(lb&&fewPupils(r)?HIDDEN_PCT:r.school)+(/\(1 term\)|\(2 term\)/.test(r.year)?'*':'')),comp:'national '+last.nat+(/\(1 term\)|\(2 term\)/.test(last.year)?'*':''),j:lb&&fewPupils(last)?null:judge(last.band,lb)}; };
  const trendGroups=[];
  const ksKeys=[...attKeys.filter(k=>/expected|attainment 8|grade/i.test(k)).slice(0,6),...progKeys.filter(k=>/progress 8/i.test(k))]; const ks=(ksKeys.length?ksKeys:attKeys.slice(0,6)).map(k=>({label:nameOf(k),...(series(all[k])||{})})).filter(t=>t.values); if(ks.length) trendGroups.push({title:'Attainment, all pupils',rows:ks});
  const gapKey=disKeys[0]; if(gapKey){ const gs=(dis[gapKey]||[]).filter(r=>isYear(r.year)&&r.gapN!=null).slice().reverse(); if(gs.length>=2) trendGroups[trendGroups.length?0:0]&&(trendGroups[0].rows.push({label:`Disadvantaged gap, ${shortOf(gapKey).replace(/ expected$/,'')}`,years:gs.map(r=>yearLabel(r.year)),values:gs.map(r=>fmtGap(r.gapN,gapKey)),comp:'vs national non-disadvantaged (+ = school disadvantaged ahead)',j:null})); }
  const ab=[]; const pushT=(label,s)=>{ if(s) ab.push({label,...s}); }; pushT('Attendance (all pupils)',series((A['All pupils']||{})['Attendance'])); pushT('Persistent absence (all pupils)',series((A['All pupils']||{})['Persistent absence'],true)); pushT('Persistent absence (FSM6)',series((A['FSM6']||{})['Persistent absence'],true)); pushT('Persistent absence (SEN)',series((A['SEN']||{})['Persistent absence'],true)); if(ab.length) trendGroups.push({title:'Attendance and persistent absence',rows:ab});
  if(m.suspensions){ const yrs=m.suspensions.years, tot=Object.values(m.suspensions.rows)[0]||{}; trendGroups.push({title:'Suspensions',rows:[{label:'Suspensions (total number)',years:yrs.map(yearLabel),values:yrs.map(y=>tot[y]==null?'–':cnt(tot[y])),comp:'',j:null}]}); }
  trendGroups.forEach(g=>{ const ys=[...new Set(g.rows.flatMap(r=>r.years))].sort(); g.title+=` (${ys.join(' → ')})`; });

  const yrsOf=keys=>[...new Set(keys.flatMap(k=>(all[k]||[]).filter(r=>isYear(r.year)).map(r=>yearLabel(r.year))))].sort();
  const avgCoverage=[attKeys.length?`attainment ${yrsOf(attKeys).join(', ')}`:'',progKeys.length?`progress ${yrsOf(progKeys).join(', ')}`:''].filter(Boolean).join('; ');
  // Coverage: expected measures for the phase, what was found, what needs manual checking
  const expect=[]; const beh=['Attendance','Persistent absence','1 or more suspensions'];
  if(m.phase.hasKS2) expect.push('RWM expected standard','RWM higher standard','Reading expected standard','Writing expected standard','Maths expected standard','EGPS expected standard','Reading progress','Writing progress','Maths progress','Year 4 MTC score','Phonics expected standard');
  if(m.phase.hasKS4) expect.push('Attainment 8','Progress 8','English and maths grade 4','English and maths grade 5');
  const foundKeys=Object.keys(all); const has=k=>foundKeys.some(f=>new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(f));
  const coverage={found:foundKeys.filter(k=>!BEHAV_RE.test(k)).map(nameOf),missing:expect.filter(k=>!has(k)).map(nameOf),behaviour:beh.map(k=>[k,!!(all[k]&&latest(all[k]))]),verify:[]};
  const V=(t)=>{ if(!coverage.verify.includes(t)) coverage.verify.push(t); };
  Object.entries(all).forEach(([k,rows])=>{ const l=latest(rows); const first=(rows||[]).find(r=>isYear(r.year)); if(first&&(!l||l.year!==first.year)) V(`${nameOf(k)}: latest year (${yearLabel(first.year)}) is not published, is a cohort of 5 or fewer, or could not be read, so ${l?`the latest usable year is ${yearLabel(l.year)}`:'no year can be used'}.`); if(l&&l.cohort!=null&&l.cohort<11) V(`${nameOf(k)}: cohort of ${cnt(l.cohort)} – too small for reliable comparison.`); if(l&&!l.band&&!PROG_RE.test(k)) V(`${nameOf(k)}: no national banding published.`); });
  notAnalysed.forEach(k=>V(`"${k}" is in the IDSR but is not a measure this version recognises, so it is left out of the headlines and tables. Read it in the IDSR.`));
  gapMismatch.forEach(t=>V(`Disadvantaged gap left out of the headlines – ${t}. Check the IDSR.`));
  (m.warnings||[]).forEach(V);
  if(!Object.keys(m.characteristics).length) V('School characteristics table not found: context strip is empty.');
  if(!m.staffing.length) V('Staffing statements not found.');
  if(!m.suspensions) V('Suspension totals table not found.');
  if(m.phase.isSpecial) V('Special school: the IDSR publishes no national bandings, so achievement and most headlines are unavailable.');
  if(!m.charYears.length||!m.school.release) V('Release date or census years could not be read; check the header of the IDSR.');
  const smallN=mainRow&&mainRow.cohort&&mainRow.cohort<30;
  const avgLabels=[...new Set(attTable.map(r=>r.avgLabel).filter(Boolean).map(l=>(l.match(/^\d/)||[''])[0]))]; const avgHead=avgLabels.length===1&&avgLabels[0]?`${avgLabels[0]}-yr av.`:'Multi-yr av.';
  return {hasSim,overall,overallShort,avgHead,strengths,concerns,questions:rr,questionsTop:qTop,questionsMore:qMore,attTable,progTable,groupProgTable,disTable,attendTable,trendGroups,ctx,achLabel,smallN,mainRow,hasBandings:banded.length>0,avgCoverage,provisional:m.provisional||[],coverage};
}

/* ============================================================
   3. RENDER — Version A (one page) and Version B (full briefing)
   ============================================================ */
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jHTML=(j,word=true)=>j?`<span class="arrow ${j.dir>0?'up':j.dir<0?'down':'flat'}" aria-hidden="true">${j.arrow}</span>${word?` <span class="${j.dir>0?'up':j.dir<0?'down':'flat'}" style="font-weight:${j.sig?700:400}">${esc(j.word)}</span>`:`<span class="vh">${esc(j.word)}</span>`}`:'';
const todayStr=()=>new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
const CONF='Confidential · governing board papers · IDSR conditions of use apply';

function ctxCells(an){ const c=an.ctx; const pct=v=>v==null?'–':v+'%'; const gloss={fsm:'more disadvantage than most schools',dep:'more deprived area than most schools',eal:'more pupils with English as an additional language than most schools',stab:'more pupils than usual joined mid-phase',senS:'fewer pupils on SEN support than most schools'};
  const r1=v=>Math.round(v*10)/10;
  const cells=[['Pupils on roll','Pupils on roll',c.nor,v=>String(v),null],['FSM6 (free school meals, ever 6)','FSM6',c.fsm,v=>pct(r1(v)),'fsm'],['SEN support','SEN support',c.senS,v=>pct(r1(v)),'senS'],['EHC plan','EHC plan',c.ehcp,v=>pct(r1(v)),null],['English as an additional language','EAL',c.eal,v=>pct(r1(v)),'eal'],['Stability','Stability',c.stab,v=>pct(r1(v)),'stab'],['Children in need','Children in need',c.cin,v=>pct(r1(v)),null],['Location deprivation','Location deprivation',c.dep,v=>'','dep']];
  return cells.map(([label,shortLabel,v,f,g])=>{ if(!v) return {label,shortLabel,value:'–',band:'',gloss:''}; const band=v.band||''; let gl=''; if(g&&((g==='senS'||g==='stab')?v.dir<0:v.dir>0)) gl=gloss[g]; return {label,shortLabel,value:v.value!=null?f(v.value):((/^close to average/i.test(band)?'Average':band.replace(' average',''))||'–'),band:v.value!=null?band:'',gloss:gl}; }); }

function headHTML(m,an,short){ const s=m.school; const sub=short?`IDSR released ${esc(s.release||'–')} · ${esc(s.phase)} · ${esc(s.type)} · ${esc(s.la)} · URN ${esc(s.urn)}`:`<b>IDSR Governor Briefing</b> · Inspection Data Summary Report released ${esc(s.release||'–')} · ${esc(s.phase)} · ${esc(s.type)} · ${esc(s.la)} · URN ${esc(s.urn)}`;
  return `<div class="head"><div><h1>${esc(s.name)}</h1><div class="sub">${sub}</div></div><div class="conf">${m.invented?'Example · invented figures · not a real school':CONF}</div></div>`; }
function ctxHTML(an,inline){ return `<div class="ctx">${ctxCells(an).map(c=>`<div><b>${esc(c.value)}</b><span>${esc(inline?c.shortLabel:c.label)}</span><i>${esc(c.band)}${c.gloss&&!inline?` <span style="color:#555">(${esc(c.gloss)})</span>`:''}</i></div>`).join('')}</div>`; }
function attTableHTML(an,short,lean){ const rows=an.attTable.map(r=>`<tr><td>${esc(short?r.short:r.name)}${r.n!=null&&r.n<11?' <span class="warn" title="cohort of 10 or fewer pupils">†</span>':''}</td><td class="n">${esc(r.school)}</td><td class="n">${esc(r.nat)}</td><td class="n">${r.n==null?'':cnt(r.n)}</td><td class="b">${jHTML(r.j)}</td>${!short&&an.hasSim?`<td>${esc([r.sim,r.simText].filter(Boolean).join(' · '))}</td>`:''}<td class="n">${esc(r.avg)}</td><td class="b">${jHTML(r.avgJ,!short)}</td>${short?'':`<td class="c">${esc(r.year)}</td>`}</tr>`).join('');
  const prog=an.progTable.length&&!(short&&lean>=2)?`<tr class="grp"><td colspan="${short?7:(an.hasSim?9:8)}">${esc(an.achLabel.charAt(0).toUpperCase()+an.achLabel.slice(1))} progress (national = 0.0)</td></tr>`+an.progTable.map(r=>`<tr><td>${esc(r.name)}</td><td class="n">${esc(r.school)}</td><td class="n">${esc(r.nat)}</td><td class="n">${r.n==null?'':cnt(r.n)}</td><td class="b">${jHTML(r.j)}</td>${!short&&an.hasSim?'<td></td>':''}<td></td><td></td>${short?'':`<td class="c">${esc(r.year)}</td>`}</tr>`).join(''):'';
  const hdr=short?`<tr><th style="width:30%" scope="col">Measure</th><th class="n" style="width:11.5%" scope="col">School</th><th class="n" style="width:9%" scope="col">Nat.</th><th class="n" style="width:6%" scope="col">n</th><th style="width:22%" scope="col">vs national</th><th class="n" style="width:12.5%" scope="col">${esc(an.avgHead)}</th><th class="b" scope="col"><span class="vh">${esc(an.avgHead)} vs national</span></th></tr>`:`<tr><th scope="col">Measure</th><th class="n" scope="col">School</th><th class="n" scope="col">National</th><th class="n" scope="col">n</th><th scope="col">vs national</th>${an.hasSim?'<th scope="col">Similar schools (as published)</th>':''}<th class="n" scope="col">${esc(an.avgHead)}</th><th scope="col">${esc(an.avgHead)} vs national (smooths small cohorts)</th><th class="c" scope="col">Year</th></tr>`;
  return `<table${short?' style="table-layout:fixed"':''}><caption class="vh">Attainment and progress, all pupils</caption><thead>${hdr}</thead><tbody>${rows}${prog}</tbody></table>`; }
function paTableHTML(an,short){ if(!an.groupProgTable.length) return ''; const hdr=an.progTable.map(p=>`<th class="n" scope="col">${esc(p.name.replace(' progress',''))}</th><th scope="col"></th>`).join(''); return `<table><caption class="vh">Progress by prior attainment</caption><thead><tr><th scope="col">Progress by prior attainment${an.progTable[0]?`, ${esc(an.progTable[0].year)}`:''}</th>${hdr}</tr></thead><tbody>${an.groupProgTable.map(g=>`<tr><td>${esc(g.label)}</td>${g.cells.map(c=>c?`<td class="n">${esc(c.v)}</td><td class="b">${jHTML(c.j,!short)}</td>`:'<td>–</td><td></td>').join('')}</tr>`).join('')}</tbody></table>`; }
function disTableHTML(an,short){ if(!an.disTable.length) return ''; const d=an.disTable[0]; return `<table><caption class="vh">Disadvantaged pupils</caption><thead><tr><th scope="col">Disadvantaged pupils, ${esc(d.year)} (n = ${cnt(d.n)})</th><th class="n" scope="col">School</th><th class="n" scope="col">Nat. disadv.</th><th class="n" scope="col">Nat. non-disadv.</th><th class="n" scope="col">Gap</th></tr></thead><tbody>${an.disTable.map(r=>`<tr><td>${esc(r.name)}${r.sig>0?' <span class="up" title="significantly above national disadvantaged">▲▲</span>':r.sig<0?' <span class="down">▼▼</span>':''}</td><td class="n">${esc(r.school)}</td><td class="n">${esc(r.natDis)}</td><td class="n">${esc(r.natNon)}</td><td class="n"><b>${esc(r.gap)}</b></td></tr>`).join('')}</tbody></table>`; }
function attendTableHTML(an,short){ const T=an.attendTable; if(!T.length) return '';
  if(short){ const cell=(r,k,y)=>{ const v=r[k]; if(!v) return '<td class="n">–</td>'; const other=y&&v.year!==y.year?`<br><span style="font-size:85%;color:#555;white-space:nowrap">${esc(yearLabel(v.year))}</span>`:''; /* a withheld figure is a phrase, not a number: let it wrap inside its cell */ const fig=v.masked?`<span style="font-size:85%">5 or fewer<br>pupils</span>`:`<b>${esc(v.school)}</b>`; return `<td class="n" style="white-space:normal">${fig}<br><span style="font-size:85%;color:#555;white-space:nowrap">nat ${esc(v.nat)}</span>${other}</td>`; };
    const rows=[['Attendance','att'],['Persistent absence','pa'],['Pupils suspended at least once','s1']].map(([lab,k])=>{ const y=(T.find(r=>r[k])||{})[k]; return `<tr><td>${lab}${y?`<br><span style="font-size:85%;color:#555">${esc(yearLabel(y.year)+termNote(y.year))}</span>`:''}</td>${T.map(r=>cell(r,k,y)).join('')}</tr>`; }).join('');
    return `<table style="table-layout:fixed"><caption class="vh">Attendance and behaviour by pupil group</caption><thead><tr><th style="width:34%" scope="col">School vs national</th>${T.map(r=>`<th class="n" scope="col">${esc(r.label.replace('Pupils with ',''))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`; }
  const rows=T.map(r=>`<tr><td style="white-space:nowrap">${esc(r.label)}<br><span style="font-size:85%;color:#555">pupils counted: ${r.att?cnt(r.att.cohort):'–'} / ${r.s1?cnt(r.s1.cohort):'–'}</span></td>${['att','pa','s1'].map(k=>{ const y0=(T.find(x=>x[k])||{})[k]; return r[k]?`<td class="n">${esc(r[k].school)}</td><td class="n">${esc(r[k].nat)}${y0&&r[k].year!==y0.year?`<br><small>${esc(yearLabel(r[k].year))}</small>`:''}</td>`:'<td class="n">–</td><td class="n">–</td>'; }).join('')}</tr>`).join('');
  const yl=k=>{ const v=(T.find(r=>r[k])||{})[k]; return v?`<br><small>${esc(yearLabel(v.year)+termNote(v.year))}</small>`:''; };
  return `<table class="ab"><caption class="vh">Attendance and behaviour by pupil group</caption><thead><tr><th scope="col">Group</th><th class="n" scope="col">Attendance${yl('att')}</th><th class="n" scope="col">National</th><th class="n" scope="col">Persistent absence${yl('pa')}</th><th class="n" scope="col">National</th><th class="n" scope="col">Suspended at least once${yl('s1')}</th><th class="n" scope="col">National</th></tr></thead><tbody>${rows}</tbody></table>`; }
function attendNote(m,an,short){ const T=an.attendTable; const d=T.filter(r=>r.daily).map(r=>`${r.label.replace('Pupils with ','')} ${r.daily.school} (national ${r.daily.nat})`); let s=short?'Census attendance and persistent absence; suspensions from the latest full year.':'Attendance and persistent absence from the DfE census; suspensions from the latest full year.'; if(d.length&&!short) s+=` Daily attendance collection this year: ${d.join(', ')}.`; if(m.ygAbsence&&m.ygAbsence.years){ const k=Object.keys(m.ygAbsence).find(k=>/10% and above/.test(k)); if(k){ const hot=m.ygAbsence.years.map(y=>({y,v:m.ygAbsence[k][y]})).filter(x=>x.v!=null&&x.v>=15); if(hot.length) s+=` Year groups with persistent absence of 15% or more this year: ${hot.map(x=>`${x.y.replace('Y','Year ')} (${x.v}%)`).join(', ')}.`; } } return s; }
function profileItems(m,on){ const out=[]; if(m.sen.needs.length){ const byNeed=Object.create(null); m.sen.needs.forEach(n=>{ byNeed[n.need]=byNeed[n.need]||{s:0,e:0}; if(n.type==='EHCP') byNeed[n.need].e+=n.n||0; else byNeed[n.need].s+=n.n||0; }); const tops=Object.entries(byNeed).sort((a,b)=>(b[1].s+b[1].e)-(a[1].s+a[1].e)).slice(0,2).map(([k,v])=>`${k.toLowerCase()} (${cnt(v.s)} at SEN support, ${cnt(v.e)} with EHC plans)`); out.push(`SEN register: ${cnt(m.sen.support)} pupils at SEN support and ${cnt(m.sen.ehcp)} with an EHC plan; main primary needs are ${tops.join(' and ')}.${m.sen.alsoFsmCla!=null?` ${cnt(m.sen.alsoFsmCla)} pupils with SEN are also FSM6 or looked after.`:''}${m.sen.resourced?` ${m.sen.resourced}.`:''}`); }
  if(m.yearGroups.length){ const f=m.yearGroups.filter(g=>g.fsm6!=null), e=m.yearGroups.filter(g=>g.eal!=null); const mn=(a,k)=>a.reduce((x,g)=>g[k]<x[k]?g:x), mx=(a,k)=>a.reduce((x,g)=>g[k]>x[k]?g:x); const tot=k=>m.yearGroups.some(g=>g[k]==null)?'not published for every year group':cnt(m.yearGroups.reduce((a,g)=>a+g[k],0)); const ranges=[f.length?(Math.round(mn(f,'fsm6').fsm6)===Math.round(mx(f,'fsm6').fsm6)?`FSM6 is ${Math.round(mn(f,'fsm6').fsm6)}% in every year group shown`:`FSM6 ranges from ${Math.round(mn(f,'fsm6').fsm6)}% (${mn(f,'fsm6').yg}) to ${Math.round(mx(f,'fsm6').fsm6)}% (${mx(f,'fsm6').yg})`):'',e.length?(Math.round(mn(e,'eal').eal)===Math.round(mx(e,'eal').eal)?`EAL is ${Math.round(mn(e,'eal').eal)}% in every year group shown`:`EAL from ${Math.round(mn(e,'eal').eal)}% (${mn(e,'eal').yg}) to ${Math.round(mx(e,'eal').eal)}% (${mx(e,'eal').yg})`):''].filter(Boolean).join('; '); out.push(`By year group: ${ranges?ranges+'. ':''}Children in need: ${tot('cin')}; looked-after children: ${tot('cla')}; young carers: ${tot('yc')}.`); }
  if(m.ethnicity.length){ const top=[...m.ethnicity].filter(x=>x.school!=null).sort((a,b)=>b.school-a.school).slice(0,3).map(x=>`${x.group} ${x.school}%`); if(top.length) out.push(`Largest ethnic groups: ${top.join(', ')}.`); }
  if(m.ap.length) out.push(m.ap.every(t=>/no data|incomplete/i.test(t))?'No pupils recorded in alternative provision in the latest terms.':SUPPRESS?'Pupils are recorded in alternative provision; the figures are in the IDSR and are not repeated here while small numbers are hidden.':`Alternative provision: ${m.ap.join(' ')}`);
  return out; }
function trendsHTML(an,short){ if(!an.trendGroups.length) return '<p class="note">Not enough years of data for trends.</p>'; return `<table class="tr" style="table-layout:fixed"><caption class="vh">Trends over time</caption>${an.trendGroups.map(g=>`<thead><tr><th style="width:30%" scope="col">${esc(g.title)}</th><th class="n" style="width:36%" scope="col">Oldest → latest</th><th style="width:18%" scope="col">Comparator</th><th scope="col">Latest vs national</th></tr></thead><tbody>${g.rows.map(r=>`<tr><td>${esc(r.label)}</td><td class="n s"><b>${r.values.map(v=>`<span>${esc(v)}</span>`).join(' → ')}</b></td><td>${esc(r.comp)}</td><td>${jHTML(r.j)}</td></tr>`).join('')}</tbody>`).join('')}</table>`; }
/* The toolkit themes a set of questions relates to, each with its paraphrased expected standard, listed once. */
const MORE_NOTE='These also fired from the data but rank below the questions above. They are listed without evidence lines.';
function morePromptsHTML(an){ const l=an.questionsMore||[]; return l.length?`<div class="keep"><h3 style="margin:8pt 0 4pt">Further prompts</h3><p class="note" style="margin:0 0 4pt">${esc(MORE_NOTE)}</p><ul class="q">${l.map(q=>`<li><span class="tag">${esc(AREAS[q.area])}</span><span class="vh">: </span>${esc(q.q)}</li>`).join('')}</ul></div>`:''; }
function toolkitThemes(qs){ return [...new Set(qs.map(q=>q.ref).filter(Boolean))].map(k=>TOOLKIT.refs[k]).filter(r=>r&&r.theme&&r.gist); }
function qHTML(qs,grouped){ if(!qs.length) return '<p class="note">No questions generated.</p>'; if(grouped){ const areas=[...new Set(qs.map(q=>q.area))]; return areas.map(a=>{ const list=qs.filter(q=>q.area===a); const th=toolkitThemes(list); return `<div class="keep"><h3 style="margin:8pt 0 4pt">${esc(AREAS[a])}</h3>${th.length?`<p class="note" style="margin:0 0 4pt"><b>What the toolkit looks for (paraphrased):</b> ${th.map(r=>`<i>${esc(r.theme)}</i> – ${esc(r.gist)}`).join('; ')}.</p>`:''}<ul class="q">${list.map(q=>`<li>${esc(q.q)}${q.ref&&TOOLKIT.refs[q.ref].theme?` <span style="color:#555;font-size:88%">[Toolkit: ${esc(refLabel(q.ref))}]</span>`:''}${q.ev?`<span class="qev" style="display:block;margin-top:1.5pt;color:#333;font-size:92%"><b>Evidence to expect:</b> ${esc(q.ev)}</span>`:''}</li>`).join('')}</ul></div>`; }).join(''); } return `<ul class="q">${qs.map(q=>`<li><span class="tag">${esc(AREAS[q.area])}</span><span class="vh">: </span>${esc(q.q)}</li>`).join('')}</ul>`; }
const KEY='The IDSR publishes two things for most measures and this briefing keeps them apart: a banding (where the school sits among all schools: above, close to average, below) and a significance test against the national figure. ▲▲ / ▼▼ = statistically significantly above / below national; the words beside the arrows always say so. For context measures, which have no significance test, ▲▲ / ▼▼ mean well above / well below average. ▲ / ▼ = above / below, not statistically significant. ≈ = close to average. For absence and suspensions lower is better, so arrows and words say better or worse than national. n = number of pupils counted. pp = percentage points. † = cohort of 10 or fewer pupils; treat with great caution. Counts of 5 or fewer are shown as "5 or fewer" when small numbers are hidden.';
const ACR='RWM reading, writing and maths · GPS (EGPS) English grammar, punctuation and spelling · FSM6 eligible for free school meals at any time in the last six years · EHC education, health and care plan · EAL English as an additional language · SEN special educational needs · CIN children in need · persistent absence = 10% or more of sessions missed.';
function sourceText(m){ const s=m.school; return `${m.invented?'EXAMPLE WITH INVENTED FIGURES – not a real school. ':''}Source: Ofsted Inspection Data Summary Report for ${s.name}${s.urn?` (URN ${s.urn})`:''}${s.release?`, released ${s.release}`:''}, using DfE census, attendance, exclusions and assessment data. The IDSR guides inspectors' conversations with leaders; it is not a judgement of the school, and this briefing is not an Ofsted judgement, grade or prediction. Verify against the IDSR before use. Contains IDSR data: do not publish it, and share it only with people authorised to see the school's IDSR.${SUPPRESS?'':' Small numbers are SHOWN in this copy and may identify individual pupils: do not circulate it beyond those who need it.'} Rule-based: no AI was used. Prepared ${todayStr()} with GovernorBrief v${VERSION} (pilot version), an independent tool not affiliated with or endorsed by Ofsted or the DfE. Layout and method © GovernorBrief ${new Date().getFullYear()}. IDSR data © Crown copyright.`; }
function suspensionReasonsNote(m){ const s=m.suspensions; if(!s||!s.reasons||!s.reasons.length) return ''; if(SUPPRESS) return 'Suspension reasons are in the IDSR and are not repeated here while small numbers are hidden. '; const y=s.years[s.years.length-1]; const list=s.reasons.map(r=>({r:r.reason,n:r.byYear[y]})).filter(x=>x.n).sort((a,b)=>b.n-a.n).map(x=>`${String(x.r).toLowerCase()} (${x.n})`).join('; ')||'none recorded'; return `Suspension reasons in the latest year: ${list}. `; }
function smallNote(an){ return an.smallN?`With ${an.mainRow.cohort} pupils in the cohort, one pupil moves a result by about ${Math.round(100/an.mainRow.cohort*10)/10} percentage points, so single-year changes and "close to average" bandings should be read with care. Where the single year and the multi-year average disagree, the multi-year figure is the more reliable signal.`:'Where the single year and the multi-year average disagree, the multi-year figure is the more reliable signal.'; }

/* Accessibility: mark the first cell of every data row as its row header (group rows and spanning cells are left alone). */
const rowHeaders=html=>html.replace(/<tr><td( style="[^"]*")?>([\s\S]*?)<\/td>/g,(x,st,inner)=>`<tr><th scope="row" class="rh"${st||''}>${inner}</th>`);
function renderA0(m,an,on,plan){ plan=plan||{hs:4,cs:4,qs:4}; const li=x=>`<li>${esc(x.text)}</li>`;
  const shown=`Priority view: showing ${Math.min(plan.hs,an.strengths.length)} of ${an.strengths.length} strengths, ${Math.min(plan.cs,an.concerns.length)} of ${an.concerns.length} areas for attention and ${Math.min(plan.qs,an.questions.length)} of ${an.questions.length} governor questions, in priority order. Everything, with the evidence trail, is in the full briefing (Version B).`; const special=m.phase.isSpecial||!an.hasBandings;
  const col2=special?`<div class="sec"><h2>Pupil profile</h2><ul>${profileItems(m,on).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p class="note">No national comparisons or bandings were read for this school (${m.phase.isSpecial?'the IDSR does not publish them for special schools':an.coverage.found.length?'the IDSR gives no national banding for its results, usually because the cohorts are very small':'the IDSR has not published any achievement comparisons for it'}), so there is no attainment table.</p></div>`:
    `<div class="sec"><h2>Attainment and progress <small>all pupils, latest published year</small></h2>${attTableHTML(an,true,plan.lean||0)}<p class="note">${esc(an.attTable[0]?`${an.achLabel.charAt(0).toUpperCase()+an.achLabel.slice(1)} ${an.attTable[0].year}${an.provisional.includes(an.attTable[0].year)?' (provisional)':''}${an.attTable.some(r=>r.year!==an.attTable[0].year)?'; other measures latest available year':''}.`:'')} ${esc(an.avgHead)} = the IDSR's multi-year average, the more reliable signal where the two disagree.${an.smallN?` One pupil ≈ ${Math.round(100/an.mainRow.cohort*10)/10} pp.`:''}${an.disTable.length&&!(plan.lean>=1)?` Disadvantaged (n = ${cnt(an.disTable[0].n)}): ${an.disTable.map(r=>`${esc(r.name.replace(' expected',''))} ${esc(r.school)}`).join(', ')} vs national non-disadvantaged ${an.disTable.map(r=>esc(r.natNon)).join(' / ')}.`:''}${plan.lean>=2&&an.progTable.length?' Progress measures are in Version B.':''}</p></div>`;
  const qs=pickOnePage(an.questions,plan.qs).map(q=>Object.assign({},q,{q:q.brief||q.q}));   // one page: the short form
  return `<div class="doc va" id="doc">${headHTML(m,an,true)}${ctxHTML(an,true)}${an.overallShort?`<p style="margin:0 0 5pt;font-size:8.6pt"><b>${esc(an.overallShort)}</b></p>`:''}
    <div class="cols cols3"><div><div class="sec box str"><h3>Strengths <small style="font-weight:400;color:#555">(top ${Math.min(plan.hs,an.strengths.length)} of ${an.strengths.length})</small></h3><ul>${an.strengths.slice(0,plan.hs).map(li).join('')||'<li>Nothing significantly above national in the latest data.</li>'}</ul></div><div class="box con"><h3>Areas for governor attention <small style="font-weight:400;color:#555">(top ${Math.min(plan.cs,an.concerns.length)} of ${an.concerns.length})</small></h3><ul>${an.concerns.slice(0,plan.cs).map(li).join('')||'<li>Nothing banded below national in the latest data.</li>'}</ul></div></div>
    <div>${col2}</div>
    <div><div class="sec"><h2>Attendance and behaviour <small>by pupil group</small></h2>${attendTableHTML(an,true)}<p class="note">${esc(attendNote(m,an,true))}</p></div><div><h2>Key questions for governors <small>${Math.min(plan.qs,an.questions.length)} of ${an.questions.length} · highest priority first, no more than two from one area</small></h2>${qHTML(qs,false)}</div></div></div>
    <div class="foot"><p>${esc(shown)}${(n=>n?` <b>${n} point${n>1?'s':''} to check before use: see Appendix B of Version B.</b>`:'')(Math.max((m.warnings||[]).length,((an.coverage||{}).verify||[]).length))}</p><p><b>Key.</b> ▲▲ / ▼▼ statistically significantly above / below national (or well above / well below where the IDSR gives no test) · ▲ / ▼ above / below, not significant · ≈ close to average; for absence and suspensions the arrows mean better or worse than national · n = pupils counted · pp = percentage points · † 10 or fewer pupils · RWM = reading, writing and maths · GPS = grammar, punctuation and spelling · FSM6 = free school meals in the last six years · SEN = special educational needs · EHC = education, health and care · EAL = English as an additional language. ${m.invented?'<b>Example with invented figures.</b> ':''}Source: Ofsted IDSR${m.school.release?` released ${esc(m.school.release)}`:''}; not an Ofsted judgement; verify against the IDSR; do not publish or share beyond those authorised to see the IDSR. Full detail and all questions: Version B. Prepared ${todayStr()} · GovernorBrief pilot, an independent tool not affiliated with Ofsted or the DfE · Layout © GovernorBrief; IDSR data © Crown copyright.</p></div></div>`; }

function evidenceRows(an){ const rows=[]; let n=0; [['Strength',an.strengths],['Attention',an.concerns]].forEach(([type,list])=>list.forEach(h=>{ n++; h.ref=n; (h.ev&&h.ev.length?h.ev:[{section:'',group:'',measure:'(derived from the measures above)',year:'',cohort:null,school:'',nat:'',band:'',trend:''}]).forEach(e=>{ const r={ref:n,type,text:h.text,...e}; const prose=v=>v!=null&&String(v).length>16&&!/^[\d.,%+\-–−\s()\/]+$/.test(String(v)); ['school','nat'].forEach(k=>{ if(prose(r[k])){ r.trend=[r.trend,r[k]].filter(Boolean).join(' · '); r[k]='–'; } }); rows.push(r); }); })); return rows; }
function evidenceHTML(an){ const rows=evidenceRows(an); return `<table class="ev" style="table-layout:fixed"><caption class="vh">Evidence trail</caption><thead><tr><th scope="col" class="k" style="width:3.5%">#</th><th scope="col" style="width:21%">Headline</th><th scope="col" style="width:13%">IDSR section · group</th><th scope="col" style="width:14%">Measure</th><th scope="col" style="width:8%">Year</th><th class="n k" scope="col" style="width:4.5%">n</th><th class="n" scope="col" style="width:10%">School</th><th class="n" scope="col" style="width:11.5%">National</th><th scope="col">Banding / trend as published</th></tr></thead><tbody>${rows.map((r,i)=>`${i>0&&rows[i-1].ref!==r.ref?'</tbody><tbody>':''}<tr><td class="k">${i===0||rows[i-1].ref!==r.ref?r.ref:''}</td><td>${i===0||rows[i-1].ref!==r.ref?`<span class="tag">${r.type}</span>${esc(r.text)}`:''}</td><td>${esc([r.section,r.group].filter(Boolean).join(' · '))}</td><td>${esc(nameOf(r.measure||''))}</td><td>${esc(yearLabel(r.year||''))}</td><td class="n k">${r.cohort==null?'':cnt(r.cohort)}</td><td class="n">${esc(r.school||'')}${r.gap?`<br><small>gap ${esc(r.gap)}</small>`:''}</td><td class="n">${esc(r.nat||'')}${r.natOther?`<br><small>non-disadv. ${esc(r.natOther)}</small>`:''}</td><td>${esc([r.band,r.trend].filter(x=>x&&!/not available/i.test(x)).join(' · '))}</td></tr>`).join('')}</tbody></table>`; }
function coverageHTML(an){ const c=an.coverage; return `<div class="cols"><div><h3>Extracted from the IDSR</h3><p style="margin:0 0 6pt">${c.found.length?esc(c.found.join(' · ')):'No achievement measures.'}</p><p style="margin:0">Attendance and behaviour: ${c.behaviour.map(([k,ok])=>`${esc(k)} ${ok?'✓':'– not found'}`).join(' · ')}.</p></div><div><h3>Not found (expected for this phase)</h3><p style="margin:0 0 6pt">${c.missing.length?esc(c.missing.join(' · ')):'None – all expected measures were found.'}</p><h3>Check manually against the IDSR</h3>${c.verify.length?`<ul>${c.verify.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p style="margin:0">Nothing flagged.</p>'}</div></div>`; }
function renderB0(m,an,on){ evidenceRows(an); const li=x=>`<li>${esc(x.text)} <sup style="color:#1B6368;font-weight:700">[${x.ref}]</sup></li>`; const run=`<div class="running"><span>${esc(m.school.name)} · IDSR Governor Briefing</span><span>${CONF}</span></div>`; const special=m.phase.isSpecial||!an.hasBandings;
  const p1=`<div class="page">${headHTML(m,an,false)}${ctxHTML(an,false)}<p class="note" style="margin:0 0 12pt">School census ${esc(an.ctx.year||'')}. Bandings compare the school with all schools in the same phase nationally (±0.5 standard deviations = above/below; ±1 = well above/below). For FSM6, deprivation and children in need, "above average" means more disadvantage than most schools; it describes context, not performance.</p>
    <div class="sec"><h2>1. Key headlines</h2>${an.overall?`<p style="margin:0 0 8pt"><b>${esc(an.overall)}</b></p>`:''}<div class="cols"><div class="box str"><h3>Strengths – where the data is favourable</h3><ul>${an.strengths.map(li).join('')||'<li>Nothing significantly above national in the latest data.</li>'}</ul></div><div class="box con"><h3>Areas for governor attention</h3><ul>${an.concerns.map(li).join('')||'<li>Nothing banded below national in the latest data.</li>'}</ul></div></div></div></div>`;
  const p2=special?`<div class="page">${run}<div class="sec"><h2>3. Achievement</h2><p>${m.phase.isSpecial?'No national comparisons, bandings or summary tables were read for this school (the IDSR does not publish them for special schools)':an.coverage.found.length?'The IDSR gives no national banding for this school\'s results, usually because the cohorts are very small. The measures it does publish are listed in Appendix B and should be read in the IDSR itself':'No national comparisons, bandings or summary tables were read for this school (the IDSR has not published any achievement comparisons for it)'}, so this briefing cannot report attainment or progress against national figures. Governors should rely on the school's own evidence of progress from pupils' starting points.</p></div></div>`:
    `<div class="page">${run}<div class="sec"><h2>3. Attainment and progress <small>all pupils, latest published year per measure</small></h2>${attTableHTML(an,false)}<p class="note">${esc(smallNote(an))} The multi-year averages are the IDSR's own figures.${an.hasSim?' Similar schools: the IDSR\'s comparison with a group of schools that have similar pupils, quoted exactly as published; it adds context and does not change any headline.':''}${an.provisional.length?` ${esc(an.provisional.join(', '))} data is provisional.`:''}</p></div>${an.groupProgTable.length?`<div class="sec">${paTableHTML(an,false)}<p class="note">Progress scores compare pupils with others nationally who had the same starting points. National average = 0.0.</p></div>`:''}</div>`;
  const prof=profileItems(m,on);
  const p3=`<div class="page">${run}<div class="sec"><h2>4. Pupil groups <small>inclusion lens</small></h2>${an.disTable.length?`${disTableHTML(an,false)}<p class="note">Gap = school disadvantaged minus national non-disadvantaged; a positive gap means the school's disadvantaged pupils did better. ▲▲ marks a result significantly above national disadvantaged pupils.</p>`:'<p class="note">No disadvantaged comparison is shown: either the IDSR does not publish one for this school or it could not be read. Appendix B lists anything that needs checking.</p>'}</div>
    ${an.attendTable.length?`<div class="sec">${attendTableHTML(an,false)}<p class="note">${esc(attendNote(m,an))}</p></div>`:''}${prof.length?`<div class="sec"><h3>Pupil profile</h3><ul>${prof.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}</div>`;
  const howTo=`<div class="sec"><h3>How to read this briefing</h3><p style="margin:0 0 6pt">${esc(KEY)}</p><p style="margin:0"><b>Acronyms.</b> ${esc(ACR)}</p></div>`;
  const p4=`<div class="page">${run}<div class="sec"><h2>5. Trends over time</h2>${trendsHTML(an,false)}<p class="note">${esc(suspensionReasonsNote(m))}* = part-year figure. 2022 outcomes may reflect pandemic disruption.</p></div></div>`;
  const p5=`<div class="page">${run}<div class="sec"><h2>2. Key questions for governors <small>grouped by inspection toolkit evaluation area</small></h2><p class="note" style="margin:0 0 8pt">Questions are prompts for assurance, generated by fixed rules from the patterns in the data. They do not assert a cause; leaders' answers and the school's own evidence decide what the data means. Under each question, "Evidence to expect" suggests what the board could ask to see; it is a prompt, not a requirement. Each question is linked to a theme in the ${esc(TOOLKIT.title)}. The descriptions of what the toolkit looks for are short paraphrases of its expected standard, not Ofsted's wording: read the toolkit itself for the full text. The IDSR does not evidence every toolkit area: safeguarding and personal development and wellbeing are not covered by this data.</p>${qHTML(an.questionsTop||an.questions,true)}${morePromptsHTML(an)}</div></div>`;
  const p6=`<div class="page appx">${run}<div class="sec"><h2>Appendix A. Evidence trail <small>every headline traced to its IDSR source row</small></h2>${evidenceHTML(an)}<p class="note">Bandings and trends are quoted exactly as the IDSR publishes them ("sig+" = statistically significantly above; "non-sig" = within the confidence interval). Multi-year averages are the IDSR's own.</p></div>
    <div class="sec"><h2>Appendix B. Data coverage <small>what was extracted, what was not, and what to check by hand</small></h2>${coverageHTML(an)}</div><div class="foot"><p>${esc(sourceText(m))}</p></div></div>`;
  return `<div class="doc vb" id="doc">${p1.replace(/<\/div>$/,howTo+'</div>')}${p5}${p2}${p3}${p4}${p6}</div>`; }
const renderA=(...a)=>rowHeaders(renderA0(...a));
const renderB=(...a)=>rowHeaders(renderB0(...a));
