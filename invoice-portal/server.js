'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDb, createApp, ValidationError, STATES, fyRange, today } = require('./lib');

const PORT = Number(process.env.PORT || 3000);
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'portal.db');
const PASSWORD = process.env.PORTAL_PASSWORD || ''; // optional: set to require login (HTTP Basic)
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const app = createApp(openDb(DB_FILE));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (p) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

function printable(id) {
  const inv = app.getInvoice(id); if (!inv) return null;
  const s = app.settings();
  const tax = s.gst_enabled === '1';
  const rows = inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.description)}<br><small>${esc(l.hsn)}</small></td>
    <td class=r>${l.qty100 / 100}</td><td class=r>${money(l.rate_paise)}</td>${tax ? `<td class=r>${l.gst_rate}%</td>` : ''}<td class=r>${money(l.amount_paise)}</td></tr>`).join('');
  return `<!doctype html><meta charset=utf-8><title>${esc(inv.number)}</title><style>
  body{font:14px system-ui,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#111}
  table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}.r{text-align:right}
  .tot td{border:0;padding:3px 6px}.hd{display:flex;justify-content:space-between;gap:16px}h1{margin:0 0 4px}small{color:#666}
  .stamp{color:#b00;font-weight:700;border:2px solid #b00;display:inline-block;padding:2px 10px}@media print{button{display:none}}</style>
  <button onclick=print()>Print / Save as PDF</button>
  <div class=hd><div><h1>${esc(s.company_name)}</h1>${esc(s.address)}<br>${s.gstin ? 'GSTIN: ' + esc(s.gstin) : ''}</div>
  <div class=r><h2>${tax ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</h2><b>${esc(inv.number)}</b><br>Date: ${inv.date}<br>Due: ${inv.due_date}
  ${inv.status === 'cancelled' ? '<br><span class=stamp>CANCELLED</span>' : ''}</div></div>
  <p><b>Bill To:</b><br>${esc(inv.client.name)}<br>${esc(inv.client.address)}<br>${inv.client.gstin ? 'GSTIN: ' + esc(inv.client.gstin) + '<br>' : ''}Place of supply: ${esc(STATES[inv.client.state_code])}</p>
  <table><tr><th>#</th><th>Description</th><th class=r>Qty</th><th class=r>Rate</th>${tax ? '<th class=r>GST</th>' : ''}<th class=r>Amount</th></tr>${rows}</table>
  <table class=tot style="width:320px;margin-left:auto"><tr><td>Taxable value</td><td class=r>${money(inv.subtotal_paise)}</td></tr>
  ${inv.cgst_paise ? `<tr><td>CGST</td><td class=r>${money(inv.cgst_paise)}</td></tr><tr><td>SGST</td><td class=r>${money(inv.sgst_paise)}</td></tr>` : ''}
  ${inv.igst_paise ? `<tr><td>IGST</td><td class=r>${money(inv.igst_paise)}</td></tr>` : ''}
  <tr><td><b>Total</b></td><td class=r><b>${money(inv.total_paise)}</b></td></tr>
  <tr><td>Received</td><td class=r>${money(inv.paid_paise)}</td></tr><tr><td><b>Balance due</b></td><td class=r><b>${money(inv.balance_paise)}</b></td></tr></table>
  ${inv.notes ? `<p><b>Notes:</b> ${esc(inv.notes)}</p>` : ''}${s.bank_details ? `<p><b>Bank details:</b><br>${esc(s.bank_details).replace(/\n/g, '<br>')}</p>` : ''}`;
}

async function body(req) {
  let n = 0; const ch = [];
  for await (const c of req) { n += c.length; if (n > 1e6) throw new ValidationError('Request bahut badi hai'); ch.push(c); }
  if (!ch.length) return {};
  try { return JSON.parse(Buffer.concat(ch).toString()); } catch { throw new ValidationError('JSON galat hai'); }
}

async function route(req, res, url) {
  const m = req.method, p = url.pathname, q = Object.fromEntries(url.searchParams);
  const json = (d, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
  let r;
  const t = today(), fy = fyRange(t, +app.settings().fy_start_month);

  if (p === '/api/meta') return json({ states: STATES, gst_rates: app.GST_RATES, accounts: app.ACCOUNTS, expense_codes: app.EXPENSE_CODES, today: t, fy });
  if (p === '/api/settings') return json(m === 'PUT' ? app.saveSettings(await body(req)) : app.settings());
  if (p === '/api/dashboard') return json(app.dashboard());
  if (p === '/api/clients') return m === 'POST' ? json(app.addClient(await body(req)), 201) : json(app.clients());
  if ((r = p.match(/^\/api\/clients\/(\d+)$/)) && m === 'PUT') return json(app.updateClient(+r[1], await body(req)));
  if (p === '/api/items') return m === 'POST' ? json(app.addItem(await body(req)), 201) : json(app.items());
  if ((r = p.match(/^\/api\/items\/(\d+)$/)) && m === 'PUT') return json(app.updateItem(+r[1], await body(req)));
  if (p === '/api/invoices') return m === 'POST' ? json(app.createInvoice(await body(req)), 201) : json(app.listInvoices(q));
  if ((r = p.match(/^\/api\/invoices\/(\d+)$/))) { const i = app.getInvoice(r[1]); return i ? json(i) : json({ error: 'Nahi mila' }, 404); }
  if ((r = p.match(/^\/api\/invoices\/(\d+)\/cancel$/)) && m === 'POST') return json(app.cancelInvoice(+r[1]));
  if (p === '/api/payments') return m === 'POST' ? json(app.addPayment(await body(req)), 201) : json(app.listPayments());
  if (p === '/api/expenses') return m === 'POST' ? json(app.addExpense(await body(req)), 201) : json(app.listExpenses());
  if (p === '/api/capital' && m === 'POST') return json(app.addCapital(await body(req)), 201);
  if (p === '/api/reports/trial-balance') return json(app.trialBalance(q.asof || t));
  if (p === '/api/reports/pnl') return json(app.profitLoss(q.from || fy.from, q.to || t));
  if (p === '/api/reports/balance-sheet') return json(app.balanceSheet(q.asof || t));
  if (p === '/api/reports/ledger') return json(app.ledger(q.account, q.from || fy.from, q.to || t));
  if (p === '/api/reports/clients') return json(app.clientSummary(q.from || fy.from, q.to || t));
  if (p === '/api/export/invoices.csv') {
    res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': `attachment; filename="invoices-${q.month || 'all'}.csv"` });
    return res.end(app.invoicesCsv(q.month));
  }
  if ((r = p.match(/^\/invoice\/(\d+)$/))) {
    const h = printable(r[1]); if (!h) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(h);
  }
  if (p.startsWith('/api/')) return json({ error: 'Route nahi mila' }, 404);
  const file = path.join(__dirname, 'public', p === '/' ? 'index.html' : path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
}

http.createServer(async (req, res) => {
  if (PASSWORD) {
    const [u, ...pw] = Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString().split(':');
    if (pw.join(':') !== PASSWORD) { res.writeHead(401, { 'www-authenticate': 'Basic realm="Invoice Portal"' }); return res.end('Login required'); }
  }
  try { await route(req, res, new URL(req.url, 'http://x')); }
  catch (e) {
    const code = e instanceof ValidationError ? 400 : 500;
    if (code === 500) console.error(e);
    res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: code === 500 ? 'Server error' : e.message }));
  }
}).listen(PORT, () => console.log(`Invoice portal running: http://localhost:${PORT}`));
