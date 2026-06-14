# REFACTOR PLAN
> Priority order: A (Critical) → B (Performance) → C (Architecture) → D (Cleanup)

---

## Phase A — Critical Fixes (Do Now)

| # | Task | Difficulty | Risk | Impact | Files |
|---|------|-----------|------|--------|-------|
| A1 | Fix `saveOrder` crash — implement missing function | Low | Low | 🔴 Critical | POS.jsx, useOrders.js |
| A2 | Fix `setHeldBills` — add missing useState declaration | Low | Low | 🔴 Critical | POS.jsx |
| A3 | Fix kitchen ticket ID collision — use randomUUID | Low | Low | 🟠 High | POS.jsx, OrdersModal.jsx |
| A4 | Fix `deductStock` N+1 — batch queries | Medium | Low | 🟠 High | POS.jsx |
| A5 | Fix `.single()` → `.maybeSingle()` in restoreShift | Low | Low | 🟡 Medium | POS.jsx |
| A6 | Fix hardcoded `0.1` tax in removeItem | Low | Low | 🟡 Medium | POS.jsx |
| A7 | Move Supabase keys to env vars | Low | Low | 🔴 Security | supabase.js |
| A8 | Parallelize kitchen ticket inserts | Low | Low | 🟡 Medium | POS.jsx |

---

## Phase B — Performance (High Impact)

| # | Task | Difficulty | Risk | Impact | Files |
|---|------|-----------|------|--------|-------|
| B1 | Lazy load all 36 backoffice components | Low | Low | 🔴 ~60% bundle reduction | Backoffice.jsx |
| B2 | Replace 853KB SVG favicons | Low | Low | 🔴 1.7MB savings | public/favicon.svg, icons.svg |
| B3 | Compress logo.png 475KB → <50KB | Low | Low | 🟠 High | public/logo.png |
| B4 | Remove unused vite-plugin-pwa | Low | None | 🟢 Cleanup | package.json |
| B5 | Prefetch logo bytes on settings load | Low | Low | 🟡 Medium | POS.jsx, usePrinter.js |
| B6 | Parallelize kitchen ticket prints | Low | Low | 🟡 Already done | POS.jsx |

---

## Phase C — Architecture (Medium Term)

| # | Task | Difficulty | Risk | Impact | Files |
|---|------|-----------|------|--------|-------|
| C1 | Split POS.jsx (991L) into logical sections | High | Medium | Maintainability | POS.jsx |
| C2 | Split Accounting.jsx (1471L) into sub-components | High | Medium | Maintainability | Accounting.jsx |
| C3 | Create shared data layer (supabase queries out of components) | High | Medium | Testability | All components |
| C4 | Add PIN rate limiting (5 attempts → 30s lockout) | Low | Low | Security | PinLogin.jsx |
| C5 | Load manager PIN from app_settings | Low | Low | Security | POS.jsx |

---

## Phase D — Cleanup (Low Risk)

| # | Task | Difficulty | Risk | Impact | Files |
|---|------|-----------|------|--------|-------|
| D1 | Delete empty files (ReceiptModal, useShift) | None | None | Clarity | 2 files |
| D2 | Delete orphaned Recipes.jsx | None | None | Clarity | Recipes.jsx |
| D3 | Delete seed scripts from src/ | None | None | Bundle | seed.js, seedIngredients.js, ingredients_seed.json |
| D4 | Delete Vite template artifacts (App.css, react.svg, vite.svg, hero.png) | None | None | Clarity | 4 files |
| D5 | Remove unused imports in POS.jsx | None | None | Clarity | POS.jsx |
| D6 | Remove `printDebug` dead state | None | None | Clarity | POS.jsx |
| D7 | Remove legacy filelist.txt, structure.txt | None | None | Clarity | root |
