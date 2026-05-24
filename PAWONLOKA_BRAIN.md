# PawonLoka — Project Brain
> Last updated: 2026-05-24
> Always read this before building anything new.

## 🔗 Project Links
| Item | Value |
|------|-------|
| Live URL | https://pawonloka.pages.dev |
| GitHub | https://github.com/RandyT25/PawonLoka |
| Supabase | https://fnfivhnisigfnbvojonz.supabase.co |
| Supabase Anon Key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU |
| Cloudflare Project | pawonloka |

## 🚀 Deploy Command
git add -A && git commit -m "msg" && git push
npm run deploy

## 🏗 Stack
React 19 + Vite 8 + Supabase + Cloudflare Pages
Mac environment (Randy MacBook Pro, zsh)
No .env file — Supabase keys hardcoded in src/lib/supabase.js
Backoffice PIN: 1999

## 📁 Key Files
src/App.jsx — Router: /, /backoffice, /staff
src/lib/supabase.js — Supabase client
src/lib/seedIngredients.js — 188-ingredient seed
src/backoffice/Backoffice.jsx — Shell + nav + PIN auth
src/backoffice/components/SearchSelect.jsx — Reusable searchable dropdown
src/backoffice/components/ImportExport.jsx — Excel import/export
src/backoffice/components/StaffSubmissions.jsx — Manager review portal
src/backoffice/components/inventory/InvPO.jsx — POs + WAC cascade
src/backoffice/components/RecipeEditor.jsx — Recipe & COGS editor
src/backoffice/components/Schedule.jsx — Weekly schedule + attendance
src/backoffice/components/Settings.jsx — App settings (Supabase-backed)
src/backoffice/components/ReceiptDesigner.jsx — Receipt design + logo upload
src/backoffice/components/Performance.jsx — Staff performance + attendance
src/backoffice/components/UsersAccess.jsx — Staff permissions + PIN mgmt
src/staff/StaffPortal.jsx — Mobile staff portal (/staff)
public/_redirects — Cloudflare SPA routing
public/logo.png — PawonLoka logo

## 🗄 Supabase Tables

CRITICAL COLUMN NAMING:
- products: PK=sku (NOT id), columns: sku,name,cat,price,cogs,active,desc,photo,variants,image_url
- purchase_orders: camelCase: supplierId,supplierName,invoiceNo,dueDate. Items=JSONB array, NO po_items table
- customers: both camelCase (totalSpend) and snake_case (total_spend)
- shifts: both clockIn/clockOut and clock_in/clock_out. Use created_at+date for queries

ALL TABLES:
ingredients: id,name,sku,unit,category,stock,min_stock,cost_per_unit,conversions(jsonb),supplier,last_purchase_price,last_purchase_unit
products: sku(PK),name,cat,price,cogs,active,desc,photo,variants,image_url
customers: id,name,phone,email,tier,points,totalSpend,join_date,customer_code
purchase_orders: id,supplierId,supplierName,invoiceNo,date,dueDate,items(jsonb),subtotal,total,status,notes
suppliers: id,name,contact,phone,email,address,category,payment_terms,active
stock_movements: id,type,ingredient_id,ingredient_name,qty,unit,ref,note,date,time
stock_opname: id,date,status,items(jsonb),total_variance
waste_records: id,date,ingredient_id,ingredient_name,qty,unit,reason,cost,recorded_by,notes
production_batches: id,item_id,item_name,batch_qty,unit,date,produced_by,notes,ingredients_used(jsonb),status
recipes: id,product_id,ingredient_id,ingredient_name,qty,unit
sub_recipes: id,name,ingredient_id,yield_qty,yield_unit,unit,cost_per_unit,notes
sub_recipe_ingredients: id,sub_recipe_id,ingredient_id,ingredient_name,qty,unit
modifier_groups: id,name,required,multi_select,options(jsonb)
vouchers: id,code,type,value,min_order,max_uses,used_count,active,expires_at
staff_submissions: id,type(opname/waste/production/requisition),status(pending/approved/rejected),submitted_by,submitted_at,reviewed_at,data(jsonb)
shifts: id,staff,date,clockIn,clockOut,floatOpen,floatClose,sales,clock_in,clock_out,float_open,float_close,notes,created_at
staff: id,name,role,pin,color,active,permissions(jsonb)
schedules: id,days(jsonb),shift_start,shift_end,staff_list(jsonb),updated_at
attendance: id,staff_id,staff_name,date,clock_in,clock_out,clock_in_photo,clock_out_photo,status,scheduled_station,notes
app_settings: id(main),outlet(jsonb),pos_behaviour(jsonb),regional(jsonb),loyalty(jsonb),stations(jsonb),receipt(jsonb),hardware(jsonb)

STORAGE BUCKETS: logos (public), attendance-photos (public)
RLS: all tables have allow_all policy, anon full access

## 💡 WAC Cascade Logic (InvPO.jsx)
PO Paid for each item:
1. toBaseUnit(ing, qty, purchaseUnit) using conversions[]
2. WAC = (old_stock x old_cost + qty_base x cost_per_base) / (old_stock + qty_base)
3. update ingredients: stock += qty_base, cost_per_unit = WAC
4. log stock_movements type=Purchase
cascadeRecalc(updatedIngIds):
1. sub_recipe_ingredients recalc sub_recipe cost via sub_recipes.yield_qty
2. recipes recalc product cogs + margin
3. recurse if sub-recipe costs changed

## 👤 Staff List
| Name | Role | PIN | Color |
|------|------|-----|-------|
| Claudy | Owner | 7777 | #6366F1 |
| Nita | Head Kasir | 4444 | #F59E0B |
| Aisyah | Bar | 1111 | #10B981 |
| Mahes | Cook Snack | 2222 | #3B82F6 |
| Meldy | Head Cook | 3333 | #8B5CF6 |
| Oji | Cook | 5555 | #EF4444 |
| Yudi | Cook | 6666 | #06B6D4 |
| Alin | Cook Snack | — | — |

## 📅 Schedule Rules
Staff: Nita,Aisyah,Mahes,Alin,Yudi,Meldy,Oji
Stations: Kasir,Bar,Bakar,Snack,Kitchen
OFF rules: Mon=2off, Tue/Wed/Thu/Fri/Sun=1off, Sat=0off(full team)
Default OFF: Mon=Alin+Meldy, Tue=Nita, Wed=Aisyah, Thu=Mahes, Fri=Yudi, Sat=none, Sun=Oji
Cascade priority: Kasir=Nita(Aisyah fallback), Bar=Aisyah(Mahes,Nita fallback), Bakar=Yudi(Meldy fallback)
Snack pool=Mahes+Alin, Kitchen pool=Oji+Meldy

## 📱 Staff Portal (/staff)
Public URL, no login. Staff picks name from button grid.
4 screens: Stock Count, Waste/Spoilage, Production Batch, Request Ingredients, Clock In/Out
Clock In/Out: selfie via camera, saves to attendance table, checks vs shift_start for late status
All submissions go to staff_submissions table status=pending
Manager reviews in Backoffice > Inventory > Staff Reports > Approve/Reject
Requisition approved = creates draft PO

## 📂 Import/Export
System > Import/Export. Ingredients(key=sku), Products(key=sku), Customers(key=phone)
Logic: unchanged=skip, changed=update, new=insert

## 🖨 Receipt Designer
Logo upload: color logo auto-generates B&W version via canvas grayscale
B&W used for thermal printer receipts, color for digital/email
Stored in Supabase storage bucket: logos
Settings stored in app_settings.receipt jsonb column

## 🐛 Critical Rules for Claude
1. Heredoc: use ENDOFFILE (quoted) for JSX with special chars
2. Rewrites: use python3 open(path,w) not cat > — zsh can append
3. zsh standalone # causes command not found — embed in python3
4. NEVER define components inside parent component — causes 1-char typing bug
5. Use .maybeSingle() not .single() for existence checks
6. Cloudflare 308: /backoffice redirects to /backoffice/ — handle trailing slash in App.jsx
7. products has no id column — PK is sku
8. RecipeEditor: dishes=recipes(product_id), subs=sub_recipe_ingredients(sub_recipe_id)
9. sub_recipes auto-synced from Semi-finished ingredients on load
10. Food cost target = 35% not 30%
11. shifts table: use date column for filtering, clock_in/clock_out are time strings HH.mm not timestamps
12. Always verify column names with curl before writing new queries

## 🖨 TODO
- Printer integration (Bluetooth/network/USB) in Hardware module
- WhatsApp receipt resend
- Email receipts (SMTP config)
- Connect POS permissions to staff.permissions jsonb
