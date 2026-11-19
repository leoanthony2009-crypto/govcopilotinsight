// Rebuilds the two sample PDFs from the built-in example school (invented figures).
// Run after any change to the briefing:  node tests/make-sample.cjs
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8795, URL = `http://127.0.0.1:${PORT}/`;
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.cjs'), ROOT, String(PORT)], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); await p.goto(URL + 'idsr'); await p.waitForTimeout(600);
  await p.pdf({ path: path.join(ROOT, 'sample-briefing-one-page.pdf'), preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  await p.click('#tabB'); await p.waitForTimeout(400);
  await p.pdf({ path: path.join(ROOT, 'sample-briefing-full.pdf'), preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  const fs = require('fs'), crypto = require('crypto'); const h = crypto.createHash('sha256'); for (const f of ['core.js', 'sample.js', 'idsr.html']) h.update(fs.readFileSync(path.join(ROOT, f)));
  fs.writeFileSync(path.join(ROOT, 'sample-briefing.sha256'), h.digest('hex') + '\n');
  await b.close(); srv.kill(); console.log('sample PDFs written');
})();
