// Static server that imitates how Netlify serves this site, so tests run under the real security policy.
// - applies the repo's _headers file by path; when two rules set the same header, both values are sent (as Netlify does)
// - serves /idsr from idsr.html and /briefs/ from briefs/index.html; /briefs redirects to /briefs/
// - accepts a POST only for a form that exists in the site (data-netlify form, its action and its form-name); anything else is refused
// - unknown addresses get 404.html with status 404; _headers, _redirects, the tests folder and the README are never served
// It cannot imitate Netlify's spam filtering, email notifications or form detection settings: check those on a deploy preview.
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2], PORT=+process.argv[3]||8765;
const rules=[]; fs.readFileSync(path.join(ROOT,'_headers'),'utf8').split('\n').forEach(l=>{ if(/^\s*#/.test(l)||!l.trim()) return; const m=l.match(/^\s+([A-Za-z-]+):\s*(.+)$/); if(m&&rules.length) rules[rules.length-1].h.push([m[1],m[2]]); else if(!/^\s/.test(l)) rules.push({p:l.trim(),h:[]}); });
const headersFor=u=>{ const o={}; rules.forEach(r=>{ const hit=r.p.endsWith('*')?u.startsWith(r.p.slice(0,-1)):u===r.p; if(hit) r.h.forEach(([k,v])=>{ o[k]=o[k]?[].concat(o[k],v):v; }); }); return o; };
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.json':'application/json','.woff2':'font/woff2','.css':'text/css; charset=utf-8'};
const forms=[]; const walk=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{ if(e.name==='node_modules'||e.name==='tests'||e.name.startsWith('.')) return; const f=path.join(d,e.name); if(e.isDirectory()) walk(f); else if(e.name.endsWith('.html')){ const t=fs.readFileSync(f,'utf8'); (t.match(/<form[^>]*data-netlify="true"[^>]*>/g)||[]).forEach(tag=>forms.push({name:(tag.match(/name="([^"]+)"/)||[])[1],action:(tag.match(/action="([^"]+)"/)||[])[1],trap:(tag.match(/netlify-honeypot="([^"]+)"/)||[])[1]})); } }); walk(ROOT);
const send=(s,code,u,file)=>{ s.writeHead(code,{...headersFor(u),'Content-Type':T[path.extname(file)]||'application/octet-stream'}); s.end(fs.readFileSync(file)); };
const notFound=(s,u)=>send(s,404,u,path.join(ROOT,'404.html'));
http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); let p=u;
  if(p.endsWith('/')) p+='index.html'; else if(!path.extname(p)){ if(fs.existsSync(path.join(ROOT,p+'.html'))) p+='.html'; else if(fs.existsSync(path.join(ROOT,p,'index.html'))){ s.writeHead(301,{Location:u+'/'}); return s.end(); } }
  const f=path.join(ROOT,p); const ok=f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile()&&!/^\/(_|tests\/|README\.md)/.test(p)&&!/\/\./.test(p);
  if(q.method==='POST'){ let b=''; q.on('data',c=>b+=c); q.on('end',()=>{ const v=new URLSearchParams(b), fm=forms.find(x=>x.name===v.get('form-name')&&x.action===u); if(!fm||!ok){ s.writeHead(404,headersFor(u)); return s.end('no such form'); } if(fm.trap&&v.get(fm.trap)){ s.writeHead(400,headersFor(u)); return s.end('rejected'); } send(s,200,u,f); }); return; }
  if(q.method!=='GET'&&q.method!=='HEAD'){ s.writeHead(405,headersFor(u)); return s.end(); }
  if(!ok) return notFound(s,u); send(s,200,u,f);
}).listen(PORT,'127.0.0.1',()=>console.log('up',PORT));
