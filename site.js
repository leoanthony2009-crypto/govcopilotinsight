// Small helpers for the pages around the IDSR tool. Nothing here sends data anywhere.
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

  // Workshop enquiry: checks the form, then opens a ready-written email in the visitor's own email program.
  var f=document.getElementById('enquiry');
  if(f){
    var sum=document.getElementById('errsum'), ok=document.getElementById('enqStatus');
    var fields=[['name','Contact name','Enter your name'],['email','Professional email','Enter your professional email address'],['org','School or organisation','Enter the name of your school or organisation'],['type','Organisation type','Choose your organisation type'],['place','Town or general location','Enter your town or general location'],['people','Approximate number of participants','Enter the approximate number of participants'],['dates','Preferred dates or period','Enter your preferred dates or period'],['priority','Main development priority','Enter your main development priority']];
    f.addEventListener('submit',function(e){
      e.preventDefault(); var bad=[]; ok.textContent='';
      fields.forEach(function(d){ var el=document.getElementById('f-'+d[0]), er=document.getElementById('e-'+d[0]), v=el.value.trim(), msg='';
        if(!v) msg=d[2]; else if(d[0]==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg='Enter an email address in the correct format, with an @ sign and a full stop';
        if(msg){ el.setAttribute('aria-invalid','true'); el.setAttribute('aria-describedby','e-'+d[0]); er.textContent='Error: '+msg; er.hidden=false; bad.push([d[0],msg]); }
        else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); er.hidden=true; er.textContent=''; } });
      if(bad.length){ var ul=sum.querySelector('ul'); ul.textContent=''; bad.forEach(function(b){ var li=document.createElement('li'), a=document.createElement('a'); a.href='#f-'+b[0]; a.textContent=b[1]; li.appendChild(a); ul.appendChild(li); }); sum.hidden=false; sum.focus(); return; }
      sum.hidden=true;
      var lines=['Hello,','','I would like to enquire about the GovernorBrief workshop, From Information to Assurance: Asking Better Questions.',''];
      fields.forEach(function(d){ lines.push(d[1]+': '+document.getElementById('f-'+d[0]).value.trim()); });
      var more=document.getElementById('f-more').value.trim(); if(more) lines.push('Additional information: '+more);
      lines.push('','(This email contains no pupil information, staff case details or safeguarding information.)');
      var to=f.getAttribute('data-to');
      window.location.href='mailto:'+to+'?subject='+encodeURIComponent('Workshop enquiry: '+document.getElementById('f-org').value.trim())+'&body='+encodeURIComponent(lines.join('\n'));
      ok.textContent='Your email program should now be open with the enquiry written out. Nothing has been sent yet: check it and press send there. If nothing opened, email '+to+' directly.';
    });
  }
})();
