# PawonLoka — Project Brain
> Last updated: 2026-05-22
> Always read this before building anything new.

## 🔗 Project Links
| Item | Value |
|------|-------|
| **Live URL** | https://pawonloka.pages.dev |
| **GitHub** | https://github.com/RandyT25/PawonLoka |
| **Supabase** | https://fnfivhnisigfnbvojonz.supabase.co |
| **Supabase Anon Key** | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU |
| **Cloudflare Project** | pawonloka |

## 🚀 Deploy Command
git add -A && git commit -m "msg" && git push
npm run deploy

## 🏗 Stack
- React 19 + Vite 8 + Supabase + Cloudflare Pages
- Mac environment (Randy MacBook Pro, zsh)
- No .env file — Supabase keys hardcoded in src/lib/supabase.js
- Backoffice PIN: 1999

## 📁 Key Files
src/App.jsx                          # Router: /, /backoffice, /staff
src/lib/supabase.js                  # Supabase client
src/lib/seedIngredients.js           # 188-ingredient seed
src/lib/ingredients_seed.json        # 188 ingredients data
src/backoffice/Backoffice.jsx        # Shell + nav + PIN auth
src/backoffice/components/SearchSelect.jsx       # Reusable searchable dropdown
src/backoffice/components/ImportExport.jsx       # Excel import/export
src/backoffice/components/StaffSubmissions.jsx   # Manager review portal
src/backoffice/components/inventory/InvPO.jsx    # POs + WAC cascade
src/staff/StaffPortal.jsx            # Mobile staff portal (/staff)
public/_redirects                    # Cloudflare SPA routing
public/logo.png                      # PawonLoka logo

## 🗄 Supabase Schema — CRITICAL NOTES

products — PK is sku NOT id. Columns: sku, name, cat, price, cogs, active, desc, photo, variants, image_url
purchase_orders — camelCase: supplierId, supplierName, invoiceNo, dueDate. Items stored as JSONB array, NO separate po_items table
customers — has BOTH camelCase (totalSpend) and snake_case (total_spend)
shifts — has BOTH clockIn/clockOut and clock_in/clock_out

All tables:
ingredients: id, name, sku, unit, category, stock, min_stock, cost_per_unit, conversions(jsonb), supplier, last_purchase_price, last_purchase_unit
products: sku(PK), name, cat, price, cogs, active, desc, photo, variants, image_url
customers: id, name, phone, email, tier, points, totalSpend, join_date, customer_code
purchase_orders: id, supplierId, supplierName, invoiceNo, date, dueDate, items(jsonb), subtotal, total, status, notes
suppliers: id, name, contact, phone, email, address, category, payment_terms, active
stock_movements: id, type, ingredient_id, ingredient_name, qty, unit, ref, note, date, time
stock_opname: id, date, status, items(jsonb), total_variance
waste_records: id, date, ingredient_id, ingredient_name, qty, unit, reason, cost, recorded_by, notes
production_batches: id, item_id, item_name, batch_qty, unit, date, produced_by, notes, ingredients_used(jsonb), status
recipes: id, product_id, ingredient_id, qty, unit
sub_recipes: id, name, ingredient_id, yield_qty, yield_unit, notes
sub_recipe_ingredients: id, sub_recipe_id, ingredient_id, qty, unit
modifier_groups: id, name, required, multi_select, options(jsonb)
vouchers: id, code, type, value, min_order, max_uses, used_count, active, expires_at
staff_submissions: id, type(opname/waste/production/requisition), status(pending/approved/rejected), submitted_by, submitted_at, reviewed_at, data(jsonb)
shifts: id, staff, date, clockIn, clockOut, floatOpen, floatClose, sales, notes

RLS: all tables have allow_all policy, anon full access

## 💡 WAC Cascade Logic
PO Paid for each item:
1. toBaseUnit(ing, qty, purchaseUnit) using conversions[]
2. WAC = (old_stock x old_cost + qty_base x cost_per_base) / (old_stock + qty_base)
3. update ingredients: stock += qty_base, cost_per_unit = WAC
4. log stock_movements type=Purchase
Then cascadeRecalc(updatedIngIds):
1. sub_recipe_ingredients recalc sub_recipe cost via sub_recipes.yield_qty
2. recipes recalc product cogs + margin
3. recurse if sub-recipe costs changed

## 👤 Staff List
Aisyah (Bar), Mahes (Cook Snack), Alin (Cook Snack), Meldy (Head Cook),
Nita (Head Kasir), Oji (Cook), Yudi (Cook), Claudy (Owner)

## 📱 Staff Portal (/staff)
Public URL, no login. Staff picks name from button grid.
- Stock Count: searchable opname list, pending submission
- Waste/Spoilage: pending waste record
- Production Batch: selects sub-recipe, auto-fills ingredients, pending
- Request Ingredients: PO-style form with dept/date/searchable items, pending, manager converts to draft PO
Manager reviews in Backoffice > Inventory > Staff Reports > Approve/Reject

## 📂 Import/Export
System > Import/Export. Modules: Ingredients (key=sku), Products (key=sku), Customers (key=phone)
Logic: unchanged=skip, changed=update, new=insert

## 🐛 Critical Rules for Claude
1. Heredoc delimiter: use ENDOFFILE (quoted) for JSX with special chars
2. Rewrites: use python3 open(path,w) not cat > — zsh can append instead of overwrite
3. zsh standalone # causes command not found — embed in python3 or remove
4. NEVER define components (modals, selects) inside parent component — causes 1-char typing bug
5. Use .maybeSingle() not .single() for existence checks — .single() returns 406 when no row found
6. Cloudflare 308: /backoffice redirects to /backoffice/ automatically — handle trailing slash in App.jsx
7. products has no id column — PK is sku
8. RecipeEditor tables: dishes=recipes(product_id), subs=sub_recipe_ingredients(sub_recipe_id)
9. Always verify column names with curl before writing new queries
10. Food cost target = 35% not 30%

## 🖨 TODO
- Printer integration (Bluetooth/network/USB) in Hardware backoffice module
- WhatsApp receipt resend
- Recipe and COGS module full review
- Import/Export for Recipes module
