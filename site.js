// Small helpers for the pages around the IDSR tool. This script sends nothing itself; the enquiry form is an ordinary HTML form.
(function(){
  'use strict';
  var y=document.querySelectorAll('[data-year]'); for(var i=0;i<y.length;i++) y[i].textContent=String(new Date().getFullYear());

  // Briefings: copy the three questions, and print.
  var copy=document.getElementById('copyQs'), out=document.getElementById('copyStatus');
  if(copy){ copy.addEventListener('click',function(){
    var qs=[].map.call(document.querySelectorAll('ol.qs li'),function(li,n){ return (n+1)+'. '+li.textContent.trim(); });
    var title=document.querySelector('h1').textContent.trim();
    var text=title+'\n\n'+qs.join('\n')+'\n\nFrom GovernorBrief, governorbrief.co.uk';
    var done=function(ok){ out.textContent=ok?'The three questions are copied. Paste them into your notes or an email.':'Copying is not available in this browser. Select the questions and copy them by hand.'; };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){done(true);},function(){done(false);}); } else { done(false); }
  }); }
  var pr=document.getElementById('printBrief'); if(pr) pr.addEventListener('click',function(){ window.print(); });

  // Workshop enquiry: checks the answers in the browser, then lets the form go to the site's host (Netlify Forms).
  // Without JavaScript the form still works; the browser's own required-field checks apply instead.
  var f=document.getElementById('enquiry');
  if(f){
    f.setAttribute('novalidate','');
    var sum=document.getElementById('errsum');
    var fields=[['name','Enter your name'],['email','Enter your professional email address'],['organisation','Enter the name of your school or organisation'],['enquiry-type','Choose the type of enquiry']];
    // A link such as /contact?type=workshop chooses the enquiry type in advance.
    var want=(/[?&]type=([a-z]+)/.exec(window.location.search)||[])[1], sel=document.getElementById('f-enquiry-type');
    if(want&&sel){ for(var k=0;k<sel.options.length;k++){ if(sel.options[k].getAttribute('data-key')===want) sel.selectedIndex=k; } }
    f.addEventListener('submit',function(e){
      var bad=[];
      fields.forEach(function(d){ var el=document.getElementById('f-'+d[0]), er=document.getElementById('e-'+d[0]), v=el.value.trim(), msg='';
        if(!v) msg=d[1]; else if(d[0]==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg='Enter an email address in the correct format, with an @ sign and a full stop';
        if(msg){ el.setAttribute('aria-invalid','true'); el.setAttribute('aria-describedby','e-'+d[0]); er.textContent='Error: '+msg; er.hidden=false; bad.push([d[0],msg]); }
        else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); er.hidden=true; er.textContent=''; } });
      if(bad.length){ e.preventDefault(); if(document.title.indexOf('Error: ')!==0) document.title='Error: '+document.title; var ul=sum.querySelector('ul'); ul.textContent=''; bad.forEach(function(b){ var li=document.createElement('li'), a=document.createElement('a'); a.href='#f-'+b[0]; a.textContent=b[1]; li.appendChild(a); ul.appendChild(li); }); sum.hidden=false; sum.focus(); return; }
      sum.hidden=true; var btn=f.querySelector('button[type="submit"]'); btn.disabled=true; btn.textContent='Sending…';
      // The form now submits normally. The "enquiry sent" page appears only if the host accepts it.
    });
    window.addEventListener('pageshow',function(){ var btn=f.querySelector('button[type="submit"]'); btn.disabled=false; btn.textContent='Send enquiry'; });
  }
})();
