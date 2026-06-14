# SECURITY REPORT
> Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL

### SEC-001: Supabase credentials hardcoded in source
- **File**: `src/lib/supabase.js:3-4`
- **Risk**: Anyone who views the page source, inspects the JS bundle, or reads the git history can extract the project URL and anon key.
- **Reality check**: The anon key is **designed to be public** for client-side Supabase apps — Supabase's security model uses Row Level Security (RLS) to control what the anon key can do. However, hardcoding means the key is committed to git forever and cannot be rotated without a code deploy.
- **Fix**: Move to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. This allows key rotation without a code change.
  ```js
  // src/lib/supabase.js
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  ```

### SEC-002: Staff PINs hardcoded in source as plaintext
- **File**: `src/shared/constants.js:1-9`
- **Risk**: All 7 staff PINs (including Owner PIN `7777`) are committed in plaintext to git. Anyone with repo access knows every staff member's PIN.
- **Fix**: PINs are also stored in the Supabase `staff` table. Remove from `constants.js` — use only the DB. Add server-side PIN hashing (bcrypt via edge function) for the future.

### SEC-003: Manager override PIN hardcoded as `9999`
- **File**: `src/pos/POS.jsx:426`
- **Risk**: Universal void/remove PIN hardcoded. If leaked, anyone can void items without manager presence.
  ```js
  if (pin !== '9999') { alert('PIN salah'); return }
  ```
- **Fix**: Load from `app_settings.manager_pin`. Hash and compare server-side.

---

## 🟠 HIGH

### SEC-004: No rate limiting on PIN login attempts
- **File**: `src/pos/components/PinLogin.jsx`
- **Risk**: Brute force — 4-digit PIN has 10,000 combinations. No lockout after failed attempts.
- **Fix**: Add a counter in `useState`. After 5 wrong attempts, lock out for 30 seconds.

### SEC-005: No RLS verification documented
- **Database**: Supabase tables
- **Risk**: The app relies on Row Level Security for data isolation. SQL file `fix_rls_security.sql` exists but it's unclear which tables have RLS enabled and what policies protect them.
- **Fix**: Audit all 22+ tables for RLS policies. Ensure `orders`, `customers`, `staff`, `kas_bon`, `expenses` have appropriate policies.

### SEC-006: `document.write()` in index.html
- **File**: `index.html:29`
- **Risk**: Using `document.write()` for dynamic content is a CSP violation target and deprecated practice.
  ```js
  document.write('<link rel="manifest" href="' + manifest + '" />')
  ```
- **Fix**: Use `document.createElement('link')` pattern already used on the next line for meta.

---

## 🟡 MEDIUM

### SEC-007: No Content Security Policy header
- **File**: `public/_headers`
- **Risk**: No CSP defined. XSS attacks have no fallback protection layer.
- **Fix**: Add CSP header to `_headers` limiting script/style sources.

### SEC-008: `dangerouslySetInnerHTML` / XSS risk check
- **Status**: Not found in current codebase — good.

### SEC-009: WhatsApp message contains order data in URL
- **File**: `src/pos/hooks/useWhatsApp.js`
- **Risk**: Order details passed as URL query params to wa.me. Logged by referrer headers.
- **Risk level**: Low for this use case (WhatsApp link is intentional).

---

## 🟢 LOW

### SEC-010: Backoffice accessible without network auth
- **File**: `src/backoffice/Backoffice.jsx`
- **Risk**: Backoffice PIN checked client-side only. Modifying JS in DevTools bypasses it.
- **Mitigation**: Supabase RLS is the actual security layer. Client PIN is UX, not security.
- **Note**: Acceptable for a restaurant intranet tool.

### SEC-011: `--commit-dirty` in deploy script
- **File**: `package.json:11`
- **Risk**: Allows deploying with uncommitted changes, making git history diverge from what's live.
- **Fix**: Remove `--commit-dirty` flag. Require clean git state before deploy.
