## 2026-05-05 — code-review (staged): clean (sentinel-only change)

---

## 2026-05-05 — code-review (staged)

### [Medium] Fragment without key in rows.map()
- **File**: `src/components/SuperAdminDashboard/index.jsx` (BulkModuleTab rows render)
- **Issue**: `<>` shorthand fragments can't carry a `key` prop; React will log "Each child in a list should have a unique key" warnings in the console
- **Suggested fix**: Replace `<>` with `<React.Fragment key={row.id}>`
- **Status**: Open

### [Low] handleCancelRow silently swallows errors
- **File**: `src/components/SuperAdminDashboard/index.jsx` (handleCancelRow)
- **Issue**: `catch { /* row stays as-is */ }` gives the user no feedback when a row cancel fails
- **Suggested fix**: Add per-row error state similar to `resendStatus`, show inline error on failure
- **Status**: Open

---

## 2026-05-04 — code-review (staged): playwright tests + vite base + deploy command

### [Medium] Generated test artifacts committed to source control
- **File**: `playwright-report/` and `test-results/` directories
- **Issue**: These are generated output files (screenshots, webm videos, trace zips, HTML reports). Committing them bloats the repo with binary data and they'll be regenerated on every test run. They belong in `.gitignore`.
- **Suggested fix**: Add `playwright-report/` and `test-results/` to `.gitignore`, then unstage them.
- **Status**: Open

### [Low] playwright.config.js: headless: false committed
- **File**: `playwright.config.js:13`
- **Issue**: `headless: false` opens a real browser window during tests. Fine locally, but breaks CI environments. Should be `headless: true` or conditionally `!process.env.CI`.
- **Suggested fix**: Change to `headless: !process.env.CI` so local runs show the browser but CI runs headlessly.
- **Status**: Open

## 2026-05-04 — code-review (staged): bulk-upload + cms-users + verify pipeline

### [Medium] ConsumerUserModuleTab: search debounce timeout not cleared on unmount
- **File**: src/components/SuperAdminDashboard/index.jsx (ConsumerUserModuleTab)
- **Issue**: `searchTimeout.current` is set via `setTimeout` in `handleSearchChange` but never cleared when the component unmounts. If the tab is switched mid-debounce, the callback fires on an unmounted component and calls `setPage` + `loadUsers`, which may log React setState-on-unmounted warnings.
- **Suggested fix**: Add `useEffect(() => () => clearTimeout(searchTimeout.current), []);` inside ConsumerUserModuleTab.
- **Status**: Fixed in this commit

### [Low] bulkService.resendInvite returns full envelope instead of payload
- **File**: src/services/bulkService.js:37
- **Issue**: Returns `res.data` while every other function in the file returns `res.data.data`. No current caller uses the return value, but it is inconsistent and will silently give callers the wrong shape if they start consuming it.
- **Suggested fix**: Change `return res.data;` → `return res.data.data;`
- **Status**: Fixed in this commit

### [Low] verifyService.sendOtp discards response data
- **File**: src/services/verifyService.js:4
- **Issue**: `await AxiosUtils.post(...)` result is discarded. The spec says the response includes `{ sent: true, expiresInSeconds: 600 }` which could be used to show an OTP expiry countdown. Not breaking now since VerifyPortal ignores the return value, but a missed future capability.
- **Suggested fix**: `const res = await ...; return res.data?.data;`
- **Status**: Fixed in this commit

## 2026-05-04 — code-review: recently changed + new files (12 files)

### [High] VerifyPortal calls AxiosUtils directly — violates service-layer convention
- **File**: src/components/VerifyPortal/index.jsx:49, 71
- **Issue**: `AxiosUtils.post(...)` is called directly from the component. CLAUDE.md states "All API calls go through src/services/*.js — never call AxiosUtils directly from components". Bypasses any future service-layer changes (error mapping, auth wrappers, etc.).
- **Suggested fix**: Create `src/services/verifyService.js` with `sendOtp(token)` and `confirmOtp(token, otp)`, then import and call those in the component.
- **Status**: Fixed (created verifyService.js; VerifyPortal now imports from it)

### [Medium] AppContext.login() never sets X-ORG-ID header
- **File**: src/context/AppContext.jsx:120-132
- **Issue**: `login()` calls `setActiveOrgState(activeOrg)` (React state) but never calls `setActiveOrg(org.id)` from AxiosUtils. Any component using the legacy `login()` path ends up with the org in local state but the `X-ORG-ID` header missing, causing subsequent API calls to return `INVALID_ORG_CONTEXT`. (The primary Redux path via `setSessionFromApi` is unaffected.)
- **Suggested fix**: Add `if (activeOrg) setActiveOrg(activeOrg.id);` before `setActiveOrgState(activeOrg)` inside `login()`.
- **Status**: Open

### [Medium] OrgModuleTab.handleSave swallows dispatch errors silently
- **File**: src/components/SuperAdminDashboard/index.jsx:104-119
- **Issue**: `handleSave` awaits `dispatch(apiUpdateOrg(...))` and `dispatch(apiSuspendOrg(...))` but never checks the results. On API failure the edit panel is silently closed and `editSaving` is reset — the user gets no error feedback and doesn't know the save failed.
- **Suggested fix**: Check `apiUpdateOrg.rejected.match(res)` and `apiSuspendOrg.rejected.match(res)` and surface the error before calling `closePanel()`.
- **Status**: Open

### [Medium] UserModuleTab.handleRevoke has no error handling
- **File**: src/components/SuperAdminDashboard/index.jsx:534-536
- **Issue**: `handleRevoke` dispatches `apiRevokeRole` but doesn't check or display errors. A network error or permission failure silently does nothing — the role chip stays visible and the user has no way to know the revoke failed.
- **Suggested fix**: Check `apiRevokeRole.rejected.match(res)` and set `assignErr` or a similar state to surface the message.
- **Status**: Open

### [Medium] ConsumerUserModuleTab.loadUsers silently swallows errors
- **File**: src/components/SuperAdminDashboard/index.jsx:1722-1731
- **Issue**: The `catch` block in `loadUsers` is empty (`/* silently ignored */`). When the API call fails, `users` stays empty and `loading` goes false, leaving the user staring at an empty "No members found" state with no explanation.
- **Suggested fix**: Set an error state in the catch and render an error banner, similar to the pattern used in `OrgModuleTab`.
- **Status**: Open

### [Medium] bulkService.resendInvite returns res.data instead of res.data.data
- **File**: src/services/bulkService.js:40
- **Issue**: `resendInvite` returns `res.data` while every other function in the file returns `res.data.data`. Any future caller that uses the return value gets the full envelope object (`{ success, data, ... }`) instead of the payload. The current component doesn't use the return value, so it doesn't break now — but it's a latent inconsistency.
- **Suggested fix**: Change `return res.data;` to `return res.data.data;` to match every other service function.
- **Status**: Open

### [Low] OrgModuleTab delete fires immediately with no confirmation
- **File**: src/components/SuperAdminDashboard/index.jsx:135-139
- **Issue**: Clicking "Delete" on an org immediately dispatches `apiDeleteOrg` with no confirmation dialog. UserModuleTab has a confirmation modal for the equivalent action. Accidental org deletion can't be undone.
- **Suggested fix**: Add a confirmation modal (or `window.confirm`) before dispatching, consistent with `UserModuleTab`'s `setConfirmAction` pattern.
- **Status**: Open

### [Low] N+1 fetchUserRoles pattern fires on mount
- **File**: src/components/SuperAdminDashboard/index.jsx:474-478, 925-928
- **Issue**: Both `UserModuleTab` and `RoleModuleTab` dispatch `fetchUserRoles(u.id)` for every user returned by `fetchUsers`. With 20 users this is 20 concurrent GET requests on mount. There is no deduplication or batch endpoint used.
- **Suggested fix**: Either fetch user-role data lazily (only when a row is expanded), or use a single batch endpoint if the backend supports it.
- **Status**: Open

### [Low] RoleModuleTab.handleDelete redundantly re-fetches roles from API
- **File**: src/components/SuperAdminDashboard/index.jsx:974-983
- **Issue**: `handleDelete` calls `roleService.listRoles()` to check if the role exists and is not a system role, even though `roles` from the Redux selector is already loaded and up-to-date. This makes an extra GET /roles call that is unnecessary.
- **Suggested fix**: Use `roles.find(r => r.id === roleId)` (the Redux state) instead of the API call.
- **Status**: Open

---

## 2026-04-29 — code-review: session-changed files (8 files)

### [Medium] Form fields cleared on createOrg failure — user loses input
- **File**: src/components/SuperAdminDashboard/index.jsx:116-118
- **Issue**: `setName(""); setSlug(""); setErrors({})` runs unconditionally after `apiCreateOrg` regardless of whether it succeeded or failed. User loses typed values on API error.
- **Suggested fix**: Wrap the clear in `if (apiCreateOrg.fulfilled.match(res))` before clearing
- **Status**: Fixed (guarded clear behind fulfilled check)

### [Medium] fetchPermissions.pending doesn't reset errorCode — stale error shown during re-fetch
- **File**: src/store/slices/roleSlice.js:100
- **Issue**: The `pending` handler for `fetchPermissions` only sets `permissionsLoading = true` but doesn't clear `errorCode`. A previous fetch error stays visible while a new fetch is in-flight.
- **Suggested fix**: Add `state.errorCode = null` inside the `fetchPermissions.pending` case
- **Status**: Fixed (added errorCode = null to pending handler)

### [Medium] fetchUserRoles dispatched redundantly after revokeRole — extra API call
- **File**: src/components/SuperAdminDashboard/index.jsx:536-538
- **Issue**: `revokeRole.fulfilled` reducer already filters the role out of `userRoles[userId]` locally. `handleRevoke` then dispatches `fetchUserRoles(userId)` again, making a redundant GET call.
- **Suggested fix**: Remove the `dispatch(fetchUserRoles(userId))` call from `handleRevoke`
- **Status**: Fixed (removed redundant dispatch)

### [Low] rememberMe state is tracked but never sent to the login API
- **File**: src/components/UserLogin/index.jsx:22,159
- **Issue**: `rememberMe` state is wired to the checkbox but `handleSubmit` calls `loginAsync({ email, password })` without it — the checkbox has no backend effect.
- **Suggested fix**: Pass `rememberMe` to `loginAsync` if the API supports it, or remove the checkbox
- **Status**: Open

### [Low] href="#" on Forgot password link causes scroll-to-top
- **File**: src/components/UserLogin/index.jsx:149
- **Issue**: `<a href="#">` scrolls the page to the top on click in some browsers. Intended as a placeholder but causes unwanted UX side effect.
- **Suggested fix**: Change to `href="#!"` or replace with a `<button type="button">` element
- **Status**: Fixed (replaced anchor with button element)

### [Low] removeUser exported from userSlice but never imported anywhere
- **File**: src/store/slices/userSlice.js:189
- **Issue**: `removeUser` was added for a delete-removes-row feature that was reverted. The export is now dead code.
- **Suggested fix**: Remove `removeUser` from the slice reducers and the export line
- **Status**: Fixed (removed reducer and export)

---

## 2026-04-29 — code-review: src/

### [Critical] SuperAdminLogin grants super-admin to any successful login
- **File**: src/components/SuperAdminLogin/index.jsx:32-55
- **Issue**: `handleSubmit` calls `loginSuperAdmin()` unconditionally after `loginAsync.fulfilled`. Any user with valid credentials who hits `/admin/login` gets `isSuperAdmin = true` (and `sessionStorage.ih_sa = "1"`). `AdminRoute` lets that through, exposing the super-admin dashboard regardless of the user's actual role.
- **Suggested fix**: Gate `loginSuperAdmin()` and the dashboard navigation on `payload.isSuperAdmin === true`; otherwise show an "access denied" error or route to `/dashboard`.
- **Status**: Open

### [High] X-ORG-ID header not restored after page reload
- **File**: src/context/AppContext.jsx:38-47
- **Issue**: On mount, the provider rehydrates `currentUser` and `activeOrg` from localStorage but never calls `setActiveOrg(activeOrg.id)` from AxiosUtils. After a hard refresh the user appears logged-in but every org-scoped API call goes out without `X-ORG-ID` and fails with `INVALID_ORG_CONTEXT`.
- **Suggested fix**: After computing the initial `activeOrg` (or in a one-shot `useEffect`), call `setActiveOrg(activeOrg.id)` if one is present.
- **Status**: Fixed (setActiveOrg called inside useState initializer at line 42)

### [High] Missing key on Fragment used inside .map()
- **File**: src/components/SuperAdminDashboard/index.jsx:257-258, 657-658, 1042-1043
- **Issue**: Each iteration returns `<>...</>` wrapping two sibling `<tr>`s. The bare Fragment has no key, so React keys reconciliation by index. The inner `<tr key={org.id}>` does not satisfy the rule — React still warns and may misreuse rows when items reorder.
- **Suggested fix**: Replace `<>` with `<Fragment key={org.id}>` (and the equivalent for users/roles), or refactor to return an array `[<tr key=…/>, <tr key=…/>]`.
- **Status**: Open

### [High] RoleAccess crashes on users missing name/username
- **File**: src/components/RoleAccess/index.jsx:116-122
- **Issue**: Filter calls `u.name.toLowerCase()` and `u.username.toLowerCase()` directly. Any user record without those fields (e.g. one created via the API which uses `fullName`/`email`) will throw `Cannot read properties of undefined`.
- **Suggested fix**: Guard with `(u.name ?? "").toLowerCase()` / `(u.username ?? "").toLowerCase()`, or align the schema with the rest of the app.
- **Status**: Open

### [High] UserRoute redirects to a route that does not exist
- **File**: src/routes/UserRoute.jsx:6, src/App.jsx:8-13
- **Issue**: `UserRoute` redirects unauthenticated users to `/login`, but `App.jsx` only declares `/admin/login`. The unknown path falls through to the `*` redirect — works by accident, but the intent is wrong and any later change to the catch-all will break login redirects silently.
- **Suggested fix**: Either add a `/login` route mapped to `UserLogin`, or change `UserRoute` to redirect to `/admin/login` (whatever the user-facing entry point should be).
- **Status**: Open

### [Medium] Double redirect when /auth/refresh returns a hard-logout code
- **File**: src/utils/AxiosUtils.js:60-94
- **Issue**: When the refresh request itself fails with one of `HARD_LOGOUT_CODES`, the recursive interceptor branch calls `redirectToLogin()` and rejects. The outer `catch` then runs `processQueue(false)` and calls `redirectToLogin()` again, causing two `window.location.href` writes back-to-back.
- **Suggested fix**: Skip the redirect inside the catch when one was already triggered (e.g. detect by inspecting `error.response?.data?.errorCode` against `HARD_LOGOUT_CODES`), or have the hard-logout branch throw a sentinel and let the outer catch decide.
- **Status**: Open

### [Medium] Auto-select effect re-runs on every render
- **File**: src/components/SuperAdminDashboard/index.jsx:1371-1381
- **Issue**: `modules` is `Object.keys(...)` produced inline in render — a new array each render. Listing it as a dependency in `useEffect(..., [modules])` makes the effect fire on every render. The `if (!activeTab && modules.length > 0)` guard makes it a no-op once a tab is set, but it still creates needless re-renders / rule-of-hooks noise.
- **Suggested fix**: Memoize: `const modules = useMemo(() => Object.keys(moduleActionMap).filter(...).sort(), [moduleActionMap])` (and memoize `moduleActionMap` too) — or depend on `modules.length` / `modules.join(",")`.
- **Status**: Open

### [Medium] userRoles map not refreshed after role deletion
- **File**: src/components/SuperAdminDashboard/index.jsx:911-963
- **Issue**: After bulk-revoke + delete, the local `userRoles` slice still lists the deleted role for affected users until something refetches. UI shows stale assignments.
- **Suggested fix**: After successful deletion, dispatch `fetchUserRoles(userId)` for each id in `userIds`, or refetch the full users list.
- **Status**: Open

### [Medium] Token-refresh deadlock if /auth/refresh returns TOKEN_EXPIRED
- **File**: src/utils/AxiosUtils.js:72-98
- **Issue**: The interceptor handles TOKEN_EXPIRED uniformly. If `/auth/refresh` itself responds with TOKEN_EXPIRED (or UNAUTHORIZED), the interceptor enters the refresh branch again, sees `isRefreshing === true`, queues a callback that depends on the very same refresh resolving, and the outer `await` never completes. Browser sits indefinitely.
- **Suggested fix**: Mark the refresh request itself with `_retried = true` (or a dedicated flag) before issuing it so the interceptor falls through to `Promise.reject(error)` without re-queuing.
- **Status**: Open

### [Medium] ErrorBoundary leaks full stack trace to the UI
- **File**: src/components/ErrorBoundary.jsx:25-33
- **Issue**: Renders the full `error.message` and `error.stack` verbatim on every error, including in production builds. That can disclose source paths, internal route names, or sensitive variable values to end users.
- **Suggested fix**: Show a generic message in production (`import.meta.env.PROD`) and only render the stack in dev. Log the full error to a reporting service if you add one later.
- **Status**: Open

### [Low] Date.now() used as primary key
- **File**: src/context/AppContext.jsx:51, 65, 77
- **Issue**: Two creations within the same millisecond would collide. Local-only and unlikely in practice, but trivial to harden.
- **Suggested fix**: Use `crypto.randomUUID()`.
- **Status**: Open

### [Low] Leftover debug text in sidebar brand
- **File**: src/components/RoleDashboard/index.jsx:304
- **Issue**: Brand reads `InsureHub fff` — looks like a typo / debug residue.
- **Suggested fix**: Restore to `Kinko` (or whatever the official product name is).
- **Status**: Open

### [Low] Unused variables
- **File**: src/components/RoleDashboard/index.jsx:49 (`canManage`); src/components/SuperAdminDashboard/index.jsx:853 (`currentUser` from `useApp()` in RoleModuleTab)
- **Issue**: Dead reads — the linter will flag them and they suggest the surrounding logic was abandoned mid-edit.
- **Suggested fix**: Delete or wire them up.
- **Status**: Open

### [Low] Ternary used as expression statement
- **File**: src/components/RoleAccess/index.jsx:70, 109
- **Issue**: `set.has(perm) ? set.delete(perm) : set.add(perm);` and `check ? set.add(perm) : set.delete(perm);` rely on a ternary's side effect. ESLint's `no-unused-expressions` typically flags this and it reads worse than an if/else.
- **Suggested fix**: `if (set.has(perm)) set.delete(perm); else set.add(perm);`.
- **Status**: Open

### [Low] `<a href="#">` for "Forgot password?"
- **File**: src/components/UserLogin/index.jsx:149
- **Issue**: With HashRouter, clicking this empty hash link will rewrite the route hash and may trigger an unintended navigation. The link does nothing meaningful either way.
- **Suggested fix**: Render a `<button type="button">` styled as a link, or wire it to a real route once the flow exists.
- **Status**: Open
