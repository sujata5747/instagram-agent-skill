'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb, createApp, computeInvoice } = require('./lib');

const mk = () => {
  const a = createApp(openDb(':memory:'));
  a.saveSettings({ company_name: 'Test Co', state_code: '07', gstin: '' });
  const intra = a.addClient({ name: 'Delhi Client', state_code: '07' }).id;
  const inter = a.addClient({ name: 'Mumbai Client', state_code: '27', gstin: '27AAPFU0939F1ZV' }).id;
  const svc = a.addItem({ name: 'Consulting', hsn: '9983', rate: '1000', gst_rate: 18 }).id;
  return { a, intra, inter, svc };
};

test('GST split: intra = CGST+SGST, inter = IGST; no rounding loss', () => {
  const r = computeInvoice([{ qty100: 100, rate_paise: 33333, gst_rate: 18 }], true, true);
  assert.equal(r.subtotal, 33333); assert.equal(r.cgst + r.sgst, 6000); assert.equal(r.total, 39333);
  const i = computeInvoice([{ qty100: 100, rate_paise: 10000, gst_rate: 18 }], false, true);
  assert.equal(i.igst, 1800); assert.equal(i.cgst, 0);
});

test('invoice -> payment -> reports all balance', () => {
  const { a, intra, inter, svc } = mk();
  a.addCapital({ date: '2026-04-01', amount: '50000', mode: 'bank' });
  const i1 = a.createInvoice({ client_id: intra, date: '2026-11-01', lines: [{ item_id: svc, qty: '2' }] });
  const i2 = a.createInvoice({ client_id: inter, date: '2026-11-02', lines: [{ item_id: svc, qty: '1', rate: '500.50' }] });
  assert.match(i1.number, /^INV\/2026-27\/0001$/); assert.match(i2.number, /\/0002$/);
  assert.equal(i1.total_paise, 236000); // 2000 + 18%
  a.addPayment({ invoice_id: i1.id, date: '2026-11-05', amount: '1000', mode: 'bank' });
  a.addExpense({ date: '2026-11-06', account_code: '5001', amount: '700', mode: 'cash', vendor: 'Landlord' });
  const asof = '2026-11-30';
  const tb = a.trialBalance(asof), bs = a.balanceSheet(asof), pl = a.profitLoss('2026-04-01', asof);
  assert.ok(tb.balanced); assert.ok(bs.balanced);
  assert.equal(pl.total_income, 200000 + 50050); assert.equal(pl.total_expenses, 70000);
  assert.equal(pl.net_profit, 250050 - 70000);
  const cgst = tb.rows.find((r) => r.code === '2100'), igst = tb.rows.find((r) => r.code === '2102');
  assert.equal(cgst.credit, 18000); assert.equal(igst.credit, 9009);
});

test('validation: overpay, bad dates, empty invoice, cancel rules', () => {
  const { a, intra, svc } = mk();
  assert.throws(() => a.createInvoice({ client_id: intra, date: '2026-02-30', lines: [{ item_id: svc, qty: 1 }] }), /date/);
  assert.throws(() => a.createInvoice({ client_id: intra, date: '2026-11-01', lines: [] }), /line/);
  assert.throws(() => a.createInvoice({ client_id: intra, date: '2026-11-01', lines: [{ item_id: svc, qty: '1.234' }] }), /Quantity/);
  assert.throws(() => a.createInvoice({ client_id: intra, date: '2026-11-01', due_date: '2026-10-01', lines: [{ item_id: svc, qty: 1 }] }), /Due/);
  const i = a.createInvoice({ client_id: intra, date: '2026-11-01', lines: [{ item_id: svc, qty: 1 }] });
  assert.throws(() => a.addPayment({ invoice_id: i.id, date: '2026-11-02', amount: '99999', mode: 'cash' }), /zyada/);
  a.addPayment({ invoice_id: i.id, date: '2026-11-02', amount: '10', mode: 'cash' });
  assert.throws(() => a.cancelInvoice(i.id), /payment/);
  const j = a.createInvoice({ client_id: intra, date: '2026-11-03', lines: [{ item_id: svc, qty: 1 }] });
  a.cancelInvoice(j.id);
  assert.equal(a.getInvoice(j.id).status, 'cancelled');
  assert.ok(a.trialBalance('2026-12-31').balanced);
  assert.equal(a.profitLoss('2026-04-01', '2026-12-31').total_income, 100000); // cancelled one reversed
});

test('invoice numbers restart each financial year, gapless', () => {
  const { a, intra, svc } = mk();
  const n = (d) => a.createInvoice({ client_id: intra, date: d, lines: [{ item_id: svc, qty: 1 }] }).number;
  assert.equal(n('2027-03-31'), 'INV/2026-27/0001'); assert.equal(n('2027-04-01'), 'INV/2027-28/0001'); assert.equal(n('2027-04-02'), 'INV/2027-28/0002');
});

test('20 invoices in a month', () => {
  const { a, intra, inter, svc } = mk();
  for (let k = 1; k <= 20; k++) a.createInvoice({ client_id: k % 2 ? intra : inter, date: `2026-11-${String(k).padStart(2, '0')}`, lines: [{ item_id: svc, qty: k }] });
  assert.equal(a.listInvoices({ month: '2026-11' }).length, 20);
  assert.ok(a.balanceSheet('2026-11-30').balanced);
  assert.equal(a.invoicesCsv('2026-11').split('\n').length, 21);
});
