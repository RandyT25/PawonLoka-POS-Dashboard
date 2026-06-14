# ERROR REPORT
> Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL — Runtime Crashes

### ERR-001: `saveOrder` is called but never defined
- **File**: `src/pos/POS.jsx:118` and `src/pos/POS.jsx:532`
- **Severity**: Critical
- **Description**: `POS.jsx` destructures `{ saveOrder, lastOrder, setLastOrder, saving }` from `useOrders()`, but `useOrders` only returns `{ orders, loading, refreshOrders, getOrdersByStatus }`. All four variables are `undefined`. When a cashier presses Charge **without** first pressing Send Order (quick cash sale flow), line 532 calls `saveOrder({...})` which throws `TypeError: saveOrder is not a function`.
- **Current code**:
  ```js
  // useOrders.js returns:
  return { orders, loading, refreshOrders, getOrdersByStatus }
  
  // POS.jsx line 118 destructures non-existent:
  const { saveOrder, lastOrder, setLastOrder, saving } = useOrders()
  
  // POS.jsx line 532 crashes:
  const order = await saveOrder({ cart, subtotal, ... })
  ```
- **Fix**: Implement `saveOrder` in `useOrders.js` OR inline the Supabase insert in `handleCharge`.

---

### ERR-002: `setHeldBills` called but state never declared
- **File**: `src/pos/POS.jsx:262`
- **Severity**: Critical
- **Description**: `deleteBill(idx)` calls `setHeldBills(...)` but there is no `const [heldBills, setHeldBills] = useState([])` anywhere in POS.jsx. Calling `deleteBill` throws `TypeError: setHeldBills is not a function`.
- **Fix**: Add `const [heldBills, setHeldBills] = useState([])` to POS.jsx state declarations.

---

## 🟠 HIGH — Logic Errors / Data Integrity

### ERR-003: Hardcoded Manager PIN in production
- **File**: `src/pos/POS.jsx:426`
- **Severity**: High
- **Description**: The void/remove PIN is hardcoded as `'9999'` — not loaded from settings.
  ```js
  if (pin !== '9999') { alert('PIN salah'); return }
  ```
- **Fix**: Load manager PIN from `app_settings` like the backoffice PIN.

### ERR-004: N+1 query in `deductStock`
- **File**: `src/pos/POS.jsx:153-173`
- **Severity**: High
- **Description**: For each item, fetches recipe rows one-by-one, then fetches each ingredient one-by-one, then updates each one-by-one. For a 5-item order with 3 ingredients each = 35 sequential Supabase roundtrips.
  ```js
  for (const item of items) {
    const { data: recipeRows } = await supabase.from('recipes')...  // 1 query per item
    for (const ri of recipeRows) {
      const { data: ing } = await supabase.from('ingredients')...   // 1 query per ingredient
      await supabase.from('ingredients').update(...)                 // 1 update per ingredient
    }
  }
  ```
- **Fix**: Batch with `Promise.all`, or use a single RPC call.

### ERR-005: `KT-` ID collision on rapid orders
- **File**: `src/pos/POS.jsx:360`, `src/pos/components/OrdersModal.jsx:179`
- **Severity**: High
- **Description**: Kitchen ticket IDs use `'KT-' + Date.now() + '-' + station`. Multiple stations in the same `for` loop share the same `Date.now()` value, creating duplicate primary keys.
- **Fix**: Use `crypto.randomUUID()` or add a random suffix.

### ERR-006: Tax calculation uses stale 10% constant
- **File**: `src/pos/POS.jsx:203`, `src/pos/components/VoidModal.jsx`
- **Severity**: Medium
- **Description**: Lines 203-204 compute `const tax = Math.round(subtotal * TAX_RATE_LIVE)` correctly, but line 434 in `handleManagerRemoveItem` hardcodes `* 0.1` instead of using `TAX_RATE_LIVE`.
  ```js
  const tx = Math.round((sub-discA)*0.1)  // WRONG — should use TAX_RATE_LIVE
  ```

---

## 🟡 MEDIUM — Promise / Async Issues

### ERR-007: `restoreShift` `.single()` throws on no rows
- **File**: `src/pos/POS.jsx:136-144`
- **Severity**: Medium
- **Description**: `supabase.from('shifts')...single()` throws a PostgREST error when no shift exists (returns 406). Should use `.maybeSingle()`.

### ERR-008: Missing error handling on Supabase inserts in `handleSendOrder`
- **File**: `src/pos/POS.jsx:337-366`
- **Severity**: Medium
- **Description**: `await supabase.from('orders').insert(order)` — no error check. If insert fails (network, constraint violation), the app silently shows "Order sent" while no record exists.

### ERR-009: `buildReceiptData` imported but not used in POS.jsx
- **File**: `src/pos/POS.jsx:22`
- **Severity**: Low
- **Description**:
  ```js
  import { usePrinter, buildReceiptData } from './hooks/usePrinter'
  ```
  `buildReceiptData` is never called in POS.jsx (it's used internally by usePrinter). Dead import.

---

## 🟢 LOW — Code Warnings

### ERR-010: `printDebug` state set but never rendered
- **File**: `src/pos/POS.jsx:29,70`
- **Severity**: Low
- **Description**: Debug state is accumulated but never displayed anywhere. Dead code left over from development.

### ERR-011: Empty hook file
- **File**: `src/pos/hooks/useShift.js` (0 lines)
- **Severity**: Low
- **Description**: File exists but is empty. Not imported anywhere.

### ERR-012: Empty component file
- **File**: `src/pos/components/ReceiptModal.jsx` (0 lines)
- **Severity**: Low
- **Description**: File exists but is completely empty. Not imported anywhere.

### ERR-013: `vite-plugin-pwa` in devDependencies but not configured
- **File**: `package.json:31`, `vite.config.js`
- **Severity**: Low
- **Description**: Package is installed but never added to `vite.config.js`. PWA is handled manually via sw.js.
