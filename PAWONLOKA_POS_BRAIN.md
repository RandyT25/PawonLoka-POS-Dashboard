# PawonLoka POS — Deep Reference Brain
> Created: 2026-06-25
> Read this before touching ANYTHING in the POS, usePrinter.js, APK build, or FloorPlan.

---

## 1. DUAL-PROJECT ARCHITECTURE

There are TWO separate projects:

| | Main Web Project | APK Project |
|---|---|---|
| Path | `/Users/randy/PawonLoka-POS-Dashboard` | `/Users/randy/POS Android APK` |
| Deploy | Cloudflare Pages (auto on push) | `~/Desktop/PawonLoka-POS.apk` (manual install) |
| `vite.config.js` | Has `external: ['@capacitor-community/bluetooth-le', '@capacitor/core']` | Plain config — NO external array |
| `index.html` | Complex PWA version with service worker, install banner | Simple version with `body { padding-top: env(safe-area-inset-top) }` for Android 15 EdgeToEdge |
| Capacitor | Not installed | `@capacitor/android`, `@capacitor-community/bluetooth-le` installed |

### ✅ DO sync (copy src/ files after changes):
All files under `src/` can be copied freely between projects.

### ❌ NEVER copy these from main to APK:
- `vite.config.js` — different build configs, copying it breaks the APK with "Failed to resolve module specifier"
- `index.html` — APK needs safe-area CSS; overwriting loses it and the status bar overlaps content
- `package.json` — different dependencies

---

## 2. BLUETOOTH PRINTER SYSTEM

### Architecture
The printer uses a dual-path approach in `src/pos/hooks/usePrinter.js`:

```
isNative() = !!window?.Capacitor?.isNativePlatform?.()
  → true  → BleClient path (native Android BLE via @capacitor-community/bluetooth-le)
  → false → navigator.bluetooth path (Web Bluetooth, works in Chrome browser)
```

### BleClient path (APK)
- Dynamic import: `import('@capacitor-community/bluetooth-le')` — only works when the package is BUNDLED (APK project)
- Call `BleClient.requestPermissions()` BEFORE `BleClient.initialize()` — required for Android location permission
- `nativeGetChar()`: use `BleClient.getServices(deviceId)` to auto-discover characteristics — do NOT hardcode service UUIDs as the only option
- `charRefs.current[id]` stores `{ deviceId, serviceUUID, charUUID, isNative: true }` for native path
- Print write: `BleClient.writeWithoutResponse(deviceId, serviceUUID, charUUID, new DataView(chunk.buffer))`

### Web Bluetooth path (Chrome browser)
- `navigator.bluetooth.requestDevice()` → GATT connect → characteristic write
- `charRefs.current[id]` stores a `BluetoothRemoteGATTCharacteristic` object
- GATT check: `char.service?.device?.gatt?.connected` — use `char?.isNative ? true : ...` to handle both paths

### Printer config storage
- Stored in **Supabase** `hardware_devices` table — NOT localStorage
- This means printer config survives APK reinstalls
- Fields: `name`, `type` (receipt_printer/kitchen_printer), `mac` (device ID), `paper`, `role`

### Android Manifest requirements
```xml
<!-- NO maxSdkVersion on FINE_LOCATION — BleClient checks manifest and fails if restricted -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<!-- Modern Android 12+ Bluetooth -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

### PrinterSettings.jsx btSupported
```js
const btSupported = !!navigator.bluetooth || !!window?.Capacitor?.isNativePlatform?.();
```

### Error history and fixes
| Error | Cause | Fix |
|---|---|---|
| "Web Bluetooth not supported" | `navigator.bluetooth` undefined in WebView | Added isNative() + BleClient path |
| "Missing permissions in AndroidManifest: ACCESS_FINE_LOCATION" | Permission had `maxSdkVersion="30"` — BleClient couldn't find it on all Android versions | Removed maxSdkVersion restriction |
| "No writable characteristic found" | Hardcoded service UUIDs didn't match printer | Use `BleClient.getServices()` to auto-discover all services |
| "Failed to resolve module specifier '@capacitor-community/bluetooth-le'" | `vite.config.js` external[] was copied to APK project | APK vite.config.js must have NO external array |
| BleClient permission error (initialize failed) | `initialize()` called before `requestPermissions()` | Call `requestPermissions()` first |

---

## 3. ORDER IDENTITY — NEVER USE TABLE NAMES

### Rule: Orders must be identified by ORDER ID, not table name.

Tables can have identical names in different areas. Using table names for order queries causes cross-contamination.

### FloorPlan.jsx — handleMerge
```js
// ✅ CORRECT — use open_bill_id
const srcOrder = src.open_bill_id
  ? (await supabase.from('orders').select('*').eq('id', src.open_bill_id).maybeSingle()).data
  : null
const tgtOrder = targetTable.open_bill_id
  ? (await supabase.from('orders').select('*').eq('id', targetTable.open_bill_id).maybeSingle()).data
  : null

// ❌ WRONG — never do this
const { data: srcOrders } = await supabase.from('orders').select('*').eq('table', src.name)...
```

### FloorPlan.jsx — handleMove
```js
// ✅ CORRECT
if (src.open_bill_id) {
  await supabase.from('orders').update({ table: targetTable.name, table_area: targetTable.area||null }).eq('id', src.open_bill_id)
}

// ❌ WRONG
await supabase.from('orders').update({ table: targetTable.name }).eq('table', src.name)...
```

### POS.jsx — TablePicker table status update
```js
// ✅ CORRECT — use primary key
await supabase.from('tables').update({ status: 'Occupied' }).eq('id', t.id)

// ❌ WRONG — all tables with same name get marked occupied
await supabase.from('tables').update({ status: 'Occupied' }).eq('name', t.name)
```

### `open_bill_id` is populated in load()
In `FloorPlan.jsx` `load()`, each table gets `open_bill_id` set from the occupiedMap:
```js
open_bill_id: hit?.id || null  // hit is the matching open order
```
Always refresh via `load()` before doing merge/move operations.

---

## 4. NOTE INPUT RULES

ALL note/text inputs where users type free text MUST have these attributes to prevent RTL text reversal on Android:

```jsx
<input
  dir="ltr"
  autoComplete="off"
  autoCorrect="off"
  autoCapitalize="off"
  spellCheck={false}
  style={{ ..., direction: 'ltr', unicodeBidi: 'plaintext' }}
/>
```

### Files with note inputs that need this:
- `src/pos/components/ModifierModal.jsx` — item note field (line ~42) + `S.noteInput` style
- `src/pos/components/Cart.jsx` — inline note input (line ~144)

Without `direction: 'ltr'` in CSS, Android WebView can render text RTL ("Bungkus" → "sukgnuB").

---

## 5. POINTS & DISCOUNTS

### Points on Receipt
Only print "Points earned" line when a customer is selected:
```js
// src/pos/hooks/usePrinter.js — buildReceiptData
if (showLoyalty && order.customer_id && total > 0) {  // ← customer_id required
  const pts = Math.floor(total / 100);
  if (pts > 0) lines.push({ text: L("Points earned", "+" + pts + " pts") + "\n" });
}
```

### Discount data model
| Field | Stored in | Meaning |
|---|---|---|
| `item.itemDisc` | `orders.items[].itemDisc` | Per-item discount in Rupiah (per unit) |
| `item.itemDiscLabel` | `orders.items[].itemDiscLabel` | Label for per-item discount (e.g. "25%") |
| `order.discount` | `orders.discount` | Order-level discount total in Rupiah |
| `order.promo` | `orders.promo` | Order-level discount name (e.g. "Staff 25%") |

### Receipt discount labels
```js
// Per-item — use itemDiscLabel if saved
L("  " + (item.itemDiscLabel || "Diskon"), "-" + fmt(itemDiscAmt * item.qty))

// Order-level — use promo name
L(order.promo || "Diskon", "-" + fmt(order.discount))
```

### Views that must show per-item discount
- `src/owner/OwnerApp.jsx` — show `itemDisc` under each item + discounted total
- `src/backoffice/components/Orders.jsx` — same
- `src/pos/components/ChargeModal.jsx` — show "Disc -X" badge under discounted item price

---

## 6. APK BUILD CHECKLIST

Run this sequence every time code changes:

```bash
# 1. Sync changed src/ files (never sync vite.config.js or index.html)
cp /Users/randy/PawonLoka-POS-Dashboard/src/pos/hooks/usePrinter.js "/Users/randy/POS Android APK/src/pos/hooks/usePrinter.js"
# ... repeat for each changed file

# 2. Build
cd "/Users/randy/POS Android APK"
npm run build

# 3. Sync to Android
npx cap sync android

# 4. Compile APK
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug

# 5. Deploy to Desktop
cp app/build/outputs/apk/debug/app-debug.apk ~/Desktop/PawonLoka-POS.apk
```

Also push to GitHub for Cloudflare Pages:
```bash
git add -A && git commit -m "msg" && git push
```

---

## 7. WHAT NOT TO DO — MISTAKES MADE 2026-06-24/25

1. **NEVER copy `vite.config.js` from main to APK.** The APK build needs to bundle Capacitor packages; externalizing them causes "Failed to resolve module specifier" at runtime.

2. **NEVER copy `index.html` from main to APK.** The APK's index.html has critical safe-area CSS that prevents the app from drawing under the Android 15 status bar.

3. **NEVER query orders by table name.** Always use `open_bill_id` / order `id`. Table names are not unique across areas — same name in two areas = cross-contamination and data corruption.

4. **NEVER update `tables` status by name.** Use `.eq('id', t.id)`. Updating by name marks all tables with the same name.

5. **NEVER add `maxSdkVersion` restriction to `ACCESS_FINE_LOCATION` in AndroidManifest.xml.** BleClient's native permission check fails to find the permission when it's SDK-limited.

6. **NEVER call `BleClient.initialize()` without calling `BleClient.requestPermissions()` first.** Initialize throws if permissions aren't granted; requestPermissions shows the dialog.

7. **NEVER hardcode service UUIDs as the only way to find printer characteristics.** Use `BleClient.getServices(deviceId)` to auto-discover — the printer model determines its UUIDs.

8. **NEVER print "Points earned" on receipts without checking `order.customer_id`.** Walk-in orders should not show points.

9. **NEVER add note inputs without `dir="ltr"` and `direction: 'ltr'` CSS.** Android WebView renders text RTL without these, producing reversed text.

10. **NEVER deploy only to web (Cloudflare) without also rebuilding the APK.** The APK bundles web files at build time — it doesn't load from the live URL.
