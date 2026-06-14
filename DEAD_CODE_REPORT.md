# DEAD CODE REPORT
> Categories: ✅ Safe to Delete | ⚠️ Review Before Delete | 🔒 Cannot Delete

---

## ✅ SAFE TO DELETE

### Files
| File | Lines | Reason |
|------|-------|--------|
| `src/pos/components/ReceiptModal.jsx` | 0 | Empty file, no imports anywhere |
| `src/pos/hooks/useShift.js` | 0 | Empty file, no imports anywhere |
| `src/App.css` | 185 | Vite template styles, nothing in the app uses these classes |
| `src/assets/react.svg` | — | Vite template asset, not used |
| `src/assets/vite.svg` | — | Vite template asset, not used |
| `src/assets/hero.png` | 485KB | Not referenced in any source file |
| `filelist.txt` | — | Legacy dev file in root |
| `structure.txt` | — | Legacy dev file in root |
| `src/lib/seedIngredients.js` | 42 | One-time seed script, served to all users |
| `src/lib/seed.js` | 22 | One-time seed script, served to all users |
| `src/lib/ingredients_seed.json` | — | Data for seed script, 48KB in bundle |

### Unused Code in Files
| File | Symbol | Lines | Reason |
|------|--------|-------|--------|
| `src/pos/POS.jsx` | `buildReceiptData` import | 22 | Imported, never called |
| `src/pos/POS.jsx` | `lastOrder`, `setLastOrder`, `saving` | 118 | Destructured from hook that doesn't export them |
| `src/pos/POS.jsx` | `printDebug`, `setPrintDebug`, `dbg()` | 29,70 | State set, function defined, never rendered |
| `src/pos/POS.jsx` | `showReceipt`, `setShowReceipt` | 103 | State declared, never used after ReceiptModal was removed |
| `src/shared/constants.js` | `TAX_RATE` export | 44 | Superseded by live `appSettings.payments.tax.rate` |

---

## ⚠️ REVIEW BEFORE DELETE

### Files
| File | Lines | Reason |
|------|-------|--------|
| `src/backoffice/components/Recipes.jsx` | 368 | NOT imported anywhere — `Backoffice.jsx:16` imports `RecipeEditor.jsx` aliased as `Recipes`. This file is orphaned. Verify it has no unique logic before deleting. |

### Code
| File | Symbol | Reason |
|------|--------|--------|
| `src/pos/POS.jsx` | `saveOrder` destructure | The hook doesn't export it, but line 532 calls it — review that code path before removing |
| `src/shared/constants.js` | `MODIFIERS` export | Modifiers are now managed via DB (`modifier_groups` table) — verify constants fallback is still needed |
| `src/shared/constants.js` | `STAFF` export | Staff now loaded from `staff` table — verify PIN fallback is still needed if DB is down |

---

## 🔒 CANNOT DELETE

| File | Reason |
|------|--------|
| `public/sw.js` | Active service worker — offline PWA depends on it |
| `public/_redirects` | SPA routing on Cloudflare Pages breaks without this |
| `public/_headers` | Security headers |
| `public/manifest*.json` | PWA install requires these |
| `src/lib/supabase.js` | Imported by every module |
| `src/shared/constants.js` | KITCHEN_STATIONS and fmt() used widely |
