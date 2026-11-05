// Render a brief to a branded PDF, driving Chrome over its debug protocol.
//
// The CLI's --print-to-pdf cannot carry a header or footer, and doing it in CSS with
// position:fixed and negative offsets put the footer in the middle of the text -- a fixed
// element is laid out against the page AREA, and pushing it into the margin is not reliable.
// Page.printToPDF takes headerTemplate and footerTemplate and renders them into the margin
// itself, which is what that API is for, and it gives us pageNumber and totalPages.
//
// No dependency: Node 20 has WebSocket behind --experimental-websocket.
//
//   node --experimental-websocket topdf.js <file-url> <out.pdf> "<title>" "<dated>"

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , PAGE_URL, OUT, TITLE, DATED] = process.argv;
if (!PAGE_URL || !OUT) { console.error('usage: topdf.js <url> <out.pdf> [title] [dated]'); process.exit(2); }

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!CHROME) { console.error('no chrome found'); process.exit(2); }

// Chrome scales these to about 10px regardless of what you ask for, so sizes are set in the
// template itself and the whole thing is wrapped in one div with an explicit font-size.
const head = `
<div style="font-size:8px;width:100%;margin:0 12mm;font-family:'DM Sans',Arial,sans-serif;
            color:#5B655F;border-bottom:0.5px solid #D5D9D1;padding-bottom:3px;
            display:flex;justify-content:space-between;align-items:baseline">
  <span style="font-size:9.5px;font-weight:700;color:#1A211D;letter-spacing:-0.02em">Semi<span style="color:#A35A16">trical</span></span>
  <span>${TITLE || ''}</span>
</div>`;

const foot = `
<div style="font-size:7px;width:100%;margin:0 12mm;font-family:'DM Sans',Arial,sans-serif;
            color:#5B655F;border-top:0.5px solid #D5D9D1;padding-top:3px;
            display:flex;justify-content:space-between;align-items:baseline">
  <span>semitrical.ai${DATED ? ' &middot; ' + DATED : ''}</span>
  <span>Built from public filings &middot; not legal, investment or professional advice</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

// Serve the site root so /assets/... resolves. ROOT is the repo; PAGE_URL is a path under it.
const ROOT = process.env.SITE_ROOT || 'C:/Users/amitn/repos/LF-website';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  const full = path.join(ROOT, f);
  if (!full.startsWith(path.resolve(ROOT))) { res.writeHead(403).end(); return; }
  fs.readFile(full, (e, data) => {
    if (e) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(9334);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfprof-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--remote-debugging-port=9333',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    await sleep(250);
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (e) { /* still starting */ }
  }
  if (!page) throw new Error('chrome never offered a page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });

  await new Promise((r) => ws.addEventListener('open', r));
  let loaded = null;
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
    if (m.method === 'Page.loadEventFired' && loaded) loaded();
  });

  await send('Page.enable');
  const done = new Promise((r) => { loaded = r; });
  await send('Page.navigate', { url: PAGE_URL });
  await done;
  // Webfonts and layout settle after load; without this the first sheet can print in the
  // fallback face while the rest are correct.
  await sleep(1200);

  const { data } = await send('Page.printToPDF', {
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: head,
    footerTemplate: foot,
    paperWidth: 8.27, paperHeight: 11.69,          // A4 in inches
    marginTop: 0.75, marginBottom: 0.75, marginLeft: 0.55, marginRight: 0.55,
    preferCSSPageSize: false,
  });
  fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  ws.close();
})()
  .catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; })
  .finally(() => { try { chrome.kill(); } catch (e) {} try { server.close(); } catch (e) {} });
