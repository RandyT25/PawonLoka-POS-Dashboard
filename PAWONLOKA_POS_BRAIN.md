# PawonLoka POS — Deep Reference Brain
> Created: 2026-06-25 | Last updated: 2026-06-28
> Read this before touching ANYTHING in the POS, usePrinter.js, APK build, or FloorPlan.

---

## 1. PROJECT ARCHITECTURE (UPDATED 2026-06-28)

**SINGLE PROJECT** at `/Users/randy/PawonLoka-POS-Dashboard`. The old separate `/Users/randy/POS Android APK` project is OBSOLETE — do not use it.

| | Web (Cloudflare) | Android APK |
|---|---|---|
| Same source | ✅ same `src/` | ✅ same `src/` |
| Build command | `npm run build && git push` | `npm run build && npx cap sync android && ./android/gradlew` |
| Output | Auto-deploys to pawonloka.pages.dev | `~/Desktop/PawonLoka-debug.apk` (sideload install) |
| Capacitor | PWA mode (isNativePlatform = false) | Native mode (isNativePlatform = true) |
| Native plugin | — | `PrintBridge` (custom Kotlin, registered via Capacitor 8) |

### Key Android files:
```
android/app/src/main/java/com/pawonloka/pos/
  printing/EscPosBuilder.kt    ← ESC/POS byte sequence builder (ALL print templates)
  PrintBridgePlugin.kt         ← Capacitor plugin bridge (JS → Kotlin)
  MainActivity.kt              ← registers PrintBridge plugin
android/app/src/main/AndroidManifest.xml
capacitor.config.ts            ← at project root
```

### `index.html` is shared (NOT separate):
- Contains `body { padding-top: env(safe-area-inset-top) }` for Android 15 EdgeToEdge
- Also has PWA install banner script (harmless in APK context)
- No separate APK index.html needed anymore

### vite.config.js note:
The main `vite.config.js` has `external: ['@capacitor-community/bluetooth-le', '@capacitor/core']`.
This works for the APK because `@capacitor/core` is now BUNDLED (not external) via the PrintBridge plugin path.
Do NOT remove the external array — it's intentional for the web build.

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

Run this from `/Users/randy/PawonLoka-POS-Dashboard` every time code changes:

```bash
# 1. Build web assets
npm run build

# 2. Sync to Android (copies dist/ into android/ + syncs plugins)
npx cap sync android

# 3. Compile APK (JAVA_HOME required — not in system PATH)
JAVA_HOME=/Users/randy/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.19+10/Contents/Home \
  ./android/gradlew -p ./android assembleDebug

# 4. Copy to Desktop
cp ./android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/PawonLoka-debug.apk
```

Also push to GitHub for Cloudflare Pages:
```bash
git add -A && git commit -m "msg" && git push
```

### If Kotlin/EscPosBuilder.kt changed but src/ did not:
Skip step 1 (npm run build) — go straight to step 3 (gradlew). Kotlin is compiled separately from web assets. Step 2 (cap sync) is only needed if src/ or capacitor.config.ts changed.

---

## 7. ESC/POS PRINT ARCHITECTURE (EscPosBuilder.kt)

### Print functions and when they're called

| JS function | Kotlin builder | Triggered by |
|---|---|---|
| `printKitchenTicket({stationRole:'receipt',...})` | `buildKitchenTicket()` | Cetak Checker (printCheck) + auto-checker on order send |
| `printKitchenTicket({stationRole:'kitchen',...})` | `buildKitchenTicket()` | Kitchen dapur ticket |
| `printPreBill(...)` | `buildPreBill()` | Cetak Tagihan (bill before payment) |
| `printReceipt(...)` | `buildReceipt()` | Cetak Struk (receipt after payment) |
| `printProductSoldReport(...)` | `buildProductSoldReport()` | ShiftModal after shift close |

### Key ESC/POS commands (Cmd enum in EscPosBuilder.kt)
```
BOLD_ON/BOLD_OFF     — bold text
TALL_ON/TALL_OFF     — double-height only (kitchen items; NOT on checker stationRole='receipt')
DOUBLE_ON/DOUBLE_OFF — double-height + double-width (was used for "TAGIHAN" header, now removed)
ALIGN_C / ALIGN_L    — center / left align (reset to ALIGN_L after every centered block)
```

### Data classes (Kotlin)
- `OutletSettings` — name, address, phone, website, tagline, thankYou, wifi, promo, social, customLine1/2, showOrderId, showTable, showCashier, showDatetime, showTax, showService, showLoyalty
- `KitchenSettings` — showOutletName, outletName, showOrderId, showOrderType, showTable, showDatetime, showFooter, footerText

### Helper functions
```kotlin
padLine(left, right, width)   // pads left+right to fit width — wraps if left is too long
truncLine(left, right, width) // same but TRUNCATES left side to fit on single line — always use for items
```

### Checker specifics
- Checker items print at NORMAL height (no TALL_ON): gated by `d.stationRole != "receipt"` in EscPosBuilder.kt
- Footer note on checker: piped from `appSettings.receipt.pre_bill_note` as `footer_text` in JS before calling `printKitchenTicket()`
- Kitchen footer text: always ALIGN_C (centered) + ALIGN_L reset after

### Logo bitmap sizing
- 58mm paper: 200px max width (printable ~48mm @ 203dpi; was 384px, caused slowness)
- 80mm paper: 300px max width (printable ~72mm @ 203dpi; was 576px)

### Settings wiring (JS → Kotlin)
```js
// In printBill() / handleReprint() — outlet object must have ALL fields:
const outlet = {
  name, address, phone, website, tagline,
  showOrderId, showTable, showCashier, showDatetime,
  // also: thankYou, wifi, promo, social, customLine1/2 (read from appSettings.outlet)
}

// In printCheck() — kitchen settings + footer from receipt designer:
await printer.printKitchenTicket({
  stationRole: 'receipt',
  settings: {
    ...kt,  // appSettings.kitchen_ticket
    show_footer: !!(footerNote || kt.show_footer),
    footer_text: footerNote || kt.footer_text || '',
    // show_modifiers + show_note applied in JS before building item strings
  }
})
```

---

## 8. WHAT NOT TO DO — MISTAKES MADE 2026-06-24/28

1. **NEVER use the old separate `/Users/randy/POS Android APK` project.** It is obsolete. All work is in `/Users/randy/PawonLoka-POS-Dashboard` with `android/` as a subfolder (Capacitor 8).

2. **NEVER run Gradle as `cd android && ./gradlew`.** Run from project root: `./android/gradlew -p ./android assembleDebug`. The subshell cd approach fails with "No such file or directory".

3. **NEVER run Gradle without JAVA_HOME set.** Java is not in the system PATH for Gradle. Always prefix: `JAVA_HOME=/Users/randy/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.19+10/Contents/Home`.

4. **NEVER query orders by table name.** Always use `open_bill_id` / order `id`. Table names are not unique across areas — same name in two areas = cross-contamination and data corruption.

5. **NEVER update `tables` status by name.** Use `.eq('id', t.id)`. Updating by name marks all tables with the same name.

6. **NEVER add `maxSdkVersion` restriction to `ACCESS_FINE_LOCATION` in AndroidManifest.xml.** BleClient's native permission check fails to find the permission when it's SDK-limited.

7. **NEVER call `BleClient.initialize()` without calling `BleClient.requestPermissions()` first.** Initialize throws if permissions aren't granted; requestPermissions shows the dialog.

8. **NEVER hardcode service UUIDs as the only way to find printer characteristics.** Use `BleClient.getServices(deviceId)` to auto-discover — the printer model determines its UUIDs.

9. **NEVER print "Points earned" on receipts without checking `order.customer_id`.** Walk-in orders should not show points.

10. **NEVER add note inputs without `dir="ltr"` and `direction: 'ltr'` CSS.** Android WebView renders text RTL without these, producing reversed text.

11. **NEVER deploy only to web (Cloudflare) without also rebuilding the APK.** The APK bundles web files at build time — it doesn't load from the live URL.

12. **NEVER use `padLine()` for item lines in EscPosBuilder.kt.** Use `truncLine()` — `padLine` wraps long names to a second line which breaks receipt formatting. `truncLine` cuts the left side to fit on one line.

13. **NEVER pass only 3 fields in `printBill()` outlet object.** The receipt designer has ~20 settings (name, address, phone, website, tagline, showOrderId, showTable, showCashier, showDatetime, etc.) — all must be wired through.

14. **NEVER assume checker print uses receipt settings.** `printCheck()` calls `printKitchenTicket()` with `stationRole='receipt'`. Kitchen ticket settings apply; only `pre_bill_note` from receipt designer pipes in as the footer.
