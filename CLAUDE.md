# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Serve the production build at http://localhost:4173
npm run lint       # ESLint (no auto-fix)
```

No test suite exists in this project.

## API Proxy

All requests go through a Vite dev proxy. `VITE_API_BASE_URL=/api/v1` (set in `.env.local`) is the Axios `baseURL`. The Vite proxy rewrites `/api/v1/*` → `http://10.0.21.159:8008/*`. To point at a different backend, change `target` in `vite.config.js`.

## Architecture

### Routing

Uses **HashRouter** (`/#/path`). Routes are defined in `App.jsx`. Two protected route wrappers in `src/routes/`:
- `AdminRoute` — checks `isSuperAdmin` (in-memory state) OR `sessionStorage.ih_sa === "1"` OR `currentUser.isSuperAdmin`
- `UserRoute` — checks `currentUser` exists in `AppContext`

### Two Separate Auth Contexts

There are **two completely separate login systems**:

| | Super Admin | Regular User |
|---|---|---|
| Login page | `/admin/login` → `SuperAdminLogin` | `/login` → `UserLogin` |
| Session signal | `sessionStorage.ih_sa = "1"` | `localStorage.ih_session_user` |
| Dashboard | `SuperAdminDashboard` | `RoleDashboard` |

Both go through `loginAsync` (Redux) → `authService.loginWithPassword` → HttpOnly cookie auth. After login, `setSessionFromApi` syncs the API payload into `AppContext`.

### State — Two Layers

**AppContext** (`src/context/AppContext.jsx`) — session state only:
- `currentUser`, `activeOrg`, `isSuperAdmin`
- `orgs`, `users`, `customRoles` — legacy localStorage data (predates the API)
- Key methods: `setSessionFromApi`, `switchOrg`, `loginSuperAdmin`, `logoutSuperAdmin`, `logout`

**Redux store** — server data:
- `login` — auth loading/error state
- `me` — current user's permissions from `GET /me/permissions`
- `orgs` — org list and selected org detail
- `roles` — role list and system permissions
- `users` — user list, pagination, per-user role assignments

### HTTP Client (`src/utils/AxiosUtils.js`)

- `withCredentials: true` — HttpOnly cookies sent automatically, never handled in JS
- `X-ORG-ID` header is set/cleared via `setActiveOrg(id)` / `clearActiveOrg()` after login or org switch. **This header must be set before any `/me/permissions` call or the API returns `INVALID_ORG_CONTEXT`.**
- Response interceptor handles `TOKEN_EXPIRED` → silent refresh via `POST /auth/refresh` with a queue to prevent concurrent refresh calls. `SESSION_INVALIDATED`, `REFRESH_TOKEN_EXPIRED`, and related codes trigger immediate redirect to `/#/admin/login`.

### SuperAdminDashboard — Tab System

The dashboard builds tabs dynamically from `GET /me/permissions`. The response shape `{ MODULE: [ACTION, ...] }` is normalised into `{ code, module, action }[]` in `meService.getMyPermissions`. Tabs are the unique modules the user has any permission for (minus `EXCLUDED_MODULES`), sorted alphabetically with `AUDIT` pinned last.

Three modules have dedicated tab components:
- `ORG` → `OrgModuleTab`
- `USER` → `UserModuleTab`
- `ROLE` → `RoleModuleTab`

All other modules fall through to `GenericModuleTab`.

**Important**: The tab component is re-mounted on every tab switch via `key={activeOrg.id-${activeTab}}`. Fetch thunks use a `condition` guard (`!loading && data.length === 0`) to prevent redundant API calls on remount.

### Deduplication Pattern for Fetch Thunks

All list-fetch thunks (`fetchOrgs`, `fetchRoles`, `fetchPermissions`, `fetchUsers`) use RTK's `condition` option to skip if data is already loaded **or** a fetch is in-flight. This handles both React StrictMode double-invoke and tab-switch remounts. `fetchMyPermissions` uses `!loading` only (no data check) so it always re-fetches on org switch.

### Permission Gating (Regular Users)

`src/components/PermissionGate/index.jsx` exports:
- `<PermissionGate permission="x">` — renders children if user has permission
- `<DeniedGate permission="x">` — renders children if user LACKS permission
- `usePermission(perm)`, `useRole(...roles)`, `usePermissions()` hooks

Effective permissions: `currentUser.permissions` (custom) takes precedence over `ROLE_PERMISSIONS[currentUser.role]` (defaults from `src/constants/roles.js`). Super admin always passes every gate.

### Forgot Password Flow (SuperAdminLogin)

Multi-step inline flow within the same card, view-switched via local state:
`"login"` → `"forgot"` → `"otp"` → `"reset"` → `"done"`

API sequence: `POST /auth/otp/send` (purpose `FORGOT_PASSWORD`) → `POST /auth/otp/verify` → returns `verifyToken` → `POST /auth/reset-password`.

### Key Conventions

- All API calls go through `src/services/*.js` — never call `AxiosUtils` directly from components or Redux slices.
- Each slice owns its own error state (`errorCode`). Components read `errorCode` and map it to a user-facing string locally.
- Mutations (create/update/delete) update Redux state optimistically in `fulfilled` handlers — no re-fetch needed after mutations.
- Soft deletes: `deleteUser` and `deleteOrg` mark status as `"inactive"` in the list; `reviveUser` restores to `"active"`.
- CSS is co-located per component (`styles.css` next to `index.jsx`). No CSS framework — plain CSS with BEM-like class naming.
- Known open lint errors in `PermissionGate`, `RoleDashboard`, and `AppContext` (react-refresh/only-export-components). Do not introduce new ones.
