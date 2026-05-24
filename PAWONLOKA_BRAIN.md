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
src/lib/supabase.js                                  # Supabase client (hardcoded keys)
src/shared/constants.js                              # STAFF array, PAY_METHODS, fmt, TAX_RATE
src/backoffice/Backoffice.jsx                        # Shell + sidebar + PIN auth + mobile nav
src/backoffice/backoffice.css                        # All backoffice styles + mobile responsive
src/backoffice/components/Dashboard.jsx
src/backoffice/components/Accounting.jsx             # P&L, expenses, cash flow, kas bon
src/backoffice/components/Products.jsx
src/backoffice/components/Categories.jsx
src/backoffice/components/Modifiers.jsx
src/backoffice/components/RecipeEditor.jsx           # Recipe & COGS (replaces Recipes.jsx)
src/backoffice/components/Inventory.jsx              # Overview
src/backoffice/components/inventory/InvIngredients.jsx
src/backoffice/components/inventory/InvPO.jsx        # Purchase Orders + WAC cascade
src/backoffice/components/inventory/InvSuppliers.jsx
src/backoffice/components/inventory/InvProduction.jsx
src/backoffice/components/inventory/InvOpname.jsx
src/backoffice/components/inventory/InvWaste.jsx
src/backoffice/components/inventory/InvMovements.jsx
src/backoffice/components/Employees.jsx              # Staff cards, PIN eye toggle, salary
src/backoffice/components/UsersAccess.jsx            # Permissions per staff
src/backoffice/components/Schedule.jsx               # Weekly schedule + attendance log
src/backoffice/components/Shifts.jsx                 # POS shift records
src/backoffice/components/Performance.jsx            # Staff performance + podium
src/backoffice/components/Customers.jsx              # Card grid, tier, points
src/backoffice/components/Loyalty.jsx                # 2-col: settings + vouchers + leaderboard
src/backoffice/components/Promotions.jsx
src/backoffice/components/Bundles.jsx
src/backoffice/components/Discounts.jsx
src/backoffice/components/PaymentsTax.jsx            # Toggle-style payment methods
src/backoffice/components/FloorPlan.jsx              # Table management + bulk add
src/backoffice/components/Settings.jsx               # Supabase-backed settings + reset tab
src/backoffice/components/ReceiptDesigner.jsx        # Logo upload + B&W conversion
src/backoffice/components/Hardware.jsx               # Device management
src/backoffice/components/ImportExport.jsx
src/backoffice/components/StaffSubmissions.jsx
src/backoffice/components/SearchSelect.jsx
src/pos/POS.jsx                                      # Main POS app
src/pos/components/PinLogin.jsx                      # PIN-only login with logo
src/pos/components/MenuGrid.jsx                      # 160px cards, 140px min
src/pos/components/ShiftModal.jsx
src/pos/components/FloorPlan.jsx                     # POS table picker (separate from backoffice)
src/staff/StaffPortal.jsx                            # Mobile staff portal /staff
public/_redirects                                    # Cloudflare SPA routing
public/logo.png                                      # PawonLoka logo

## 🗄 Supabase Tables

### CRITICAL COLUMN NAMING
- `products`: PK=`sku` (NOT id), columns: sku,name,cat,price,cogs,active,desc,photo,variants,image_url
- `purchase_orders`: camelCase: supplierId,supplierName,invoiceNo,dueDate. Items=JSONB array, NO po_items table
- `customers`: both camelCase (totalSpend) and snake_case (total_spend)
- `shifts`: clock_in/clock_out are "HH.mm" strings. Use `date` for filtering, `created_at` for ordering
- `tables`: integer PK (not text), has area (not section), shape, status, active columns
- `staff`: id=text ("STAFF-xxx"), has salary, phone, join_date, permissions(jsonb), pin, color, role, active

### ALL TABLES
ingredients        id,name,sku,unit,category,stock,min_stock,cost_per_unit,conversions(jsonb),supplier
products           sku(PK),name,cat,price,cogs,active,desc,photo,variants,image_url
customers          id,name,phone,email,tier,points,totalSpend,join_date,customer_code,visits
purchase_orders    id,supplierId,supplierName,invoiceNo,date,dueDate,items(jsonb),subtotal,total,status,notes
suppliers          id,name,contact,phone,email,address,category,payment_terms,active
stock_movements    id,type,ingredient_id,ingredient_name,qty,unit,ref,note,date,time
stock_opname       id,date,status,items(jsonb),total_variance
waste_records      id,date,ingredient_id,ingredient_name,qty,unit,reason,cost,recorded_by,notes
production_batches id,item_id,item_name,batch_qty,unit,date,produced_by,notes,ingredients_used(jsonb),status
recipes            id,product_id,ingredient_id,ingredient_name,qty,unit
sub_recipes        id,name,ingredient_id,yield_qty,yield_unit,unit,cost_per_unit,notes
sub_recipe_ingredients  id,sub_recipe_id,ingredient_id,ingredient_name,qty,unit
modifier_groups    id,name,required,multi_select,options(jsonb)
vouchers           id,code,type,value,min_order,max_uses,used_count,active,expires_at
staff_submissions  id,type,status(pending/approved/rejected),submitted_by,submitted_at,data(jsonb)
shifts             id,staff,date,clock_in(HH.mm),clock_out(HH.mm),float_open,float_close,sales,notes,created_at
staff              id,name,role,pin,color,active,permissions(jsonb),salary,phone,join_date
schedules          id(weekly-template),days(jsonb),shift_start,shift_end,staff_list(jsonb),updated_at
attendance         id,staff_name,date,clock_in(timestamptz),clock_out,clock_in_photo,clock_out_photo,status,scheduled_station
tables             id(integer),name,capacity,status,area,shape,active,sort,open_bill_id
app_settings       id(main),outlet(jsonb),pos_behaviour(jsonb),regional(jsonb),loyalty(jsonb),stations(jsonb),receipt(jsonb)
expenses           id,date,category,description,amount,payment_method,auto_source,source_id,staff_name,notes
kas_bon            id,staff_name,amount,date,reason,status(outstanding/deducted/cancelled),deducted_date,notes
opening_balance    id(YYYY-MM),amount,notes,updated_at

### STORAGE BUCKETS
- `logos` (public) — color logo + auto-generated B&W for receipts
- `attendance-photos` (public) — clock in/out selfies

### RLS
All tables have allow_all policy, anon full access

## 👤 Staff List
| Name | Role | PIN | Color | DB ID |
|------|------|-----|-------|-------|
| Claudy | Owner | 7777 | #6366F1 | STAFF-1 |
| Nita | Head Kasir | 4444 | #F59E0B | STAFF-2 |
| Aisyah | Bar | 1111 | #10B981 | STAFF-3 |
| Mahes | Cook Snack | 2222 | #3B82F6 | STAFF-4 |
| Meldy | Head Cook | 3333 | #8B5CF6 | STAFF-5 |
| Oji | Cook | 5555 | #EF4444 | STAFF-6 |
| Yudi | Cook | 6666 | #06B6D4 | STAFF-7 |
| Alin | Cook Snack | — | — | not yet in DB |

## 📅 Schedule Rules
- Staff: Nita, Aisyah, Mahes, Alin, Yudi, Meldy, Oji
- Stations: Kasir, Bar, Bakar, Snack, Kitchen
- OFF rules: Mon=2off, Tue/Wed/Thu/Fri/Sun=1off, Sat=0off (full team)
- Default OFF: Mon=Alin+Meldy, Tue=Nita, Wed=Aisyah, Thu=Mahes, Fri=Yudi, Sat=none, Sun=Oji
- Cascade: Kasir=Nita(→Aisyah), Bar=Aisyah(→Mahes→Nita), Bakar=Yudi(→Meldy)
- Snack pool=Mahes+Alin, Kitchen pool=Oji+Meldy

## 💡 WAC Cascade Logic (InvPO.jsx)
PO Paid → each item:
1. toBaseUnit(ing, qty, purchaseUnit) via conversions[]
2. WAC = (old_stock × old_cost + qty_base × cost_per_base) / (old_stock + qty_base)
3. Update ingredients: stock += qty_base, cost_per_unit = WAC
4. Log stock_movements type=Purchase
5. cascadeRecalc: sub_recipe_ingredients → sub_recipe cost → recipes → product cogs

## 🧾 Accounting Module
- Tab: Overview (P&L summary + expense breakdown)
- Tab: Laba Rugi (full P&L statement, export CSV/TXT)
- Tab: Pengeluaran (manual expenses + auto POs + auto salary)
- Tab: Arus Kas (cash flow with opening balance per month)
- Tab: Kas Bon (staff advances, mark as deducted)
- Expense categories: Bahan Baku(auto-PO), Kitchen, Bar, Floor&Cleaning, Gas&Utilities, PLN, PDAM, WiFi, IPL, Staff Meal, Gaji(auto-salary), Kas Bon, Sewa, Marketing, Lain-lain
- Opening balance: configurable per month (default Rp 300.000), stored in opening_balance table

## 📱 Mobile Backoffice
- Hamburger (☰) in topbar opens slide-in LEFT sidebar (280px wide)
- Sidebar shows full nav with groups, auto-closes on item select
- All overlays/modals: slide up from bottom (border-radius 20px top)
- Tables: horizontal scroll with sticky last column (action buttons)
- CSS: src/backoffice/backoffice.css has @media (max-width: 768px) section
- PO modal items: card-per-item layout on mobile (.po-item-row class)
- Inputs: font-size 16px on mobile to prevent iOS zoom

## 📱 Staff Portal (/staff)
- Public URL, no login required
- Staff picks name from grid on home screen
- Screens: Stock Count, Waste/Spoilage, Production Batch, Request Ingredients, Clock In/Out
- Clock In/Out: front camera selfie, saves to attendance table, checks vs shift_start
- All submissions → staff_submissions table (status=pending)
- Manager reviews in Backoffice → Inventory → Staff Reports
- Scroll fix: wrap style uses height:100dvh + flex column + body overflowY:auto

## 🖨 Receipt Designer
- Upload color logo → auto-generates B&W via canvas grayscale
- Both stored in Supabase storage bucket: logos
- Settings stored in app_settings.receipt jsonb column
- B&W logo used for thermal printer, color for digital/WhatsApp

## 🐛 Critical Rules for Claude
1. **Heredoc**: use `'ENDOFFILE'` (quoted) for JSX with special chars
2. **Rewrites**: use `python3 open(path,'w')` not `cat >` — zsh appends
3. **zsh**: standalone `#` = command not found — embed in python3
4. **NEVER** define components inside parent component — causes 1-char typing bug
5. **Use** `.maybeSingle()` not `.single()` for existence checks (406 error)
6. **Cloudflare**: /backoffice → /backoffice/ — handle trailing slash in App.jsx
7. **products** has no `id` column — PK is `sku`
8. **tables** has integer PK — never insert custom string id
9. **shifts**: clock_in/clock_out are "HH.mm" strings, NOT timestamps
10. **RecipeEditor**: dishes=recipes(product_id), subs=sub_recipe_ingredients(sub_recipe_id)
11. **sub_recipes**: auto-synced from Semi-finished ingredients. id format: SR-ING-XXX
12. **NEVER** touch InvIngredients.jsx modal with div patching — rewrite fully or restore from git
13. **Mobile CSS**: always use CSS classes for mobile changes, never change JSX layout for mobile only
14. **Overlay close**: use `onMouseDown` not `onClick` to prevent accidental close on drag
15. **Always verify** column names with curl before writing new queries

## 📦 Completed Modules
✅ Dashboard (KPIs, charts, demo data toggle)
✅ Accounting (P&L, expenses, cash flow, kas bon)
✅ Products (photo upload, variants, grid/list)
✅ Categories (drag-reorder, color picker, emoji)
✅ Modifiers (options JSONB)
✅ Recipes & COGS (3-level: raw→sub→dish, WAC cascade)
✅ Inventory Overview
✅ Ingredients (conversions, WAC preview)
✅ Purchase Orders (WAC cascade on paid)
✅ Suppliers
✅ Production, Stock Opname, Waste Recording, Movement History
✅ Staff Reports (approve/reject submissions)
✅ Employees (card grid, PIN eye toggle, salary, color)
✅ Users & Access (permissions per staff, PIN management)
✅ Schedule (weekly template, cascade rules, shuffle, attendance)
✅ Shifts (POS shift records)
✅ Performance (podium, attendance-linked hours)
✅ Customers (card grid, tier, points, progress bar)
✅ Loyalty (2-col: settings + vouchers + leaderboard)
✅ Promotions, Bundles, Discounts
✅ Payments & Tax (toggle-style)
✅ Floor Plan (bulk add, editable sections, status colors)
✅ Settings (Supabase-backed, outlet/POS/regional/loyalty/stations/reset)
✅ Receipt Designer (logo upload + B&W auto-convert)
✅ Hardware (device management UI)
✅ Import/Export (CSV/Excel)
✅ Audit Log, Integrations (placeholders)

## 🔧 TODO / Pending
- Printer Bluetooth/network integration in Hardware module
- WhatsApp receipt resend from Orders modal
- Email receipts (SMTP config)
- Connect POS login to staff.permissions (currently uses hardcoded STAFF in constants.js)
- Alin not yet in staff table in Supabase
- PWA install for staff link + POS tablet + backoffice phone
- Shift float: only ask on first open, not on staff switch
- Clock in reminder when shift closes
