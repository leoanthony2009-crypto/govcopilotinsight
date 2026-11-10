/* ============================================================
   4. WORD EXPORT (docx)
   ============================================================ */
function buildDocx(m,an,on){
  const D=window.docx; if(!D) throw new Error('The Word library did not load. Reload the page and try again.');
  const special=m.phase.isSpecial||!an.hasBandings;
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ShadingType,AlignmentType,BorderStyle,HeadingLevel,Header,Footer,PageNumber,LevelFormat,PageBreak,VerticalAlign}=D;
  const NAVY='0B5D5A',TEAL='1E7A3C',AMBER='8A5500',GREY='E4F0EF',LINE='CFD3DB',MUTED='444444',FONT='Arial';
  const PAGE_W=11906,MARGIN=794,CW=PAGE_W-2*MARGIN;
  const run=(t,o={})=>new TextRun({text:t,font:FONT,size:o.size||20,bold:o.bold,color:o.color,italics:o.italics});
  const para=(ch,o={})=>new Paragraph({children:Array.isArray(ch)?ch:[run(ch,o)],spacing:{before:o.before??0,after:o.after??80,line:o.line??276},alignment:o.align,keepNext:o.keepNext});
  const noB={style:BorderStyle.NONE,size:0,color:'FFFFFF'}, hair={style:BorderStyle.SINGLE,size:4,color:LINE};
  const cell=(ch,w,o={})=>new TableCell({children:Array.isArray(ch)?ch:[ch],width:{size:w,type:WidthType.DXA},shading:o.fill?{type:ShadingType.CLEAR,fill:o.fill,color:'auto'}:undefined,margins:{top:o.pad??60,bottom:o.pad??60,left:90,right:90},borders:o.borders||{top:hair,bottom:hair,left:noB,right:noB},verticalAlign:VerticalAlign.TOP,columnSpan:o.span});
  const tcell=(t,w,o={})=>cell(para([run(t,{size:o.size||19,bold:o.bold,color:o.color})],{after:0,align:o.align,line:240}),w,o);
  const table=(ws,rows)=>new Table({width:{size:ws.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:ws,rows});
  const R=AlignmentType.RIGHT;
  const hrow=(labels,ws,al=[])=>new TableRow({tableHeader:true,cantSplit:true,children:labels.map((l,i)=>tcell(l,ws[i],{bold:true,color:NAVY,fill:GREY,size:17,align:al[i]}))});
  const jt=j=>j?`${j.arrow} ${j.word}`:''; const jc=j=>!j?MUTED:j.dir>0?TEAL:j.dir<0?'8F4208':'555555';
  const h2=(t,note)=>new Paragraph({heading:HeadingLevel.HEADING_1,children:[run(t,{size:25,bold:true,color:'FFFFFF'}),...(note?[run('   '+note,{size:17,color:'E4F0EF'})]:[])],shading:{type:ShadingType.CLEAR,fill:NAVY,color:'auto'},spacing:{before:240,after:140},keepNext:true});
  const h3=(t,c=NAVY)=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[run(t,{size:22,bold:true,color:c})],spacing:{before:160,after:80},keepNext:true});
  const note=t=>para([run(t,{size:17,color:MUTED})],{after:120,line:250});
  const bullets=(items,ref)=>items.map(t=>new Paragraph({children:[run(t,{size:20})],numbering:{reference:ref,level:0},spacing:{after:70,line:270}}));
  const body=[]; const s=m.school; evidenceRows(an);
  body.push(new Paragraph({children:[run(s.name,{size:40,bold:true,color:NAVY})],spacing:{after:40}}));
  body.push(para([run('IDSR Governor Briefing',{size:19,bold:true,color:MUTED}),run(` · Inspection Data Summary Report released ${s.release||'–'} · ${s.phase} · ${s.type} · ${s.la} · URN ${s.urn}`,{size:19,color:MUTED})],{after:60}));
  body.push(new Paragraph({children:[run('',{size:4})],border:{bottom:{style:BorderStyle.SINGLE,size:18,color:NAVY,space:2}},spacing:{after:200}}));
  const cw=Math.floor(CW/4), cws=[cw,cw,cw,CW-3*cw]; const cc=ctxCells(an);
  const tileRow=items=>new TableRow({cantSplit:true,children:items.map((c,i)=>cell([para([run(c.value,{size:28,bold:true,color:NAVY})],{after:0,line:240}),para([run(c.label,{size:17,color:'333333'})],{after:0,line:240}),para([run(c.band+(c.gloss?` (${c.gloss})`:''),{size:17,bold:true,color:'444444'})],{after:0,line:240})],cws[i],{pad:90,borders:{top:{style:BorderStyle.SINGLE,size:24,color:NAVY},bottom:hair,left:hair,right:hair}}))});
  body.push(table(cws,[tileRow(cc.slice(0,4)),tileRow(cc.slice(4,8))]));
  body.push(note(`School census ${an.ctx.year||''}. Bandings compare the school with all schools in the same phase nationally. For FSM6, deprivation and children in need, "above average" means more disadvantage than most schools; it describes context, not performance.`));
  body.push(h2('1. Key headlines'));
  const half=Math.floor(CW/2);
  body.push(table([half,CW-half],[new TableRow({children:[cell([h3('Strengths – where the data is favourable',TEAL),...bullets(an.strengths.map(x=>`${x.text} [${x.ref}]`),'sq')],half,{pad:100,borders:{top:hair,bottom:hair,right:hair,left:{style:BorderStyle.SINGLE,size:36,color:TEAL}}}),cell([h3('Areas for governor attention',AMBER),...bullets(an.concerns.map(x=>`${x.text} [${x.ref}]`),'tri')],CW-half,{pad:100,borders:{top:hair,bottom:hair,right:hair,left:{style:BorderStyle.SINGLE,size:36,color:'B8730A'}}})]})]));
  body.push(new Paragraph({children:[new PageBreak()]}));
  if(!special&&an.attTable.length){
    body.push(h2('2. Attainment and progress','all pupils, latest published year per measure'));
    const aw=[3000,900,1000,600,1500,1000,1518,800]; const rows=[hrow(['Measure','School','National','n','vs national',an.avgHead,an.avgHead+' vs national','Year'],aw,[null,R,R,R,null,R,null,AlignmentType.CENTER])];
    an.attTable.forEach(r=>rows.push(new TableRow({cantSplit:true,children:[tcell(r.name+(r.n!=null&&r.n<11?' †':''),aw[0]),tcell(r.school,aw[1],{align:R}),tcell(r.nat,aw[2],{align:R}),tcell(String(r.n??''),aw[3],{align:R}),tcell(jt(r.j),aw[4],{color:jc(r.j)}),tcell(r.avg,aw[5],{align:R}),tcell(jt(r.avgJ),aw[6],{color:jc(r.avgJ)}),tcell(r.year,aw[7],{align:AlignmentType.CENTER})]})));
    if(an.progTable.length){ rows.push(new TableRow({cantSplit:true,children:[tcell(`${an.achLabel.charAt(0).toUpperCase()+an.achLabel.slice(1)} progress (national = 0.0)`,CW,{bold:true,color:NAVY,fill:GREY,size:17,span:8})]})); an.progTable.forEach(r=>rows.push(new TableRow({cantSplit:true,children:[tcell(r.name,aw[0]),tcell(r.school,aw[1],{align:R}),tcell(r.nat,aw[2],{align:R}),tcell(String(r.n??''),aw[3],{align:R}),tcell(jt(r.j),aw[4],{color:jc(r.j)}),tcell('',aw[5]),tcell('',aw[6]),tcell(r.year,aw[7],{align:AlignmentType.CENTER})]}))); }
    body.push(table(aw,rows)); body.push(note(smallNote(an)+` The multi-year averages are the IDSR's own figures.`+(an.provisional.length?` ${an.provisional.join(', ')} data is provisional.`:'')));
    if(an.groupProgTable.length){ const n=an.progTable.length; const pw=[2800].concat(Array(n*2).fill(0).map((_,i)=>i%2?Math.floor((CW-2800)/n)-900:900)); const rows2=[hrow(['Progress by prior attainment'].concat(an.progTable.flatMap(p=>[p.name.replace(' progress',''),''])),pw,[null].concat(an.progTable.flatMap(()=>[R,null])))];
      an.groupProgTable.forEach(g=>rows2.push(new TableRow({cantSplit:true,children:[tcell(g.label,pw[0])].concat(g.cells.flatMap((c,i)=>[tcell(c?c.v:'–',pw[1+i*2],{align:R}),tcell(c?jt(c.j):'',pw[2+i*2],{color:c?jc(c.j):MUTED})]))}))); body.push(para('',{after:120})); body.push(table(pw,rows2)); body.push(note('Progress scores compare pupils with others nationally who had the same starting points. National average = 0.0.')); }
  } else { body.push(h2('2. Achievement')); body.push(para('No national comparisons, bandings or summary tables were read for this school ('+(m.phase.isSpecial?'the IDSR does not publish them for special schools':'the IDSR has not published any achievement comparisons for it')+'), so this briefing cannot report attainment or progress against national figures. Governors should rely on the school\'s own evidence of progress from pupils\' starting points.')); }
  body.push(new Paragraph({children:[new PageBreak()]}));
  body.push(h2('3. Pupil groups','inclusion lens'));
  if(an.disTable.length){ const dw=[4318,1500,1500,1800,1200]; const d=an.disTable[0]; const rows=[hrow([`Disadvantaged pupils, ${d.year} (n = ${d.n})`,'School','Nat. disadv.','Nat. non-disadv.','Gap'],dw,[null,R,R,R,R])]; an.disTable.forEach(r=>rows.push(new TableRow({cantSplit:true,children:[tcell(r.name+(r.sig>0?' ▲▲':r.sig<0?' ▼▼':''),dw[0]),tcell(r.school,dw[1],{align:R}),tcell(r.natDis,dw[2],{align:R}),tcell(r.natNon,dw[3],{align:R}),tcell(r.gap,dw[4],{align:R,bold:true})]}))); body.push(table(dw,rows)); body.push(note('Gap = school disadvantaged minus national non-disadvantaged; a positive gap means the school\'s disadvantaged pupils did better. ▲▲ marks a result significantly above national disadvantaged pupils.')); }
  else body.push(note('No disadvantaged comparison is shown: either the IDSR does not publish one for this school or it could not be read. Appendix B lists anything that needs checking.'));
  if(an.attendTable.length){ const gw=[2218,1350,1250,1500,1250,1500,1250]; const T=an.attendTable; const yl=k=>{ const v=(T.find(r=>r[k])||{})[k]; return v?' '+yearLabel(v.year)+termNote(v.year):''; }; const rows=[hrow(['Group','Attendance'+yl('att'),'National','Persistent absence'+yl('pa'),'National','Suspended at least once'+yl('s1'),'National'],gw,[null,R,R,R,R,R,R])];
    T.forEach(r=>rows.push(new TableRow({cantSplit:true,children:[cell([para([run(r.label,{size:19})],{after:0,line:240}),para([run(`pupils counted: ${r.att?r.att.cohort:'–'} / ${r.s1?r.s1.cohort:'–'}`,{size:15,color:MUTED})],{after:0,line:240})],gw[0])].concat(['att','pa','s1'].flatMap((k,i)=>[tcell(r[k]?r[k].school:'–',gw[1+i*2],{align:R}),tcell(r[k]?r[k].nat:'–',gw[2+i*2],{align:R})]))}))); body.push(para('',{after:120})); body.push(table(gw,rows)); body.push(note(attendNote(m,an))); }
  const prof=profileItems(m,on); if(prof.length){ body.push(h3('Pupil profile')); body.push(...bullets(prof,'dot')); }
  body.push(new Paragraph({children:[new PageBreak()]}));
  body.push(h2('4. Trends over time'));
  if(an.trendGroups.length){ const tw=[3000,3900,2018,1400]; const rows=[]; an.trendGroups.forEach(g=>{ rows.push(hrow([g.title,'Oldest → latest','Comparator','Latest vs national'],tw,[null,R,null,null])); g.rows.forEach(r=>rows.push(new TableRow({cantSplit:true,children:[tcell(r.label,tw[0]),tcell(r.values.join(' → '),tw[1],{align:R,bold:true}),tcell(r.comp,tw[2]),tcell(jt(r.j),tw[3],{color:jc(r.j)})]}))); }); body.push(table(tw,rows)); }
  body.push(note(suspensionReasonsNote(m)+'* = part-year figure. 2022 outcomes may reflect pandemic disruption.'));
  body.push(h3('How to read this briefing')); body.push(para(KEY,{after:100})); body.push(para([run('Acronyms. ',{bold:true}),run(ACR)],{after:100}));
  body.push(new Paragraph({children:[new PageBreak()]}));
  body.push(h2('5. Key questions for governors','grouped by inspection toolkit evaluation area'));
  body.push(note('Questions are prompts for assurance, generated by fixed rules from the patterns in the data. They do not assert a cause; leaders\' answers and the school\'s own evidence decide what the data means. The IDSR does not evidence every toolkit area: safeguarding and personal development and well-being are not covered by this data.'));
  [...new Set(an.questions.map(q=>q.area))].forEach(a=>{ body.push(h3(AREAS[a])); body.push(...bullets(an.questions.filter(q=>q.area===a).map(q=>q.q),'q')); });
  body.push(new Paragraph({children:[new PageBreak()]}));
  body.push(h2('Appendix A. Evidence trail','every headline traced to its IDSR source row'));
  { const ew=[420,2250,1400,1450,900,500,850,900,1648]; const rows=[hrow(['#','Headline','IDSR section · group','Measure','Year','n','School','Nat.','Banding / trend as published'],ew,[null,null,null,null,null,R,R,R,null])]; const er=evidenceRows(an);
    er.forEach((r,i)=>{ const first=i===0||er[i-1].ref!==r.ref; rows.push(new TableRow({cantSplit:true,children:[tcell(first?String(r.ref):'',ew[0],{size:15}),tcell(first?`${r.type}: ${r.text}`:'',ew[1],{size:15}),tcell([r.section,r.group].filter(Boolean).join(' · '),ew[2],{size:15}),tcell(nameOf(r.measure||''),ew[3],{size:15}),tcell(yearLabel(r.year||''),ew[4],{size:15}),tcell(r.cohort==null?'':String(r.cohort),ew[5],{size:15,align:R}),tcell((r.school||'')+(r.gap?` (gap ${r.gap})`:''),ew[6],{size:15,align:R}),tcell((r.nat||'')+(r.natOther?` / non-disadv. ${r.natOther}`:''),ew[7],{size:15,align:R}),tcell([r.band,r.trend].filter(x=>x&&!/not available/i.test(x)).join(' · '),ew[8],{size:15})]})); });
    body.push(table(ew,rows)); body.push(note('Bandings and trends are quoted exactly as the IDSR publishes them ("sig+" = statistically significantly above; "non-sig" = within the confidence interval). Multi-year averages are the IDSR\'s own.')); }
  body.push(h2('Appendix B. Data coverage','what was extracted, what was not, and what to check by hand'));
  { const c=an.coverage; body.push(h3('Extracted from the IDSR')); body.push(para(c.found.length?c.found.join(' · '):'No achievement measures.')); body.push(para('Attendance and behaviour: '+c.behaviour.map(([k,ok])=>`${k} ${ok?'✓':'– not found'}`).join(' · ')+'.'));
    body.push(h3('Not found (expected for this phase)')); body.push(para(c.missing.length?c.missing.join(' · '):'None – all expected measures were found.'));
    body.push(h3('Check manually against the IDSR')); if(c.verify.length) body.push(...bullets(c.verify,'dot')); else body.push(para('Nothing flagged.')); }
  body.push(new Paragraph({children:[run(sourceText(m),{size:17,color:MUTED})],border:{top:{style:BorderStyle.SINGLE,size:6,color:'9AA3B5',space:6}},spacing:{before:240}}));
  const lvl=(t,c,bold)=>[{level:0,format:LevelFormat.BULLET,text:t,alignment:AlignmentType.LEFT,style:{run:{color:c,font:'Arial',bold},paragraph:{indent:{left:360,hanging:260}}}}];
  const doc=new Document({creator:'IDSR Governor Briefing',title:`${s.name} – IDSR Governor Briefing`,
    styles:{default:{document:{run:{font:FONT,size:20}}},paragraphStyles:[{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:FONT,size:25,bold:true,color:'FFFFFF'},paragraph:{spacing:{before:240,after:140},keepNext:true,outlineLevel:0}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:FONT,size:22,bold:true,color:NAVY},paragraph:{spacing:{before:160,after:80},keepNext:true,outlineLevel:1}}]},
    numbering:{config:[{reference:'sq',levels:lvl('■',TEAL)},{reference:'tri',levels:lvl('▲','B8730A')},{reference:'dot',levels:lvl('●',NAVY)},{reference:'q',levels:lvl('Q',NAVY,true)}]},
    sections:[{properties:{page:{size:{width:PAGE_W,height:16838},margin:{top:MARGIN,bottom:900,left:MARGIN,right:MARGIN,header:450,footer:450}}},
      headers:{default:new Header({children:[para([run(s.name+' · IDSR Governor Briefing',{size:15,color:MUTED}),run('\t'+(m.invented?'Example · invented figures · not a real school':CONF),{size:15,color:NAVY,bold:true})],{after:0})]})},
      footers:{default:new Footer({children:[new Paragraph({children:[run('Contains IDSR data. Do not publish; share only with those authorised to see the IDSR.   Page ',{size:15,color:MUTED}),new TextRun({children:[PageNumber.CURRENT],font:FONT,size:15,color:MUTED}),run(' of ',{size:15,color:MUTED}),new TextRun({children:[PageNumber.TOTAL_PAGES],font:FONT,size:15,color:MUTED})],alignment:AlignmentType.RIGHT})]})},
      children:body}]});
  return Packer.toBlob(doc);
}

/* ============================================================
   5. APP
   ============================================================ */
const $=id=>document.getElementById(id);
/* Set this to a monitored address to show a "report a problem" route in error messages. */
const SUPPORT_EMAIL='w.gopaul@st-annes.bham.sch.uk';
const reportTo=()=>SUPPORT_EMAIL?` and send it to ${SUPPORT_EMAIL}`:' and tell whoever gave you this tool';
let MODEL=null,AN=null,VIEW='A',EDITED=false;
const FOUND=[['School characteristics',m=>Object.keys(m.characteristics).length>0],['Year group profile',m=>m.yearGroups.length>0],['SEN register',m=>m.sen.needs.length>0],['Ethnicity',m=>m.ethnicity.length>0],['Staffing',m=>m.staffing.length>0],['Attendance & absence',m=>!!(m.annex['All pupils']||{})['Persistent absence']],['Suspensions',m=>!!m.suspensions],['Permanent exclusions',m=>!!m.exclusions],['Year-group absence',m=>!!m.ygAbsence.years],['Attainment measures',m=>Object.keys(m.annex['All pupils']||{}).some(k=>!BEHAV_RE.test(k))],['Progress measures',m=>Object.keys(m.annex['All pupils']||{}).some(k=>PROG_RE.test(k))],['Disadvantaged gap',m=>Object.values(m.annex['Disadvantaged pupils']||{}).some(rows=>rows.some(r=>r.gapN!=null))],['Prior-attainment groups',m=>!!m.annex['Low prior attainers']],['EYFS nationals',m=>Object.keys(m.eyfs).length>0]];
function showFound(m){ $('found').innerHTML=FOUND.map(([l,f])=>{ const ok=m&&f(m); return `<li class="${ok?'ok':''}">${l}<span class="vh">${ok?' found':' not found'}</span></li>`; }).join(''); }
showFound(null); $('ver').textContent=`Version ${VERSION}. Checked against IDSR release${TESTED_RELEASES.length>1?'s':''} ${TESTED_RELEASES.join(', ')}.`;

/* Status goes to the side panel and to a bar above the document, so feedback is visible wherever the reader is looking. */
let noticeTimer=null;
function setStatus(t,cls){ const s=$('status'); const quiet=cls==='quiet'; if(quiet) cls='ok'; s.textContent=t; s.className='status'+(cls?' '+cls:'');
  const n=$('notice'); if(!n) return; clearTimeout(noticeTimer); if(!t||quiet){ n.hidden=true; return; }
  n.textContent=t; n.className='notice'+(cls?' '+cls:''); n.hidden=false; if(cls==='ok'||!cls) noticeTimer=setTimeout(()=>{ n.hidden=true; },9000); }

const A_LIMIT=210*96/25.4;
/* Version A is cut to fit one side of A4 by dropping content in a fixed, declared order (never by shrinking type). */
const A_PLANS=[{hs:4,cs:4,qs:3,lean:0},{hs:3,cs:3,qs:3,lean:0},{hs:3,cs:3,qs:2,lean:0},{hs:3,cs:3,qs:2,lean:1},{hs:2,cs:3,qs:2,lean:1},{hs:2,cs:2,qs:2,lean:2},{hs:2,cs:2,qs:1,lean:2}];
function docFits(){ const d=$('doc'); if(!d) return null; const prev=d.style.minHeight; d.style.minHeight='0'; const h=d.offsetHeight; d.style.minHeight=prev; return h; }
function fitScale(){ const d=$('doc'), w=$('docwrap'); if(!d) return; if(window.innerWidth<=960){ d.style.transform=''; w.style.height=''; return; }
  const avail=w.clientWidth; const dw=d.offsetWidth; const sc=Math.min(1,avail/dw); d.style.transform=sc<1?`scale(${sc})`:''; w.style.height=sc<1?Math.ceil(d.offsetHeight*sc)+'px':''; }
const fitRO=('ResizeObserver' in window)?new ResizeObserver(()=>fitScale()):null;
function fitCheck(){ const el=$('fitcheck'); const d=$('doc'); if(!d){ el.textContent=''; return; }
  if(window.innerWidth<960){ el.textContent=VIEW==='A'?'Print check: open this page on a laptop or desktop to confirm Version A fits one page before printing.':''; return; }
  el.textContent='';
  const b=document.createElement('b'); b.textContent='Print check: '; el.appendChild(b);
  if(VIEW==='A'){ const over=docFits()-A_LIMIT; el.appendChild(document.createTextNode(over<=0?'Version A fits one side of A4 landscape.':`Version A is about ${Math.ceil(over*25.4/96)} mm too tall for one page. Print Version B instead${EDITED?', or shorten your edits':''}.`)); if(over>0) el.classList.add('warn'); else el.classList.remove('warn'); }
  else { el.classList.remove('warn'); const pages=d.querySelectorAll('.page').length; el.appendChild(document.createTextNode(`Version B prints on A4 portrait, one section per page (${pages} sections, plus continuation pages for the evidence trail). Nothing is cut or shrunk; long sections continue onto the next page.`)); } }

function render(){ if(!MODEL) return;
  SUPPRESS=$('optSuppress').checked;            // one switch, read once: screen, print and Word all use this analysis
  AN=analyse(MODEL); showCoverage(AN); let html;
  if(VIEW==='A'){ html=renderA(MODEL,AN,SUPPRESS,A_PLANS[0]); $('docwrap').innerHTML=html; for(let i=1;i<A_PLANS.length&&window.innerWidth>=960&&docFits()>A_LIMIT;i++){ html=renderA(MODEL,AN,SUPPRESS,A_PLANS[i]); $('docwrap').innerHTML=html; } }
  else { html=renderB(MODEL,AN,SUPPRESS); $('docwrap').innerHTML=html; }
  wrapTables(); $('toOpts').hidden=false; EDITED=false; fitCheck(); fitScale(); if(fitRO){ fitRO.disconnect(); const d=$('doc'); if(d) fitRO.observe(d); }
  $('btnEdit').classList.remove('on'); $('btnEdit').textContent='Edit text';
  $('printHint').textContent=VIEW==='A'?'Version A prints on one side of A4 landscape. Switch to Version B for the full five-section briefing (recommended for emailing).':'Version B prints on A4 portrait, one section per page. Switch to Version A for the one-page summary.';
  document.title=`${MODEL.school.name} – IDSR Governor Briefing`; setPageSize(); }
function wrapTables(){ document.querySelectorAll('#doc table').forEach(t=>{ if(t.parentElement.classList.contains('tscroll')) return; const w=document.createElement('div'); w.className='tscroll'; w.tabIndex=0; w.setAttribute('role','region'); const cap=t.querySelector('caption'); w.setAttribute('aria-label',(cap?cap.textContent.trim():'Table')+' (scrolls sideways on small screens)'); t.parentNode.insertBefore(w,t); w.appendChild(t); }); }
function showDocOnMobile(){ if(window.innerWidth<960){ const d=$('doc'); if(d) d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}); } }
function setPageSize(){ let st=$('pagesize'); if(!st){ st=document.createElement('style'); st.id='pagesize'; document.head.appendChild(st); } st.textContent=VIEW==='A'?'@page{size:A4 landscape;margin:10mm 11mm}':'@page{size:A4 portrait;margin:13mm 14mm 16mm}'; }
function showCoverage(an){ const c=an.coverage; const el=$('coverage'); el.textContent='';
  const add=(label,text)=>{ const b=document.createElement('b'); b.textContent=label; el.appendChild(b); el.appendChild(document.createTextNode(text)); };
  add('Extracted: ',`${c.found.length} achievement measure${c.found.length===1?'':'s'}; attendance ${c.behaviour.filter(x=>x[1]).length}/${c.behaviour.length}. `);
  add('Missing for this phase: ',`${c.missing.length?c.missing.join(', '):'none'}. `);
  add('Check manually: ',c.verify.length?`${c.verify.length} item${c.verify.length>1?'s':''} (listed in Appendix B of Version B).`:'nothing flagged.'); }

const PLACEHOLDER='Tick the box and upload an IDSR, or load the example school to see the three outputs.';
/* A failed or refused file never leaves an earlier school's briefing on screen. */
function clearDoc(msg){ MODEL=null; AN=null; EDITED=false; const w=$('docwrap'); w.textContent=''; w.style.height=''; const ph=document.createElement('div'); ph.className='placeholder'; ph.id='placeholder'; ph.textContent=msg||PLACEHOLDER; w.appendChild(ph);
  $('toOpts').hidden=true; $('coverage').textContent=''; $('fitcheck').textContent=''; $('printHint').textContent=''; showFound(null); document.title='GovCopilot Insight'; }
function load(model,label,opts){ opts=opts||{}; let v;
  try{ v=validateModel(model); }catch(e){ console.error(e); v={fatal:['The file could not be checked.'],warn:[]}; }
  if(v.fatal.length){ clearDoc('No briefing was produced for this file. See the message above.'); showFound(model);
    setStatus(`No briefing has been produced, so that you are not given a wrong one. ${v.fatal.join(' ')} Ofsted may have changed the IDSR layout since this version was checked (${TESTED_RELEASES[TESTED_RELEASES.length-1]}), or this may be a school with no published results yet. Please keep the file${reportTo()}.`,'err'); return; }
  try{ model.warnings=v.warn; MODEL=model; EDITED=false; showFound(model); render(); if(!opts.quiet) showDocOnMobile();
    const base=`${label}: ${model.school.name}${model.school.release?` (IDSR released ${model.school.release})`:''}${model.phase.isSpecial?' – special school: no national bandings published':''}.`;
    if(v.warn.length) setStatus(`${base} Check before use: ${v.warn.join(' ')}`,'warn'); else setStatus(base,opts.quiet?'quiet':'ok'); }
  catch(e){ console.error(e); clearDoc('No briefing was produced for this file. See the message above.'); setStatus(`We read the file but could not build a briefing from it, so nothing has been produced. Ofsted may have changed the IDSR layout. Please keep the file${reportTo()}.`,'err'); } }
function handleFile(file){ if(!file) return; if(!$('attest').checked){ setStatus('Please tick the box above the upload area first.','err'); return; }
  setStatus('Reading '+file.name+'…'); const fr=new FileReader();
  fr.onload=()=>{ let model; try{ model=parseIDSR(fr.result); }catch(e){ clearDoc(); setStatus(e.message,'err'); return; } load(model,'Loaded'); };
  fr.onerror=()=>{ clearDoc(); setStatus('Could not read that file.','err'); }; fr.readAsText(file); $('file').value=''; }
$('attest').addEventListener('change',e=>{ $('drop').setAttribute('aria-disabled',e.target.checked?'false':'true'); $('drop').querySelector('span').textContent=e.target.checked?'Drag the file here or click to choose.':'Drag the file here or click to choose. Tick the box above first.'; });
$('drop').addEventListener('click',e=>{ if(!$('attest').checked){ e.preventDefault(); setStatus('Please tick the box above the upload area first.','err'); } });
$('file').addEventListener('change',e=>handleFile(e.target.files[0]));
const drop=$('drop'); ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');})); ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');})); drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
drop.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); if($('attest').checked) $('file').click(); else setStatus('Please tick the box above the upload area first.','err'); } });

/* Edits live only on screen. Anything that would rebuild the page asks first, and the control goes back if you say no. */
let discardOK=false;
function confirmDiscard(){ if(!EDITED||discardOK){ discardOK=false; return true; } setStatus('You have edited the text on screen. Do the same thing again within 10 seconds to discard your edits.','warn'); discardOK=true; setTimeout(()=>{ discardOK=false; },10000); return false; }
function setView(v){ if(!confirmDiscard()) return; VIEW=v; const a=v==='A'; $('tabA').classList.toggle('on',a); $('tabB').classList.toggle('on',!a); $('tabA').setAttribute('aria-selected',a?'true':'false'); $('tabB').setAttribute('aria-selected',a?'false':'true'); $('tabA').tabIndex=a?0:-1; $('tabB').tabIndex=a?-1:0; render(); showDocOnMobile(); }
$('tabA').addEventListener('click',()=>setView('A')); $('tabB').addEventListener('click',()=>setView('B'));
[$('tabA'),$('tabB')].forEach(t=>t.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); const other=t.id==='tabA'?$('tabB'):$('tabA'); other.focus(); other.click(); } }));
$('optSuppress').addEventListener('change',e=>{ if(!confirmDiscard()){ e.target.checked=!e.target.checked; return; } render(); });
$('btnReset').addEventListener('click',()=>{ if(confirmDiscard()) render(); });
addEventListener('resize',()=>{ if(MODEL) fitCheck(); fitScale(); });
let fitTimer=null;
$('btnEdit').addEventListener('click',()=>{ const d=$('doc'); if(!d) return; const on=d.contentEditable!=='true'; d.contentEditable=on?'true':'false'; $('btnEdit').classList.toggle('on',on); $('btnEdit').textContent=on?'Done editing':'Edit text';
  if(on){ d.focus(); setStatus('Editing on screen. Your edits are kept for Print / save as PDF only: the Word file is built from the IDSR data and will not include them.','warn'); if(!d.dataset.editBound){ d.dataset.editBound='1'; d.addEventListener('input',()=>{ EDITED=true; clearTimeout(fitTimer); fitTimer=setTimeout(()=>{ fitCheck(); fitScale(); },400); }); } } });
$('btnCopy').addEventListener('click',async()=>{ const d=$('doc'); if(!d) return; try{ await navigator.clipboard.writeText(d.innerText); setStatus('Briefing copied as plain text.','ok'); }catch(e){ const r=document.createRange(); r.selectNodeContents(d); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); setStatus('Text selected: press Ctrl+C / ⌘C to copy.','ok'); } });
const EMBEDDED=window.self!==window.top;
$('btnPrint').addEventListener('click',()=>{ if(!MODEL) return; if(EMBEDDED){ setStatus('Printing is blocked inside this preview. Open the page in its own browser tab, then use Print (Ctrl+P / ⌘P) and choose "Save as PDF".','err'); return; } window.print(); });
let wordEditOK=false;
$('btnWord').addEventListener('click',async()=>{ if(!MODEL) return;
  if(EDITED&&!wordEditOK){ setStatus('The Word file is built from the IDSR data and will NOT include the edits you made on screen. Click Download Word again within 10 seconds to continue, or use Print / save as PDF to keep your edits.','warn'); wordEditOK=true; setTimeout(()=>{ wordEditOK=false; },10000); return; }
  wordEditOK=false;
  try{ setStatus('Building Word document…'); const blob=await buildDocx(MODEL,AN,SUPPRESS); const name=`${MODEL.school.name.replace(/[^\w]+/g,'_')}_IDSR_Governor_Briefing_${new Date().toISOString().slice(0,10)}.docx`; if(EMBEDDED){ setStatus('Downloads are blocked inside this preview. Open the page in its own browser tab to download the Word file.','err'); return; } const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000); setStatus('Word document downloaded: '+name,'ok'); }catch(e){ console.error(e); setStatus('Could not build the Word document: '+e.message,'err'); } });
if(EMBEDDED) $('printHint').textContent='This is a preview. Printing and downloads work when the page is opened in its own browser tab.';

/* Example school: invented figures (see sample.js). It loads on arrival without moving the page. */
const EXAMPLE_LABEL='Example (invented figures, not a real school)';
const exampleModel=()=>typeof SAMPLE_MODEL==='undefined'||!SAMPLE_MODEL?null:normaliseModel(JSON.parse(JSON.stringify(SAMPLE_MODEL)));
$('btnSample').addEventListener('click',()=>{ const m=exampleModel(); if(!m){ setStatus('No example is included in this build.','err'); return; } if(!confirmDiscard()) return; load(m,EXAMPLE_LABEL); });
{ const m=exampleModel(); if(m) load(m,EXAMPLE_LABEL,{quiet:true}); }
