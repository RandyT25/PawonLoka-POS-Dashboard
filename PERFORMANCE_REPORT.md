# PERFORMANCE REPORT
> Impact: 🔴 Severe | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 SEVERE

### PERF-001: 853KB SVG favicon loaded on every page
- **File**: `public/favicon.svg` (853KB), `public/icons.svg` (853KB)
- **Impact**: Adds 1.7MB to initial page load. SVG files that large as favicons are extreme.
- **Fix**: Replace with a simple SVG (<1KB) or 32×32 PNG (<5KB). A favicon does not need to be a full illustration.
- **Estimated savings**: 1.7MB

### PERF-002: All 36 backoffice components loaded eagerly
- **File**: `src/backoffice/Backoffice.jsx:12-44`
- **Impact**: Every backoffice component (Accounting 1471 lines, Products 591 lines, InvPO 797 lines, etc.) is statically imported. The initial JS bundle includes ALL 36 modules even if the user only visits Dashboard.
- **Current bundle**: ~1.93MB (unminified)
- **Fix**: Use `React.lazy()` + `<Suspense>` for every backoffice tab component. Only the visible tab's code is loaded.
  ```js
  const Accounting = lazy(() => import('./components/Accounting'))
  // Usage:
  <Suspense fallback={<div>Loading...</div>}>
    <Accounting />
  </Suspense>
  ```
- **Estimated savings**: 60-70% of backoffice module size on initial load

### PERF-003: N+1 Supabase queries in `deductStock`
- **File**: `src/pos/POS.jsx:153-173`
- **Impact**: For a 5-item order with 3 ingredients each = 35 sequential network roundtrips per order close. With 100ms Supabase latency each = 3.5 seconds of blocking work after every payment.
- **Fix**: Batch fetches with `Promise.all`, or use a single Supabase RPC.

---

## 🟠 HIGH

### PERF-004: Logo fetched from URL on every receipt print
- **File**: `src/pos/hooks/usePrinter.js`
- **Status**: ✅ FIXED — `logoCache` added in recent session. First print still fetches.
- **Remaining issue**: Logo is not prefetched on app load, so the first print after opening the app still has network latency.
- **Fix**: Call `logoToEscpos(outlet.logo, paperSize)` in a `useEffect` when `appSettings` loads.

### PERF-005: POS.jsx is a 991-line god component
- **File**: `src/pos/POS.jsx`
- **Impact**: Any state change (cart update, modal toggle, etc.) re-renders the entire 991-line component and all its children. No `React.memo` or `useMemo` anywhere.
- **Fix**: Extract modal state + handlers into smaller components. Memoize stable callbacks with `useCallback`.

### PERF-006: Accounting.jsx is 1,471 lines with inline Supabase queries
- **File**: `src/backoffice/components/Accounting.jsx`
- **Impact**: Largest file in codebase. Loads entirely even if user never opens Accounting. Multiple `useEffect` hooks each running independent queries.
- **Fix**: Split into sub-components (P&L, Expenses, KasBon, Closing). Apply lazy loading.

### PERF-007: 475KB logo.png in /public
- **File**: `public/logo.png`
- **Impact**: PWA icon + receipt logo — loaded on install. 475KB PNG is ~10x larger than needed.
- **Fix**: Compress with pngquant or convert to WebP. Target <50KB.

---

## 🟡 MEDIUM

### PERF-008: No memoization on expensive derived values
- **Files**: POS.jsx, Cart.jsx
- **Impact**: `subtotal`, `total`, category filtering, product filtering all recompute on every render.
- **Fix**: Wrap in `useMemo`.

### PERF-009: Multiple independent Supabase subscriptions
- **Files**: POS.jsx, OrdersModal.jsx, Backoffice.jsx
- **Impact**: Each component creates its own realtime channel. With POS + OrdersModal open simultaneously = duplicate subscriptions to the same table.
- **Fix**: Lift subscriptions to a shared context or deduplicate channel names.

### PERF-010: 485KB hero.png in /src/assets (included in bundle)
- **File**: `src/assets/hero.png`
- **Impact**: Assets in `src/assets/` get processed by Vite and potentially inlined or hashed into the bundle. A 485KB image has no place in the JS bundle.
- **Fix**: Move to `public/` and reference via URL, or delete if unused.

### PERF-011: No image lazy loading
- **Files**: Various backoffice components with product images
- **Impact**: Product images load eagerly even when off-screen.
- **Fix**: Add `loading="lazy"` attribute to all `<img>` tags.

---

## 🟢 LOW

### PERF-012: `useEffect` dependency arrays missing items
- **Files**: Multiple components
- **Impact**: Either stale closures (missing deps) or infinite re-render loops (object deps).
- **Fix**: Run eslint-plugin-react-hooks exhaustive-deps rule.

### PERF-013: Kitchen tickets insert one-by-one in a for loop
- **File**: `src/pos/POS.jsx:359-367`
- **Impact**: 3 stations = 3 sequential inserts instead of one batch insert.
  ```js
  // Current: sequential
  for (const [station, items] of Object.entries(stations)) {
    await supabase.from('kitchen_tickets').insert({...})
  }
  // Better: parallel
  await Promise.all(Object.entries(stations).map(([station, items]) =>
    supabase.from('kitchen_tickets').insert({...})
  ))
  ```
