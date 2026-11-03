'use strict';
// Core logic: database, validation, invoice maths, double-entry bookkeeping, reports.
// ALL money is stored as integer paise so there are never floating-point mistakes.
const { DatabaseSync } = require('node:sqlite');

const STATES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana',
  '07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland',
  '14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
  '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu',
  '27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry',
  '35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'
};
const GST_RATES = [0, 5, 12, 18, 28];

const ACCOUNTS = [
  ['1001','Cash','asset'],['1002','Bank','asset'],['1100','Accounts Receivable (Debtors)','asset'],
  ['2100','CGST Payable','liability'],['2101','SGST Payable','liability'],['2102','IGST Payable','liability'],
  ['3000',"Owner's Capital",'equity'],
  ['4000','Sales / Service Revenue','income'],
  ['5001','Rent','expense'],['5002','Salaries & Wages','expense'],['5003','Software & Subscriptions','expense'],
  ['5004','Marketing & Advertising','expense'],['5005','Office & Miscellaneous','expense'],
  ['5006','Travel','expense'],['5007','Professional Fees','expense'],['5008','Utilities (Internet/Electricity)','expense'],
];
const EXPENSE_CODES = ACCOUNTS.filter(a => a[2] === 'expense').map(a => a[0]);

class ValidationError extends Error {}
const bad = (m) => { throw new ValidationError(m); };

// ---------- helpers ----------
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const today = () => new Date().toISOString().slice(0, 10);
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const str = (v, max = 300) => (v == null ? '' : String(v)).trim().slice(0, max);

// "12.50" / 12.5 -> 1250 paise. Rejects more than 2 decimals.
function toPaise(v, label) {
  const s = String(v ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) bad(`${label}: valid amount likho (max 2 decimal), mila "${s}"`);
  const [r, p = ''] = s.split('.');
  const n = Number(r) * 100 + Number((p + '00').slice(0, 2));
  if (!Number.isSafeInteger(n)) bad(`${label}: amount bahut bada hai`);
  return n;
}
function toQty100(v) {
  const s = String(v ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s) || Number(s) <= 0) bad(`Quantity > 0 honi chahiye (max 2 decimal), mila "${s}"`);
  const [r, p = ''] = s.split('.');
  return Number(r) * 100 + Number((p + '00').slice(0, 2));
}
// integer rounding half-up of a/b (a>=0,b>0)
const divRound = (a, b) => Math.floor((2 * a + b) / (2 * b));

function fyOf(date, fyStartMonth = 4) {
  const y = +date.slice(0, 4), m = +date.slice(5, 7);
  const start = m >= fyStartMonth ? y : y - 1;
  return fyStartMonth === 1 ? String(y) : `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
function fyRange(date, fyStartMonth = 4) {
  const y = +date.slice(0, 4), m = +date.slice(5, 7);
  const start = m >= fyStartMonth ? y : y - 1;
  const sm = String(fyStartMonth).padStart(2, '0');
  const endY = fyStartMonth === 1 ? start : start + 1;
  const endM = fyStartMonth === 1 ? 12 : fyStartMonth - 1;
  const last = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  return { from: `${start}-${sm}-01`, to: `${endY}-${String(endM).padStart(2, '0')}-${last}` };
}

// ---------- invoice maths (pure, shared logic) ----------
// lines: [{qty100, rate_paise, gst_rate}], intra: true => CGST+SGST else IGST
function computeInvoice(lines, intra, gstEnabled) {
  let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
  const out = lines.map((l) => {
    const amount = divRound(l.qty100 * l.rate_paise, 100);
    const rate = gstEnabled ? l.gst_rate : 0;
    const tax = divRound(amount * rate, 100);
    let c = 0, s = 0, i = 0;
    if (intra) { c = Math.floor(tax / 2); s = tax - c; } else { i = tax; }
    subtotal += amount; cgst += c; sgst += s; igst += i;
    return { ...l, gst_rate: rate, amount_paise: amount, cgst_paise: c, sgst_paise: s, igst_paise: i };
  });
  return { lines: out, subtotal, cgst, sgst, igst, total: subtotal + cgst + sgst + igst };
}

// ---------- database ----------
function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts(code TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clients(
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, gstin TEXT, state_code TEXT NOT NULL,
      address TEXT, email TEXT, phone TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS items(
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, hsn TEXT, rate_paise INTEGER NOT NULL, gst_rate INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invoices(
      id INTEGER PRIMARY KEY, number TEXT NOT NULL UNIQUE, seq INTEGER NOT NULL, fy TEXT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id), date TEXT NOT NULL, due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued', intra INTEGER NOT NULL, notes TEXT,
      subtotal_paise INTEGER NOT NULL, cgst_paise INTEGER NOT NULL, sgst_paise INTEGER NOT NULL,
      igst_paise INTEGER NOT NULL, total_paise INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(fy, seq));
    CREATE TABLE IF NOT EXISTS invoice_lines(
      id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), description TEXT NOT NULL, hsn TEXT,
      qty100 INTEGER NOT NULL, rate_paise INTEGER NOT NULL, gst_rate INTEGER NOT NULL, amount_paise INTEGER NOT NULL,
      cgst_paise INTEGER NOT NULL, sgst_paise INTEGER NOT NULL, igst_paise INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS payments(
      id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), date TEXT NOT NULL,
      amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), mode TEXT NOT NULL, ref TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS expenses(
      id INTEGER PRIMARY KEY, date TEXT NOT NULL, account_code TEXT NOT NULL REFERENCES accounts(code),
      amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), mode TEXT NOT NULL, vendor TEXT, note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS journal(
      id INTEGER PRIMARY KEY, date TEXT NOT NULL, ref_type TEXT NOT NULL, ref_id INTEGER, narration TEXT);
    CREATE TABLE IF NOT EXISTS journal_lines(
      id INTEGER PRIMARY KEY, journal_id INTEGER NOT NULL REFERENCES journal(id), account_code TEXT NOT NULL REFERENCES accounts(code),
      debit INTEGER NOT NULL DEFAULT 0, credit INTEGER NOT NULL DEFAULT 0, client_id INTEGER);
    CREATE INDEX IF NOT EXISTS ix_inv_date ON invoices(date);
    CREATE INDEX IF NOT EXISTS ix_jl_acc ON journal_lines(account_code);
  `);
  const ins = db.prepare('INSERT OR IGNORE INTO accounts(code,name,type) VALUES(?,?,?)');
  ACCOUNTS.forEach((a) => ins.run(...a));
  const set = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
  Object.entries({ company_name: 'My Company', gstin: '', state_code: '07', address: '', gst_enabled: '1',
    fy_start_month: '4', default_due_days: '15', bank_details: '', invoice_prefix: 'INV' }).forEach(([k, v]) => set.run(k, v));
  return db;
}

function createApp(db) {
  const tx = (fn) => (...a) => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(...a); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const settings = () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((r) => [r.key, r.value]));

  function postJournal(date, refType, refId, narration, lines) {
    const d = lines.reduce((s, l) => s + (l.debit || 0), 0), c = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (d !== c) throw new Error(`Journal not balanced (${d} vs ${c})`); // safety net: books can never go out of balance
    const j = db.prepare('INSERT INTO journal(date,ref_type,ref_id,narration) VALUES(?,?,?,?)').run(date, refType, refId, narration);
    const ins = db.prepare('INSERT INTO journal_lines(journal_id,account_code,debit,credit,client_id) VALUES(?,?,?,?,?)');
    lines.filter((l) => l.debit || l.credit).forEach((l) => ins.run(j.lastInsertRowid, l.account, l.debit || 0, l.credit || 0, l.client_id ?? null));
  }

  // ----- settings -----
  const saveSettings = tx((b) => {
    const s = settings();
    const next = { ...s };
    if (b.company_name !== undefined) { next.company_name = str(b.company_name, 120); if (!next.company_name) bad('Company name zaroori hai'); }
    if (b.gstin !== undefined) { next.gstin = str(b.gstin, 15).toUpperCase(); if (next.gstin && !GSTIN_RE.test(next.gstin)) bad('Company GSTIN galat format me hai'); }
    if (b.state_code !== undefined) { if (!STATES[b.state_code]) bad('State chuno'); next.state_code = b.state_code; }
    if (b.gst_enabled !== undefined) next.gst_enabled = b.gst_enabled === true || b.gst_enabled === '1' ? '1' : '0';
    if (b.address !== undefined) next.address = str(b.address, 400);
    if (b.bank_details !== undefined) next.bank_details = str(b.bank_details, 400);
    if (b.invoice_prefix !== undefined) { next.invoice_prefix = str(b.invoice_prefix, 8).toUpperCase(); if (!/^[A-Z0-9]{1,8}$/.test(next.invoice_prefix)) bad('Prefix sirf letters/numbers (max 8)'); }
    if (b.default_due_days !== undefined) { const n = Number(b.default_due_days); if (!Number.isInteger(n) || n < 0 || n > 365) bad('Due days 0-365'); next.default_due_days = String(n); }
    const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    Object.entries(next).forEach(([k, v]) => up.run(k, v));
    return next;
  });

  // ----- clients & items -----
  function parseClient(b) {
    const name = str(b.name, 120); if (!name) bad('Client ka naam zaroori hai');
    if (!STATES[b.state_code]) bad('Client ka state chuno (GST ke liye zaroori)');
    const gstin = str(b.gstin, 15).toUpperCase();
    if (gstin) {
      if (!GSTIN_RE.test(gstin)) bad('Client GSTIN galat format me hai');
      if (gstin.slice(0, 2) !== b.state_code) bad('GSTIN ke pehle 2 digit state code se match nahi karte');
    }
    const email = str(b.email, 120); if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('Email galat hai');
    return { name, gstin, state_code: b.state_code, address: str(b.address, 400), email, phone: str(b.phone, 20) };
  }
  const uniq = (fn) => { try { return fn(); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Ye naam pehle se maujood hai'); throw e; } };
  const addClient = (b) => { const c = parseClient(b);
    return uniq(() => ({ id: Number(db.prepare('INSERT INTO clients(name,gstin,state_code,address,email,phone) VALUES(?,?,?,?,?,?)').run(c.name, c.gstin, c.state_code, c.address, c.email, c.phone).lastInsertRowid) })); };
  const updateClient = (id, b) => { const c = parseClient(b);
    const r = uniq(() => db.prepare('UPDATE clients SET name=?,gstin=?,state_code=?,address=?,email=?,phone=? WHERE id=?').run(c.name, c.gstin, c.state_code, c.address, c.email, c.phone, id));
    if (!r.changes) bad('Client nahi mila'); return { id }; };
  function parseItem(b) {
    const name = str(b.name, 120); if (!name) bad('Item ka naam zaroori hai');
    const gst = Number(b.gst_rate); if (!GST_RATES.includes(gst)) bad(`GST rate ${GST_RATES.join('/')} me se ho`);
    return { name, hsn: str(b.hsn, 10), rate_paise: toPaise(b.rate, 'Rate'), gst_rate: gst };
  }
  const addItem = (b) => { const i = parseItem(b);
    return uniq(() => ({ id: Number(db.prepare('INSERT INTO items(name,hsn,rate_paise,gst_rate) VALUES(?,?,?,?)').run(i.name, i.hsn, i.rate_paise, i.gst_rate).lastInsertRowid) })); };
  const updateItem = (id, b) => { const i = parseItem(b);
    const r = uniq(() => db.prepare('UPDATE items SET name=?,hsn=?,rate_paise=?,gst_rate=? WHERE id=?').run(i.name, i.hsn, i.rate_paise, i.gst_rate, id));
    if (!r.changes) bad('Item nahi mila'); return { id }; };

  // ----- invoices -----
  const createInvoice = tx((b) => {
    const s = settings();
    const client = db.prepare('SELECT * FROM clients WHERE id=?').get(Number(b.client_id));
    if (!client) bad('Client chuno');
    if (!isDate(b.date)) bad('Invoice date sahi nahi hai');
    const due = b.due_date || addDays(b.date, Number(s.default_due_days));
    if (!isDate(due)) bad('Due date sahi nahi hai');
    if (due < b.date) bad('Due date invoice date se pehle nahi ho sakti');
    if (!Array.isArray(b.lines) || !b.lines.length) bad('Kam se kam ek line item chahiye');
    if (b.lines.length > 100) bad('Ek invoice me max 100 lines');
    const lines = b.lines.map((l, i) => {
      let base = {};
      if (l.item_id) { const it = db.prepare('SELECT * FROM items WHERE id=?').get(Number(l.item_id)); if (!it) bad(`Line ${i + 1}: item nahi mila`); base = it; }
      const description = str(l.description || base.name, 300); if (!description) bad(`Line ${i + 1}: item chuno ya description likho`);
      const rate_paise = l.rate !== undefined && l.rate !== '' ? toPaise(l.rate, `Line ${i + 1} rate`) : base.rate_paise;
      if (rate_paise === undefined) bad(`Line ${i + 1}: rate chahiye`);
      const gst_rate = l.gst_rate !== undefined && l.gst_rate !== '' ? Number(l.gst_rate) : base.gst_rate;
      if (!GST_RATES.includes(gst_rate)) bad(`Line ${i + 1}: GST rate galat`);
      return { description, hsn: str(l.hsn ?? base.hsn, 10), qty100: toQty100(l.qty ?? 1), rate_paise, gst_rate };
    });
    const intra = client.state_code === s.state_code;
    const calc = computeInvoice(lines, intra, s.gst_enabled === '1');
    if (calc.total <= 0) bad('Invoice ka total 0 nahi ho sakta');
    const fy = fyOf(b.date, +s.fy_start_month);
    const seq = (db.prepare('SELECT COALESCE(MAX(seq),0) m FROM invoices WHERE fy=?').get(fy).m) + 1;
    const number = `${s.invoice_prefix}/${fy}/${String(seq).padStart(4, '0')}`;
    const id = Number(db.prepare(`INSERT INTO invoices(number,seq,fy,client_id,date,due_date,intra,notes,subtotal_paise,cgst_paise,sgst_paise,igst_paise,total_paise)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(number, seq, fy, client.id, b.date, due, intra ? 1 : 0, str(b.notes, 500),
      calc.subtotal, calc.cgst, calc.sgst, calc.igst, calc.total).lastInsertRowid);
    const li = db.prepare(`INSERT INTO invoice_lines(invoice_id,description,hsn,qty100,rate_paise,gst_rate,amount_paise,cgst_paise,sgst_paise,igst_paise) VALUES(?,?,?,?,?,?,?,?,?,?)`);
    calc.lines.forEach((l) => li.run(id, l.description, l.hsn, l.qty100, l.rate_paise, l.gst_rate, l.amount_paise, l.cgst_paise, l.sgst_paise, l.igst_paise));
    postJournal(b.date, 'invoice', id, `Invoice ${number} - ${client.name}`, [
      { account: '1100', debit: calc.total, client_id: client.id },
      { account: '4000', credit: calc.subtotal, client_id: client.id },
      { account: '2100', credit: calc.cgst }, { account: '2101', credit: calc.sgst }, { account: '2102', credit: calc.igst },
    ]);
    return { id, number, total_paise: calc.total };
  });

  const INV_SELECT = `SELECT i.*, c.name client_name,
    COALESCE((SELECT SUM(amount_paise) FROM payments p WHERE p.invoice_id=i.id),0) paid_paise
    FROM invoices i JOIN clients c ON c.id=i.client_id`;
  const decorate = (r) => {
    const balance = r.status === 'cancelled' ? 0 : r.total_paise - r.paid_paise;
    let pay = 'unpaid';
    if (r.status === 'cancelled') pay = 'cancelled'; else if (balance === 0) pay = 'paid';
    else if (r.paid_paise > 0) pay = 'partial';
    if ((pay === 'unpaid' || pay === 'partial') && r.due_date < today()) pay += '-overdue';
    return { ...r, balance_paise: balance, pay_status: pay };
  };
  function listInvoices({ month, client, status, limit } = {}) {
    const w = [], p = [];
    if (month) { if (!/^\d{4}-\d{2}$/.test(month)) bad('month format YYYY-MM'); w.push("substr(i.date,1,7)=?"); p.push(month); }
    if (client) { w.push('i.client_id=?'); p.push(Number(client)); }
    let rows = db.prepare(`${INV_SELECT} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY i.date DESC, i.id DESC ${limit ? 'LIMIT ' + (Number(limit) | 0) : ''}`).all(...p).map(decorate);
    if (status) rows = rows.filter((r) => r.pay_status.startsWith(status));
    return rows;
  }
  function getInvoice(id) {
    const r = db.prepare(`${INV_SELECT} WHERE i.id=?`).get(Number(id)); if (!r) return null;
    const client = db.prepare('SELECT * FROM clients WHERE id=?').get(r.client_id);
    return { ...decorate(r), client,
      lines: db.prepare('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY id').all(r.id),
      payments: db.prepare('SELECT * FROM payments WHERE invoice_id=? ORDER BY date,id').all(r.id) };
  }
  const cancelInvoice = tx((id) => {
    const inv = getInvoice(id); if (!inv) bad('Invoice nahi mila');
    if (inv.status === 'cancelled') bad('Invoice pehle se cancel hai');
    if (inv.payments.length) bad('Is invoice par payment record hai - pehle payment ki entry hatani padegi, isliye cancel nahi ho sakta');
    db.prepare("UPDATE invoices SET status='cancelled' WHERE id=?").run(inv.id);
    postJournal(inv.date, 'invoice-cancel', inv.id, `Cancelled ${inv.number}`, [
      { account: '1100', credit: inv.total_paise, client_id: inv.client_id },
      { account: '4000', debit: inv.subtotal_paise, client_id: inv.client_id },
      { account: '2100', debit: inv.cgst_paise }, { account: '2101', debit: inv.sgst_paise }, { account: '2102', debit: inv.igst_paise },
    ]);
    return { id: inv.id };
  });

  // ----- payments / expenses / capital -----
  const MODES = { cash: '1001', bank: '1002' };
  const addPayment = tx((b) => {
    const inv = getInvoice(b.invoice_id); if (!inv) bad('Invoice chuno');
    if (inv.status === 'cancelled') bad('Cancelled invoice par payment nahi le sakte');
    if (!isDate(b.date)) bad('Payment date sahi nahi hai');
    if (b.date < inv.date) bad('Payment date invoice date se pehle nahi ho sakti');
    if (!MODES[b.mode]) bad('Mode: cash ya bank');
    const amt = toPaise(b.amount, 'Amount'); if (amt <= 0) bad('Amount 0 se zyada ho');
    if (amt > inv.balance_paise) bad(`Amount baaki balance (${(inv.balance_paise / 100).toFixed(2)}) se zyada nahi ho sakta`);
    const id = Number(db.prepare('INSERT INTO payments(invoice_id,date,amount_paise,mode,ref) VALUES(?,?,?,?,?)').run(inv.id, b.date, amt, b.mode, str(b.ref, 80)).lastInsertRowid);
    postJournal(b.date, 'payment', id, `Receipt ${inv.number} - ${inv.client_name}`, [
      { account: MODES[b.mode], debit: amt }, { account: '1100', credit: amt, client_id: inv.client_id }]);
    return { id };
  });
  const addExpense = tx((b) => {
    if (!EXPENSE_CODES.includes(b.account_code)) bad('Expense category chuno');
    if (!isDate(b.date)) bad('Date sahi nahi hai');
    if (!MODES[b.mode]) bad('Mode: cash ya bank');
    const amt = toPaise(b.amount, 'Amount'); if (amt <= 0) bad('Amount 0 se zyada ho');
    const id = Number(db.prepare('INSERT INTO expenses(date,account_code,amount_paise,mode,vendor,note) VALUES(?,?,?,?,?,?)').run(b.date, b.account_code, amt, b.mode, str(b.vendor, 120), str(b.note, 300)).lastInsertRowid);
    postJournal(b.date, 'expense', id, `${str(b.vendor, 60) || 'Expense'} ${str(b.note, 80)}`.trim(), [
      { account: b.account_code, debit: amt }, { account: MODES[b.mode], credit: amt }]);
    return { id };
  });
  const addCapital = tx((b) => {
    if (!isDate(b.date)) bad('Date sahi nahi hai');
    if (!MODES[b.mode]) bad('Mode: cash ya bank');
    const amt = toPaise(b.amount, 'Amount'); if (amt <= 0) bad('Amount 0 se zyada ho');
    postJournal(b.date, 'capital', null, str(b.note, 100) || "Owner's capital introduced", [
      { account: MODES[b.mode], debit: amt }, { account: '3000', credit: amt }]);
    return { ok: true };
  });
  const listPayments = () => db.prepare(`SELECT p.*, i.number, c.name client_name FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN clients c ON c.id=i.client_id ORDER BY p.date DESC,p.id DESC`).all();
  const listExpenses = () => db.prepare(`SELECT e.*, a.name account_name FROM expenses e JOIN accounts a ON a.code=e.account_code ORDER BY e.date DESC,e.id DESC`).all();

  // ----- reports -----
  const bal = (from, to) => db.prepare(`SELECT a.code,a.name,a.type, COALESCE(SUM(l.debit),0) debit, COALESCE(SUM(l.credit),0) credit
    FROM accounts a LEFT JOIN (SELECT jl.* FROM journal_lines jl JOIN journal j ON j.id=jl.journal_id WHERE (? IS NULL OR j.date>=?) AND j.date<=?) l
    ON l.account_code=a.code GROUP BY a.code ORDER BY a.code`).all(from, from, to);

  function trialBalance(asof) {
    if (!isDate(asof)) bad('Date sahi nahi hai');
    const rows = bal(null, asof).map((r) => {
      const net = r.debit - r.credit;
      return { code: r.code, name: r.name, type: r.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    }).filter((r) => r.debit || r.credit);
    const td = rows.reduce((s, r) => s + r.debit, 0), tc = rows.reduce((s, r) => s + r.credit, 0);
    return { asof, rows, total_debit: td, total_credit: tc, balanced: td === tc };
  }
  function profitLoss(from, to) {
    if (!isDate(from) || !isDate(to) || from > to) bad('Date range sahi nahi hai');
    const rows = bal(from, to);
    const income = rows.filter((r) => r.type === 'income').map((r) => ({ code: r.code, name: r.name, amount: r.credit - r.debit })).filter((r) => r.amount);
    const expenses = rows.filter((r) => r.type === 'expense').map((r) => ({ code: r.code, name: r.name, amount: r.debit - r.credit })).filter((r) => r.amount);
    const ti = income.reduce((s, r) => s + r.amount, 0), te = expenses.reduce((s, r) => s + r.amount, 0);
    return { from, to, income, expenses, total_income: ti, total_expenses: te, net_profit: ti - te };
  }
  function balanceSheet(asof) {
    if (!isDate(asof)) bad('Date sahi nahi hai');
    const rows = bal(null, asof);
    const pick = (t, sign) => rows.filter((r) => r.type === t).map((r) => ({ code: r.code, name: r.name, amount: sign * (r.debit - r.credit) })).filter((r) => r.amount);
    const assets = pick('asset', 1), liabilities = pick('liability', -1), equity = pick('equity', -1);
    const profit = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.credit - r.debit, 0) -
      rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.debit - r.credit, 0);
    equity.push({ code: '', name: 'Profit / (Loss) till date', amount: profit });
    const ta = assets.reduce((s, r) => s + r.amount, 0);
    const tl = liabilities.reduce((s, r) => s + r.amount, 0), te = equity.reduce((s, r) => s + r.amount, 0);
    return { asof, assets, liabilities, equity, total_assets: ta, total_liabilities: tl, total_equity: te, balanced: ta === tl + te };
  }
  function ledger(code, from, to) {
    const acc = db.prepare('SELECT * FROM accounts WHERE code=?').get(code); if (!acc) bad('Account nahi mila');
    if (!isDate(from) || !isDate(to)) bad('Date range sahi nahi hai');
    const sign = ['asset', 'expense'].includes(acc.type) ? 1 : -1;
    const open = db.prepare(`SELECT COALESCE(SUM(debit-credit),0) v FROM journal_lines jl JOIN journal j ON j.id=jl.journal_id WHERE jl.account_code=? AND j.date<?`).get(code, from).v * sign;
    let run = open;
    const rows = db.prepare(`SELECT j.date,j.ref_type,j.narration,jl.debit,jl.credit FROM journal_lines jl JOIN journal j ON j.id=jl.journal_id
      WHERE jl.account_code=? AND j.date>=? AND j.date<=? ORDER BY j.date,j.id,jl.id`).all(code, from, to)
      .map((r) => ({ ...r, balance: (run += sign * (r.debit - r.credit)) }));
    return { account: acc, opening: open, rows, closing: run };
  }
  function clientSummary(from, to) {
    if (!isDate(from) || !isDate(to)) bad('Date range sahi nahi hai');
    return db.prepare(`SELECT c.id, c.name,
      COUNT(CASE WHEN i.status='issued' THEN 1 END) invoices,
      COALESCE(SUM(CASE WHEN i.status='issued' THEN i.total_paise END),0) billed_paise,
      COALESCE(SUM(CASE WHEN i.status='issued' THEN (SELECT COALESCE(SUM(amount_paise),0) FROM payments p WHERE p.invoice_id=i.id) END),0) received_paise
      FROM clients c LEFT JOIN invoices i ON i.client_id=c.id AND i.date>=? AND i.date<=? GROUP BY c.id ORDER BY billed_paise DESC`).all(from, to)
      .map((r) => ({ ...r, outstanding_paise: r.billed_paise - r.received_paise }));
  }
  function dashboard() {
    const t = today(), s = settings(), fy = fyRange(t, +s.fy_start_month), month = t.slice(0, 7);
    const m = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total_paise),0) v FROM invoices WHERE status='issued' AND substr(date,1,7)=?").get(month);
    const out = listInvoices({}).filter((r) => r.balance_paise > 0);
    return { month, invoices_this_month: m.n, billed_this_month_paise: m.v, outstanding_paise: out.reduce((s2, r) => s2 + r.balance_paise, 0),
      overdue_paise: out.filter((r) => r.pay_status.endsWith('overdue')).reduce((s2, r) => s2 + r.balance_paise, 0),
      fy, fy_from: fy.from, fy_to: fy.to, pnl: profitLoss(fy.from, t > fy.to ? fy.to : t) };
  }

  const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function invoicesCsv(month) {
    const rows = listInvoices({ month });
    const head = ['Invoice No', 'Date', 'Client', 'Client GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid', 'Balance', 'Status'];
    const r2 = (n) => (n / 100).toFixed(2);
    const gst = db.prepare('SELECT id,gstin FROM clients').all(); const gm = Object.fromEntries(gst.map((g) => [g.id, g.gstin]));
    return [head, ...rows.map((r) => [r.number, r.date, r.client_name, gm[r.client_id], r2(r.subtotal_paise), r2(r.cgst_paise), r2(r.sgst_paise), r2(r.igst_paise), r2(r.total_paise), r2(r.paid_paise), r2(r.balance_paise), r.pay_status])]
      .map((r) => r.map(csvCell).join(',')).join('\n');
  }

  return {
    db, settings, saveSettings, STATES, GST_RATES, ACCOUNTS, EXPENSE_CODES,
    clients: () => db.prepare('SELECT * FROM clients ORDER BY name').all(), addClient, updateClient,
    items: () => db.prepare('SELECT * FROM items ORDER BY name').all(), addItem, updateItem,
    createInvoice, listInvoices, getInvoice, cancelInvoice,
    addPayment, listPayments, addExpense, listExpenses, addCapital,
    trialBalance, profitLoss, balanceSheet, ledger, clientSummary, dashboard, invoicesCsv,
  };
}

function addDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

module.exports = { openDb, createApp, ValidationError, computeInvoice, toPaise, fyOf, fyRange, STATES, addDays, today };
