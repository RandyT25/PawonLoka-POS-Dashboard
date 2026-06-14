# PROJECT AUDIT — PawonLoka POS Dashboard
> Generated: 2026-06-14 | Auditor: Staff Engineer Review

---

## Project Overview
PawonLoka is a **production restaurant/café POS system** deployed as a multi-module PWA on Cloudflare Pages. It serves three distinct user audiences — cashiers (POS), management (Backoffice), and kitchen/bar staff (Staff Portal).

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.6 |
| Build Tool | Vite | 8.0.12 |
| Backend / DB | Supabase (PostgreSQL) | 2.105.4 |
| Deployment | Cloudflare Pages | via wrangler |
| PDF Export | jsPDF + autotable | 4.2.1 / 5.0.8 |
| Excel Export | xlsx (SheetJS) | 0.18.5 |
| Hardware | Web Bluetooth API (BLE ESC/POS) | native |

## Architecture Pattern
**Monolithic SPA with path-based module routing.** Three sub-apps share one bundle:
- `/` or `/pos/*` → POS module
- `/backoffice/*` → Backoffice module
- `/staff/*` → Staff Portal module

No router library — `App.jsx` uses `window.location.pathname` + `popstate` event for routing.

## Folder Structure
```
src/
├── App.jsx              # Path-based module switcher
├── main.jsx             # React root + global ErrorBoundary
├── index.css            # Global reset only
├── App.css              # UNUSED — Vite template artifact
├── lib/
│   └── supabase.js      # Supabase client (hardcoded keys)
├── shared/
│   └── constants.js     # STAFF, PAY_METHODS, KITCHEN_STATIONS, fmt()
├── pos/                 # POS MODULE (27 files)
│   ├── POS.jsx          # 991-line god component
│   ├── components/      # 22 components
│   └── hooks/           # 5 hooks (2 empty)
├── backoffice/          # BACKOFFICE MODULE (36 components)
│   ├── Backoffice.jsx   # Shell + auth gate
│   ├── backoffice.css   # All backoffice styles
│   └── components/      # 28 core + 8 inventory
└── staff/
    └── StaffPortal.jsx  # Staff submissions portal
```

## State Management
- **No global state library** (no Redux, Zustand, Context API)
- All state is local `useState` within components
- Inter-component communication via props
- Real-time sync via Supabase Realtime subscriptions
- Custom hooks: `useCart`, `useOrders`, `usePrinter`, `useWhatsApp`

## Database Structure (Supabase PostgreSQL)
**22+ tables identified:**
- Sales: `orders`, `kitchen_tickets`
- Products: `products`, `categories`, `modifier_groups`, `bundles`, `promos`, `discounts`
- Customers: `customers`, `vouchers`
- Inventory: `ingredients`, `stock_movements`, `purchase_orders`, `suppliers`, `stock_opname`, `waste_records`, `production_batches`
- Recipes: `recipes`, `sub_recipes`, `sub_recipe_ingredients`
- Staff: `staff`, `shifts`, `schedules`, `attendance`, `staff_submissions`
- Operations: `tables`, `hardware_devices`, `app_settings`, `audit_logs`, `market_prices`, `expenses`, `kas_bon`, `opening_balance`

## Authentication Flow
- **PIN-based authentication** (not OAuth / JWT)
- POS: 4-digit PIN checked against `staff` table (or `STAFF` constant fallback)
- Backoffice: PIN checked against `app_settings.backoffice_pin`
- **No session tokens** — PIN required on each page load
- No rate limiting on failed PIN attempts

## API Architecture
- **No API layer** — all components query Supabase directly
- Supabase JS SDK used inline within component `useEffect` and event handlers
- Real-time: Supabase Realtime channels (postgres_changes)
- No request caching, deduplication, or SWR pattern

## Deployment Configuration
- **Platform**: Cloudflare Pages
- **Build**: `vite build` → `dist/`
- **Deploy**: `wrangler pages deploy dist --project-name=pawonloka`
- **SPA routing**: `public/_redirects` → `/* /index.html 200`
- **PWA**: Manual manifest + service worker (sw.js)
- **CI/CD**: None — fully manual deploy

## Third-Party Dependencies
| Package | Used | Purpose |
|---------|------|---------|
| @supabase/supabase-js | ✅ | Database + realtime |
| react / react-dom | ✅ | UI framework |
| jspdf + jspdf-autotable | ✅ | PDF export (Reports.jsx) |
| xlsx | ✅ | Excel import/export |
| vite-plugin-pwa | ❌ | In devDeps but NOT in vite.config.js |

## Key Metrics
| Metric | Value |
|--------|-------|
| Total source files | 86 |
| Largest file | Accounting.jsx (1,471 lines) |
| Second largest | POS.jsx (991 lines) |
| Empty files | 2 (ReceiptModal.jsx, useShift.js) |
| Test coverage | 0% |
| CI/CD pipelines | 0 |
| TypeScript coverage | 0% |
| Bundle size (uncompressed) | ~2.3 MB JS |
