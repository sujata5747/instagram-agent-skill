# Invoice Portal

Clients ke liye invoice banao (sirf dropdown/option chun ke), sab store hota hai, aur P&L / Balance Sheet / Trial Balance khud banta hai.

## Chalane ka tarika
```bash
cd invoice-portal
npm start            # http://localhost:3000
npm test             # 5 accounting tests
```
Node 22.5+ chahiye. Koi npm install nahi (zero dependencies). Data `data/portal.db` (SQLite) me save hota hai - isi file ka backup lo.
Optional login: `PORTAL_PASSWORD=xyz npm start` (browser password poochega, username kuch bhi).

## "Bina galti" kaise?
- Paisa **integer paise** me store hota hai - float/decimal ki galti nahi.
- GST khud lagta hai: client ka state == aapka state → CGST+SGST, warna IGST. Rate item se aata hai.
- Invoice number khud banta hai, har financial year (Apr-Mar) me gapless: `INV/2026-27/0001`. Invoice delete nahi hota, sirf cancel (reverse entry ke saath).
- Validation: galat date, GSTIN format, due < invoice date, zyada payment, khali invoice - sab block.
- Har invoice/payment/expense ka **double-entry journal** khud banta hai; unbalanced entry save hi nahi hoti. Isliye Trial Balance hamesha match karta hai.

## Rozana ka flow
1. Settings: company, state, GSTIN. 2. Clients + Items (rate, GST) ek baar. 3. **New Invoice**: client chuno → item chuno → Save (ya "Pichla invoice repeat karo" - monthly clients ke liye). 4. Payment aaye to Payments me entry. 5. Kharche Expenses me, owner ka paisa "Opening capital" me. 6. Reports tab.

Invoices tab: month-wise list (20/month), CSV export, Print/PDF.

## Assumptions (badalna ho to batao)
India GST (0/5/12/18/28%), FY Apr-Mar, cash-basis receipts alag se (accrual accounting: invoice par hi revenue). Expenses me input GST credit nahi liya gaya. Multi-user login nahi (sirf optional password).
