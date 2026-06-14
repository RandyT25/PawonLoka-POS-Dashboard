# DEPENDENCY REPORT

---

## Production Dependencies

| Package | Version | Used | Action | Notes |
|---------|---------|------|--------|-------|
| `@supabase/supabase-js` | ^2.105.4 | ✅ Yes | Keep | Core backend |
| `react` | ^19.2.6 | ✅ Yes | Keep | Latest stable |
| `react-dom` | ^19.2.6 | ✅ Yes | Keep | Latest stable |
| `jspdf` | ^4.2.1 | ✅ Yes | Keep | PDF export in Reports.jsx |
| `jspdf-autotable` | ^5.0.8 | ✅ Yes | Keep | Table formatting in PDF |
| `xlsx` | ^0.18.5 | ✅ Yes | Keep | Excel import/export (3 files) |

**No unused production dependencies found.**

Note: `xlsx` (SheetJS) v0.18.5 has known CVEs. The Community Edition (CE) stopped receiving updates; consider `xlsx@^0.20.x` or switching to `exceljs` for active maintenance.

---

## Dev Dependencies

| Package | Version | Used | Action | Notes |
|---------|---------|------|--------|-------|
| `@eslint/js` | ^10.0.1 | ✅ Yes | Keep | ESLint base rules |
| `@types/react` | ^19.2.14 | ✅ Yes | Keep | Type hints in IDE |
| `@types/react-dom` | ^19.2.3 | ✅ Yes | Keep | Type hints in IDE |
| `@vitejs/plugin-react` | ^6.0.1 | ✅ Yes | Keep | Vite React transform |
| `eslint` | ^10.3.0 | ✅ Yes | Keep | Code linting |
| `eslint-plugin-react-hooks` | ^7.1.1 | ✅ Yes | Keep | Hook rules |
| `eslint-plugin-react-refresh` | ^0.5.2 | ✅ Yes | Keep | HMR safety |
| `globals` | ^17.6.0 | ✅ Yes | Keep | ESLint env globals |
| `vite` | ^8.0.12 | ✅ Yes | Keep | Build tool |
| `vite-plugin-pwa` | ^1.3.0 | ❌ **No** | **Remove** | Installed but never added to vite.config.js |

---

## Recommended Actions

### Remove
```bash
npm uninstall vite-plugin-pwa
```
Estimated bundle saving: ~0KB (dev only, but removes confusion)

### Upgrade (Security)
```bash
npm install xlsx@^0.20.2
```
Addresses known CVEs in xlsx v0.18.x.

### Consider Adding
| Package | Purpose | Priority |
|---------|---------|---------|
| `@tanstack/react-query` | Replace inline Supabase calls with caching/dedup | Medium |
| `zod` | Runtime validation of form inputs | Low |

---

## Bundle Size Analysis

Current production bundle (Vite output):
```
dist/assets/index.es-*.js        151KB gzip: 49KB   (vendor: supabase, etc.)
dist/assets/index-*.js         1,927KB gzip: 528KB  (ALL app code in one chunk)
dist/assets/purify.es-*.js        24KB gzip:  9KB
dist/assets/html2canvas-*.js     200KB gzip: 47KB
```

**Main bundle is 1.93MB unminified / 528KB gzip.** This is large because all 36 backoffice components + POS + Staff Portal are in a single chunk.

With React.lazy() code splitting, the initial load could be reduced to ~300KB gzip (POS only), with backoffice components loading on demand.
