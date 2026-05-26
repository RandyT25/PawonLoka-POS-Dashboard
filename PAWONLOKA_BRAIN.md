# PawonLoka — Project Brain
> Last updated: 2026-05-25
> Always read this before building anything new.

## 🔗 Project Links
| Item | Value |
|------|-------|
| Live URL | https://pawonloka.pages.dev |
| Backoffice | https://pawonloka.pages.dev/backoffice |
| Staff Portal | https://pawonloka.pages.dev/staff |
| GitHub | https://github.com/RandyT25/PawonLoka |
| Supabase | https://fnfivhnisigfnbvojonz.supabase.co |
| Supabase Anon Key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU |

## 🚀 Deploy Command
git add -A && git commit -m "msg" && git push && npm run deploy

## 🏗 Stack
- React 19 + Vite 8 + Supabase + Cloudflare Pages
- Mac environment (Randy MacBook Pro, zsh)
- No .env file — Supabase keys hardcoded in src/lib/supabase.js
- Backoffice PIN: 1999
- Logo: /public/logo.png

## 📁 Key Files
src/App.jsx                                          # Router: /, /backoffice, /staff
src/lib/supabase.js                                  # Supabase client
src/shared/constants.js                              # STAFF array, PAY_METHODS, fmt, TAX_RATE
src/backoffice/Backoffice.jsx                        # Shell + sidebar + PIN + mobile hamburger
src/backoffice/backoffice.css                        # All styles + mobile @media 768px
src/backoffice/components/Dashboard.jsx
src/backoffice/components/Accounting.jsx             # P&L, expenses, cash flow, kas bon
src/backoffice/components/Products.jsx
src/backoffice/components/Categories.jsx
src/backoffice/components/Modifiers.jsx
src/backoffice/components/RecipeEditor.jsx           # Recipe & COGS (NOT Recipes.jsx)
src/backoffice/components/Inventory.jsx
src/backoffice/components/inventory/InvIngredients.jsx
src/backoffice/components/inventory/InvPO.jsx        # Purchase Orders + WAC cascade
src/backoffice/components/inventory/InvSuppliers.jsx
src/backoffice/components/inventory/InvProduction.jsx
src/backoffice/components/inventory/InvOpname.jsx
src/backoffice/components/inventory/InvWaste.jsx
src/backoffice/components/inventory/InvMovements.jsx
src/backoffice/components/Employees.jsx
src/backoffice/components/UsersAccess.jsx
src/backoffice/components/Schedule.jsx
src/backoffice/components/Shifts.jsx
src/backoffice/components/Performance.jsx
src/backoffice/components/Customers.jsx
src/backoffice/components/Loyalty.jsx
src/backoffice/components/Promotions.jsx             # Saves to promos table
src/backoffice/components/Bundles.jsx                # Saves to bundles table
src/backoffice/components/Discounts.jsx              # Saves to discounts table
src/backoffice/components/PaymentsTax.jsx            # Saves to app_settings.payments
src/backoffice/components/FloorPlan.jsx
src/backoffice/components/Settings.jsx               # Supabase-backed + reset tab
src/backoffice/components/ReceiptDesigner.jsx        # Logo upload + B&W
src/backoffice/components/Hardware.jsx               # Saves to hardware_devices table
src/backoffice/components/ImportExport.jsx
src/backoffice/components/StaffSubmissions.jsx
src/backoffice/components/SearchSelect.jsx
src/pos/POS.jsx                                      # Main POS
src/pos/components/PinLogin.jsx                      # PIN login from staff table
src/pos/components/MenuGrid.jsx                      # Products + Bundles tab
src/pos/components/Cart.jsx                          # Cart with backoffice discounts
src/pos/components/ChargeModal.jsx                   # Payment modal
src/pos/components/PromoModal.jsx                    # Reads from promos table
src/pos/components/ModifierModal.jsx                 # Reads from modifier_groups table
src/pos/components/ShiftModal.jsx
src/pos/components/FloorPlan.jsx                     # POS table picker
src/staff/StaffPortal.jsx                            # Mobile staff portal
public/_redirects                                    # Cloudflare SPA routing
public/logo.png

## 🗄 Supabase Tables

### CRITICAL COLUMN NAMING
- products: PK=sku (NOT id)
- purchase_orders: camelCase cols (supplierId, supplierName, invoiceNo, dueDate), items=JSONB
- shifts: clock_in/clock_out = "HH.mm" strings. Use date for filtering
- tables: INTEGER PK, uses area (not section), has shape/status/active
- staff: TEXT PK ("STAFF-xxx"), has salary/phone/join_date/permissions(jsonb)
- promos: used by both Promotions backoffice module AND POS PromoModal
- discounts: used by Discounts module, shown in POS Cart order discount

### ALL TABLES
ingredients, products, customers, purchase_orders, suppliers
stock_movements, stock_opname, waste_records, production_batches
recipes, sub_recipes, sub_recipe_ingredients
modifier_groups, promos, discounts, bundles, vouchers
staff_submissions, shifts, staff, schedules, attendance
tables, app_settings, expenses, kas_bon, opening_balance
hardware_devices, audit_logs

### app_settings columns
id(main), outlet(jsonb), pos_behaviour(jsonb), regional(jsonb),
loyalty(jsonb), stations(jsonb), receipt(jsonb), hardware(jsonb),
payments(jsonb), updated_at

### payments jsonb structure
{ tax:{enabled,rate,type}, service:{enabled,rate},
  rounding:{enabled,roundTo}, methods:[{id,name,icon,note,enabled,surcharge}] }

### STORAGE BUCKETS
- logos (public) — color + B&W receipt logos
- attendance-photos (public) — clock in/out selfies

### RLS
All tables: allow_all policy, anon full access

## 👤 Staff
| Name | Role | PIN | Color | DB ID |
|------|------|-----|-------|-------|
| Claudy | Owner | 7777 | #6366F1 | STAFF-1 |
| Nita | Head Kasir | 4444 | #F59E0B | STAFF-2 |
| Aisyah | Bar | 1111 | #10B981 | STAFF-3 |
| Mahes | Cook Snack | 2222 | #3B82F6 | STAFF-4 |
| Meldy | Head Cook | 3333 | #8B5CF6 | STAFF-5 |
| Oji | Cook | 5555 | #EF4444 | STAFF-6 |
| Yudi | Cook | 6666 | #06B6D4 | STAFF-7 |
| Alin | Cook Snack | — | — | NOT IN DB YET |

## 🔌 POS ↔ Backoffice Sync Status
- Products/menu → products table ✅
- Categories → categories table ✅
- Staff PINs → staff table ✅ (PinLogin + Clock In load from DB)
- Tables → tables table ✅
- Modifiers → modifier_groups table ✅ (ModifierModal loads from DB)
- Payment methods → app_settings.payments ✅
- Tax/Service rate → app_settings.payments ✅ (0 when disabled)
- Discounts → discounts table ✅ (shown in Cart)
- Promos/Vouchers → promos table ✅ (PromoModal reads from promos)
- Bundles → bundles table ✅ (shown in MenuGrid Bundles tab)
- Receipt settings → app_settings.receipt ✅
- Orders → orders table ✅
- Attendance → attendance table ✅
- Shifts → shifts table ✅
- Customers/loyalty → customers table ✅
- Hardware devices → hardware_devices table ✅

## 📱 PWA Status
- NOT YET ADDED (planned)
- Previous attempt caused Cloudflare 308 redirect loop
- Solution: NO service worker cache for navigation, only static assets
- Need separate manifests for /, /backoffice, /staff

## 📅 Schedule Rules
- Stations: Kasir, Bar, Bakar, Snack, Kitchen
- OFF: Mon=2, Tue/Wed/Thu/Fri/Sun=1, Sat=0
- Default OFF: Mon=Alin+Meldy, Tue=Nita, Wed=Aisyah, Thu=Mahes, Fri=Yudi, Sun=Oji
- Cascade: Kasir=Nita(→Aisyah), Bar=Aisyah(→Mahes→Nita), Bakar=Yudi(→Meldy)

## 💡 WAC Cascade (InvPO.jsx)
PO Paid → toBaseUnit → WAC calc → update ingredients → log stock_movements
→ cascadeRecalc: sub_recipe_ingredients → sub_recipe cost → recipes → product.cogs

## 🧾 Accounting Module
Tabs: Overview | Laba Rugi | Pengeluaran | Arus Kas | Kas Bon
Expense categories (auto): Bahan Baku(PO), Gaji(salary)
Opening balance: per month, stored in opening_balance table

## 📱 Mobile Backoffice
- Hamburger (☰) → slide-in LEFT sidebar 280px, auto-closes on select
- Modals: slide up from bottom, border-radius 20px, max-height 88dvh
- Tables: horizontal scroll, sticky last column
- CSS breakpoint: 768px in backoffice.css

## 🐛 Critical Rules
1. Heredoc: use quoted ENDOFFILE for JSX
2. Rewrites: python3 open(path,'w') NOT cat > (zsh appends)
3. zsh standalone # = error — embed in python3
4. NEVER define components inside parent — 1-char typing bug
5. Use .maybeSingle() not .single()
6. products PK = sku, tables PK = integer
7. shifts clock_in = "HH.mm" string NOT timestamp
8. NEVER patch InvIngredients.jsx divs — rewrite full modal or git restore
9. Mobile fixes: CSS only, never change JSX layout for mobile
10. Overlay: onMouseDown not onClick
11. RecipeEditor used (NOT Recipes.jsx)
12. promos table = Promotions module + POS PromoModal
13. discounts table = Discounts module + POS Cart order discount
14. PaymentsTax saves to app_settings.payments — POS reads on load
15. ChargeModal: taxRate prop passed from POS, hide tax row when tax=0
16. PWA: NO service worker navigation cache — caused 308 on Cloudflare
17. zsh: backticks in python strings cause "bad substitution" — use /tmp files

## ✅ Completed Modules
Dashboard, Accounting, Products, Categories, Modifiers, Recipes & COGS,
Inventory (all 8 sub-screens), Staff Reports, Employees, Users & Access,
Schedule, Shifts, Performance, Customers, Loyalty, Promotions & Vouchers,
Bundles, Discounts, Payments & Tax, Floor Plan, Settings, Receipt Designer,
Hardware, Import/Export

## ✅ COMPLETED PHASE 1-3
- PWA install banners for POS/Backoffice/Staff
- Offline mode indicator + better SW caching
- Alin added to staff DB (PIN: 8888)
- Shift float only asks once per session
- Clock in reminder on shift open, clock out on shift close
- WhatsApp auto-send on payment (if customer has phone)
- Add Staff via Employees UI (no SQL needed)
- Bundles save correctly to orders table
- Orders History module in backoffice
- Stock deduction on payment (ready when recipes added)
- Audit log on login + payment + void
- Receipt designer settings used when printing
- Auto-print receipt on payment via Bluetooth printer
- Printer status indicator in POS header
- Staff permissions enforced: void needs PIN+reason, discount limit
- Modifiers from DB, filter by category, price added to item
- Promo/Voucher from promos table, shown as buttons

## ✅ COMPLETED SESSION 2026-05-26
- White screen fix: removed seed gate from App.jsx, fixed Orders import in Backoffice.jsx
- /pos route working, _redirects fixed (no non-trailing-slash entries)
- Staff portal rebuilt: station picker (Kitchen/Snack/Bar/Kasir), clock in/out removed, staff name buttons per station, Kasir restricted to Request only
- 4-printer setup: receipt/kitchen1/kitchen2/bar roles, correct category→station routing in KITCHEN_STATIONS
- Staff permissions: max_discount cap enforced in Cart, cash permission enforced on CashInOutModal
- WhatsApp receipt resend from Orders modal (looks up customer phone, opens WA)
- KITCHEN_STATIONS dynamic import warning fixed (static import in OrdersModal)
- PO void confirmed working

## 🔧 KNOWN ISSUES TO FIX NEXT SESSION
- None currently known

## 🔧 TODO
- Assign station to ingredients (for Staff portal filtering)
- Add recipes for dishes (so stock deduction works on payment)
- Orders History in Backoffice — date range filter, export, detailed view
- Staff Schedule — auto-generate weekly schedule from brain rules
- Test printer connection end-to-end (manual, daily)
