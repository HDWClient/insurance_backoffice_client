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
- **Status**: Open

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
