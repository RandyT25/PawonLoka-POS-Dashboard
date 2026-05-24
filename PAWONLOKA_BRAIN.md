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
src/backoffice/components/Promotions.jsx
src/backoffice/components/Bundles.jsx
src/backoffice/components/Discounts.jsx
src/backoffice/components/PaymentsTax.jsx
src/backoffice/components/FloorPlan.jsx
src/backoffice/components/Settings.jsx               # Supabase-backed + reset tab
src/backoffice/components/ReceiptDesigner.jsx        # Logo upload + B&W conversion
src/backoffice/components/Hardware.jsx
src/backoffice/components/ImportExport.jsx
src/backoffice/components/StaffSubmissions.jsx
src/backoffice/components/SearchSelect.jsx
src/pos/POS.jsx                                      # Main POS + Clock In modal with staff selector
src/pos/components/PinLogin.jsx                      # PIN-only login (no staff name buttons)
src/pos/components/MenuGrid.jsx                      # 160px uniform cards
src/pos/components/ShiftModal.jsx
src/pos/components/FloorPlan.jsx                     # POS table picker (different from backoffice)
src/staff/StaffPortal.jsx                            # Mobile staff portal
public/_redirects
public/logo.png

## 🗄 Supabase Tables

### CRITICAL COLUMN NAMING
- products: PK=sku (NOT id)
- purchase_orders: camelCase cols (supplierId, supplierName, invoiceNo, dueDate), items=JSONB
- shifts: clock_in/clock_out = "HH.mm" strings. Use date for filtering
- tables: INTEGER PK, uses area (not section), has shape/status/active
- staff: TEXT PK ("STAFF-xxx"), has salary/phone/join_date/permissions(jsonb)

### TABLES
ingredients, products, customers, purchase_orders, suppliers
stock_movements, stock_opname, waste_records, production_batches
recipes, sub_recipes, sub_recipe_ingredients
modifier_groups, vouchers, staff_submissions
shifts, staff, schedules, attendance
tables, app_settings, expenses, kas_bon, opening_balance

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

## 📅 Schedule Rules
- Stations: Kasir, Bar, Bakar, Snack, Kitchen
- OFF: Mon=2, Tue/Wed/Thu/Fri/Sun=1, Sat=0
- Default OFF: Mon=Alin+Meldy, Tue=Nita, Wed=Aisyah, Thu=Mahes, Fri=Yudi, Sun=Oji
- Cascade: Kasir=Nita(→Aisyah), Bar=Aisyah(→Mahes→Nita), Bakar=Yudi(→Meldy)
- Snack pool=Mahes+Alin, Kitchen pool=Oji+Meldy

## 💡 WAC Cascade (InvPO.jsx)
PO Paid → toBaseUnit → WAC calc → update ingredients → log stock_movements
→ cascadeRecalc: sub_recipe_ingredients → sub_recipe cost → recipes → product.cogs

## 🧾 Accounting Module
Tabs: Overview | Laba Rugi | Pengeluaran | Arus Kas | Kas Bon
Expense categories: Bahan Baku(auto-PO), Kitchen, Bar, Floor&Cleaning,
  Gas&Utilities, PLN, PDAM, WiFi, IPL, Staff Meal, Gaji(auto-salary),
  Kas Bon, Sewa, Marketing, Lain-lain
Opening balance: per month, default Rp 300.000, stored in opening_balance table

## 📱 Mobile Backoffice
- Hamburger button (☰) in topbar → slide-in LEFT sidebar (280px)
- Sidebar shows full NAV with groups, auto-closes on item select
- Modals: slide up from bottom, border-radius 20px top, max-height 88dvh
- Tables: horizontal scroll, sticky last column for action buttons
- PO modal: .po-item-row class switches to card layout on mobile
- Inputs: font-size 16px prevents iOS zoom
- CSS breakpoint: 768px in backoffice.css

## 📱 Staff Portal (/staff)
- No login, staff picks name from grid
- Screens: Stock Count, Waste, Production, Request, Clock In/Out
- Clock In/Out: front camera selfie → attendance table
- wrap: height:100dvh flex column; body: overflowY:auto

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
10. Overlay: onMouseDown not onClick to prevent accidental close
11. RecipeEditor is used (NOT Recipes.jsx) — wired in Backoffice.jsx line ~94
12. sub_recipes IDs: "SR-ING-XXX" format, no auto-sync needed (seeded via SQL)

## ✅ Completed Modules
Dashboard, Accounting, Products, Categories, Modifiers, Recipes & COGS,
Inventory (all 8 sub-screens), Staff Reports, Employees, Users & Access,
Schedule, Shifts, Performance, Customers, Loyalty, Promotions, Bundles,
Discounts, Payments & Tax, Floor Plan, Settings, Receipt Designer,
Hardware, Import/Export

## 🔧 TODO
- Printer Bluetooth/network/USB integration (Hardware module)
- WhatsApp receipt resend from Orders modal
- Email receipts (SMTP)
- Connect POS login to staff.permissions (currently hardcoded STAFF array)
- Add Alin to staff table in Supabase
- PWA install for staff/POS/backoffice
- Shift float: only ask on first open, not staff switch
- Clock in reminder on shift close
