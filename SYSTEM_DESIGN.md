# System Design — Kinko Backoffice Frontend

> Generated: 2026-05-09  
> Source: `docs/`, `CLAUDE.md`, `.claude/`, and `src/` tree

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Development Environment](#3-development-environment)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Frontend Structure](#5-frontend-structure)
6. [Routing & Protected Routes](#6-routing--protected-routes)
7. [State Management](#7-state-management)
8. [HTTP Client & Interceptors](#8-http-client--interceptors)
9. [Authentication System](#9-authentication-system)
10. [Authorization — RBAC](#10-authorization--rbac)
11. [Organisation Context](#11-organisation-context)
12. [Super Admin Dashboard](#12-super-admin-dashboard)
13. [Bulk Upload System](#13-bulk-upload-system)
14. [Verification Portal](#14-verification-portal)
15. [API Reference Summary](#15-api-reference-summary)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Key Conventions & Patterns](#17-key-conventions--patterns)
18. [Environment Configuration](#18-environment-configuration)

---

## 1. Project Overview

**Kinko Backoffice** is a React SPA that provides two distinct portals:

| Portal | Who Uses It | Entry Point |
|--------|-------------|-------------|
| Super Admin Dashboard | Root/super admins managing organisations, CMS users, and roles | `/#/admin/login` |
| Role Dashboard | Regular CMS users (org-admins, agents, viewers) | `/#/login` |
| Verify Portal | End-consumers accepting an insurance enrolment invite | `/#/verify?token=...` (public) |

The backend is a Spring Boot REST API at `http://10.0.21.159:8008` (local dev). All communication is cookie-based (HttpOnly JWT cookies — no tokens in JS). The frontend never reads or stores auth tokens.

---

## 2. Tech Stack

| Layer | Library | Version | Role |
|-------|---------|---------|------|
| UI framework | React | 19 | Component rendering |
| Routing | React Router DOM | 7 | HashRouter (`/#/path`) |
| Server state | Redux Toolkit | 2 | Async data from API |
| Session state | React Context (`AppContext`) | — | In-memory user/org session |
| HTTP client | Axios | 1.x | Requests + interceptors |
| Build tool | Vite | 8 | Dev server, proxy, bundler |
| Linter | ESLint | 9 | Code quality |
| Tests | Playwright | 1.x | E2E login tests |

No CSS framework — plain CSS with BEM-like naming, co-located per component.

---

## 3. Development Environment

### Prerequisites

- Node.js ≥ 18.x, npm ≥ 9.x

### Commands

```bash
npm run dev        # Dev server → http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Serve production build → http://localhost:4173
npm run lint       # ESLint (no auto-fix)
npm test           # Playwright E2E tests
```

### API Proxy

Vite rewrites `/api/v1/*` → `http://10.0.21.159:8008/*`.  
To point at a different backend, change `target` in `vite.config.js`.

```js
proxy: {
  '/api/v1': {
    target: 'http://<host>:<port>',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/v1/, ''),
  },
}
```

`VITE_API_BASE_URL=/api/v1` in `.env.local` is the Axios `baseURL`.

### Dev Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Super admin | `root@kinko.local` | *(see team password manager)* |
| Org admin (kinko) | `org-admin@kinko.local` | *(see team password manager)* |
| Read-only (kinko) | `read-only@kinko.local` | *(see team password manager)* |
| Limited admin (hdw) | `limited@hdw.local` | *(see team password manager)* |

---

## 4. High-Level Architecture

```
Browser
  │
  ├── HashRouter (/#/path)
  │     ├── /admin/login  → SuperAdminLogin
  │     ├── /admin/dashboard → SuperAdminDashboard  [AdminRoute guard]
  │     ├── /login        → UserLogin
  │     ├── /dashboard    → RoleDashboard           [UserRoute guard]
  │     ├── /verify       → VerifyPortal            [public]
  │     └── /invite/accept → InviteAccept           [public]
  │
  ├── AppContext  (session state — currentUser, activeOrg, isSuperAdmin)
  │
  └── Redux Store
        ├── loginSlice   (auth loading/error)
        ├── meSlice      (permissions from GET /me/permissions)
        ├── orgSlice     (org list + selected org detail)
        ├── roleSlice    (role list + system permissions)
        └── userSlice    (CMS user list, pagination, role assignments)
  │
  └── Axios instance (withCredentials, X-ORG-ID header, refresh interceptor)
        │
        └── Vite Proxy /api/v1/*
              │
              └── Backend API  http://10.0.21.159:8008
                    ├── /auth/*          (cookie-based auth)
                    ├── /cms-users/*     (backoffice operator CRUD)
                    ├── /orgs/*          (organisation management)
                    ├── /roles/*         (role & permission management)
                    ├── /permissions     (permission catalog)
                    ├── /me/permissions  (current user's effective permissions)
                    ├── /bulk/*          (bulk CSV upload — admin)
                    ├── /verify/*        (verification portal — public)
                    └── /users/*         (consumer-app user management)
```

---

## 5. Frontend Structure

```
src/
├── App.jsx                      # Route definitions
├── main.jsx                     # Entry point — Redux Provider + HashRouter
├── context/
│   └── AppContext.jsx            # Session state (currentUser, activeOrg, isSuperAdmin)
├── store/
│   ├── store.js                 # Redux store
│   └── slices/
│       ├── loginSlice.js        # loginAsync thunk, loading/error state
│       ├── meSlice.js           # fetchMyPermissions thunk
│       ├── orgSlice.js          # fetchOrgs, createOrg, updateOrg, deleteOrg
│       ├── roleSlice.js         # fetchRoles, fetchPermissions, CRUD
│       └── userSlice.js         # fetchUsers, inviteUser, deleteUser, roles
├── services/                    # All API calls — components never call Axios directly
│   ├── authService.js           # login, logout, OTP, forgot-password, invite/accept
│   ├── meService.js             # getMyPermissions (normalises MODULE: [ACTION] → flat codes)
│   ├── orgService.js            # CRUD + suspend/activate
│   ├── roleService.js           # roles + permissions CRUD
│   ├── userService.js           # CMS users CRUD + role assignments
│   ├── bulkService.js           # CSV upload, job polling, dispatch, cancel
│   ├── consumerUserService.js   # Consumer user read + status update
│   └── verifyService.js         # Public verify portal calls (anonymous axios)
├── utils/
│   ├── AxiosUtils.js            # Authenticated axios instance (withCredentials, X-ORG-ID)
│   └── AnonAxios.js             # Anonymous axios for /verify/* (no auth interceptors)
├── routes/
│   ├── AdminRoute.jsx           # Guards SuperAdminDashboard
│   └── UserRoute.jsx            # Guards RoleDashboard
├── components/
│   ├── SuperAdminLogin/         # Login + forgot-password multi-step flow
│   ├── SuperAdminDashboard/     # Tab-based dashboard built from /me/permissions
│   ├── UserLogin/               # Regular user login
│   ├── RoleDashboard/           # Role-based dashboard for regular users
│   ├── VerifyPortal/            # Public invite-verification flow (5 screens)
│   ├── InviteAccept/            # New-user invite acceptance (OTP + password)
│   ├── PermissionGate/          # <PermissionGate>, <DeniedGate>, hooks
│   └── RoleAccess/              # Role-level access wrapper
└── constants/
    └── roles.js                 # Default ROLE_PERMISSIONS map (fallback for regular users)
```

---

## 6. Routing & Protected Routes

The app uses **HashRouter** — all URLs are `/#/path`. This avoids server-side route handling on S3/CDN deploys.

### Route Table

| Route | Component | Guard |
|-------|-----------|-------|
| `/` | Redirect to `/login` | — |
| `/login` | UserLogin | Public |
| `/admin/login` | SuperAdminLogin | Public |
| `/admin/dashboard` | SuperAdminDashboard | AdminRoute |
| `/dashboard` | RoleDashboard | UserRoute |
| `/verify` | VerifyPortal | Public (no auth) |
| `/invite/accept` | InviteAccept | Public (no auth) |

### AdminRoute Guard Logic

```
sessionStorage.ih_sa === "1"
  OR  isSuperAdmin (in-memory AppContext)
  OR  currentUser.isSuperAdmin
→ render children; otherwise redirect to /admin/login
```

### UserRoute Guard Logic

```
currentUser exists in AppContext
→ render children; otherwise redirect to /login
```

---

## 7. State Management

Two separate layers handle different concerns.

### AppContext (Session State)

Lives in `src/context/AppContext.jsx`. Holds:

| Property | Type | Description |
|----------|------|-------------|
| `currentUser` | object | Logged-in user (id, email, isSuperAdmin) |
| `activeOrg` | object | Currently selected org (id, name, slug) |
| `isSuperAdmin` | boolean | Derived from `currentUser.isSuperAdmin` |
| `orgs` | array | Legacy — org list from localStorage (predates API) |
| `users` | array | Legacy — user list from localStorage |
| `customRoles` | array | Legacy — custom role list from localStorage |

Key methods: `setSessionFromApi`, `switchOrg`, `loginSuperAdmin`, `logoutSuperAdmin`, `logout`.

### Redux Store (Server Data)

| Slice | What it holds | Key thunks |
|-------|--------------|------------|
| `loginSlice` | `loading`, `error`, `errorCode` for auth | `loginAsync` |
| `meSlice` | `permissions: [{code, module, action}]`, loading | `fetchMyPermissions` |
| `orgSlice` | `orgs[]`, `selectedOrg`, loading, error | `fetchOrgs`, `createOrg`, `updateOrg`, `deleteOrg` |
| `roleSlice` | `roles[]`, `permissions[]` (catalog), loading | `fetchRoles`, `fetchPermissions` |
| `userSlice` | `users[]`, pagination, per-user roles, loading | `fetchUsers`, `inviteUser`, `deleteUser`, `fetchUserRoles` |

### Deduplication Pattern

All list-fetch thunks use RTK's `condition` option to skip if data is already loading or already present. This handles React StrictMode double-invoke and tab-switch remounts:

```js
// Most thunks: skip if loading OR already has data
condition: (_, { getState }) => {
  const { loading, data } = getState().slice
  return !loading && data.length === 0
}

// fetchMyPermissions: skip only if loading (always re-fetch on org switch)
condition: (_, { getState }) => !getState().me.loading
```

---

## 8. HTTP Client & Interceptors

### Authenticated Client (`src/utils/AxiosUtils.js`)

```
baseURL: VITE_API_BASE_URL (/api/v1)
withCredentials: true      ← required for HttpOnly cookie transport
```

`setActiveOrg(id)` sets `X-ORG-ID` header globally.  
`clearActiveOrg()` removes it on logout.

### Anonymous Client (`src/utils/AnonAxios.js`)

Used exclusively for `/verify/*` calls. Has **no auth interceptors** and does not attach `X-ORG-ID`. Required because the verify portal is public and the backend rejects auth headers on those endpoints.

### Response Interceptor (Token Refresh)

The interceptor on the authenticated client handles:

| Error Code | Action |
|-----------|--------|
| `TOKEN_EXPIRED` | Silent refresh via `POST /auth/refresh`, then retry original request. Concurrent requests are queued during refresh — only one refresh call fires. |
| `SESSION_INVALIDATED` | Hard logout → redirect to `/admin/login` |
| `REFRESH_TOKEN_EXPIRED` | Hard logout → redirect to `/admin/login` |
| `ACCOUNT_DISABLED` | Hard logout → redirect |
| `SESSION_DEVICE_MISMATCH` | Hard logout → redirect |
| `INVALID_ORG_CONTEXT` | Redirect to org picker |
| `INACTIVE_ORG` | Redirect to org picker |

---

## 9. Authentication System

### Two Separate Login Systems

| Aspect | Super Admin | Regular User |
|--------|------------|--------------|
| Login URL | `/#/admin/login` | `/#/login` |
| Session signal | `sessionStorage.ih_sa = "1"` | `localStorage.ih_session_user` |
| Post-login destination | `SuperAdminDashboard` | `RoleDashboard` |
| Org context | Selects from all orgs (picker) | Fixed to their single org |

Both call `loginAsync` (Redux) → `authService.loginWithPassword` → `POST /auth/login/password` → HttpOnly cookie auth. After login, `setSessionFromApi` syncs the API payload into AppContext.

### Cookie Behaviour

| Cookie | Path | Max-Age | JS Accessible? |
|--------|------|---------|----------------|
| `access_token` | `/` | 15 min | No (HttpOnly) |
| `refresh_token` | `/auth/refresh` | 7 days | No (HttpOnly) |

- `SameSite=Lax` — allows cookies when user follows email links.
- `Secure` flag present in production (HTTPS), intentionally omitted in local HTTP dev.
- Frontend **never reads or stores tokens**. Browser sends them automatically.

### Forgot Password Flow (SuperAdminLogin)

Multi-step inline, view-switched via local state — no page navigation:

```
"login" → "forgot" → "otp" → "reset" → "done"
```

API sequence:
1. `POST /auth/otp/send` `{ email, purpose: "FORGOT_PASSWORD" }`
2. `POST /auth/otp/verify` `{ email, otp, purpose: "FORGOT_PASSWORD" }` → returns `verifyToken`
3. `POST /auth/reset-password` `{ verifyToken, newPassword }` → kills all sessions

### Invite Accept Flow

New users receive an email OTP; they complete signup via:

```
POST /auth/invite/accept  { email, otp, password }
→ Activates account, sets cookies, logs them in
```

---

## 10. Authorization — RBAC

### Permission Structure

Permissions follow the pattern `MODULE_ACTION` (e.g. `BULK_UPLOAD`, `CMS_USER_READ`).

The backend returns the calling user's effective permissions via `GET /me/permissions`. For super admins this is always all 19+ permission codes. For regular users it's derived from their role assignments within the active org.

`meService.getMyPermissions` normalises the response `{ MODULE: [ACTION, ...] }` into a flat `{ code, module, action }[]` array stored in `meSlice`.

### Current Permission Codes

| Code | Module | Action | Guards |
|------|--------|--------|--------|
| `CMS_USER_READ` | CMS_USER | READ | List/view backoffice operators |
| `CMS_USER_CREATE` | CMS_USER | CREATE | Create / invite backoffice operators |
| `CMS_USER_UPDATE` | CMS_USER | UPDATE | Update backoffice operator profiles |
| `CMS_USER_DELETE` | CMS_USER | DELETE | Soft-delete backoffice operators |
| `ROLE_MANAGE` | ROLE | MANAGE | Create/update/delete roles & permissions |
| `ROLE_ASSIGN` | ROLE | ASSIGN | Assign/revoke roles from users |
| `ORG_READ` | ORG | READ | View organisations |
| `ORG_UPDATE` | ORG | UPDATE | Update org name, suspend/activate |
| `AUDIT_READ` | AUDIT | READ | View audit logs |
| `BULK_UPLOAD` | BULK | UPLOAD | Upload CSV, dispatch, cancel, resend |
| `BULK_READ` | BULK | READ | View bulk jobs and rows |
| `USER_READ` | USER | READ | View consumer user profiles |
| `USER_UPDATE` | USER | UPDATE | Change consumer user status |
| `MEMBER_*` | MEMBER | CRUD | Member management (planned) |
| `DEPENDENT_*` | DEPENDENT | CRUD | Dependent management (planned) |

> `ORG_CREATE` and `ORG_DELETE` are super-admin-only; they are not role-assignable.

### Frontend Permission Gating

`src/components/PermissionGate/index.jsx` exports:

```jsx
<PermissionGate permission="BULK_UPLOAD">
  <UploadButton />          // rendered only if user has BULK_UPLOAD
</PermissionGate>

<DeniedGate permission="ROLE_MANAGE">
  <ReadOnlyBadge />         // rendered only if user LACKS ROLE_MANAGE
</DeniedGate>
```

Hooks: `usePermission(perm)`, `useRole(...roles)`, `usePermissions()`.

Effective permissions: `currentUser.permissions` (custom) takes precedence over `ROLE_PERMISSIONS[currentUser.role]` defaults in `constants/roles.js`. Super admin always passes every gate.

---

## 11. Organisation Context

### How the Backend Resolves Org (Priority Order)

1. `X-ORG-ID` header — UUID of the selected org
2. `Host` header subdomain — e.g. `acme` from `acme.mydomain.com`
3. User's single org — if user belongs to exactly one org
4. Error `INVALID_ORG_CONTEXT` (400) — multi-org user with no context

**Frontend always sends `X-ORG-ID`** after login. The header must be set before any `/me/permissions` call or the API returns `INVALID_ORG_CONTEXT`.

### Login Response & Org Picker

```ts
// POST /auth/login/password response shape
{
  userId: string
  email: string
  currentOrgId: string | null   // null → super admin or multi-org user
  orgs: [{ id, name, slug }]
}
```

- `currentOrgId` is set → single-org user → go straight to dashboard
- `currentOrgId` is null → show org picker → user selects, then navigate to dashboard

### Org Switching (SuperAdminDashboard)

Switching orgs:
1. Updates `activeOrg` in AppContext
2. Sets `X-ORG-ID` header on Axios defaults
3. Resets loaded data (tab re-mounts via `key={activeOrg.id-${activeTab}}`)
4. Re-fetches `/me/permissions` (not guarded by data check — always refreshes)

---

## 12. Super Admin Dashboard

### Tab System

Tabs are built dynamically from `GET /me/permissions`. The unique `module` values (minus `EXCLUDED_MODULES`) become tabs, sorted alphabetically with `AUDIT` pinned last.

| Module | Component |
|--------|-----------|
| `ORG` | `OrgModuleTab` |
| `USER` (CMS users) | `UserModuleTab` |
| `ROLE` | `RoleModuleTab` |
| All others | `GenericModuleTab` |

Each tab component is re-mounted on every tab switch via `key={activeOrg.id-${activeTab}}`. Fetch thunks guard against redundant calls using the condition pattern.

### Org Management

- Lists all orgs with status (active / inactive)
- Create org: name + unique slug (`^[a-z0-9-]+$`, 2–50 chars, immutable after creation)
- Auto-creates 3 default system roles (`AdminFullAccess`, `FullReadOnly`, `LimitedAdmin`) for new orgs
- Suspend / activate / delete (soft-delete) orgs. Cannot touch the default org.

### User Management (CMS Users)

- Paginated user list with status filter
- Create user with password OR invite (sends OTP email)
- Soft-delete → `inactive`; revive → `active`
- Assign / revoke roles per user

### Role Management

- System roles are seeded, cannot be deleted or renamed
- Custom roles: create, rename, delete (only if no active assignments)
- Add / remove individual permissions from a role
- Privilege escalation prevention: cannot assign a role you don't hold yourself

---

## 13. Bulk Upload System

### Flow Overview

```
Admin uploads CSV
  POST /bulk/upload (multipart)
    → 202 Accepted, job starts async parse

Poll GET /bulk/{id} until status = COMPLETED
  → rows land in DRAFT state (no emails sent yet)

Admin reviews rows — optional per-row edit / cancel
  PUT /bulk/{id}/rows/{rowId}    (DRAFT rows only)
  POST /bulk/{id}/rows/{rowId}/cancel

Admin dispatches invites
  POST /bulk/{id}/dispatch
    → DRAFT rows → STAGED, invite emails sent

Consumers click invite links → VerifyPortal flow

Admin monitors
  GET /bulk/{id}/rows?status=OTP_SENT&search=...
  POST /bulk/{id}/rows/{rowId}/resend-invite
  POST /bulk/{id}/cancel   (discard entire job)
```

### Job Phases (server-derived `phase` field)

| Phase | Meaning | UI Label |
|-------|---------|----------|
| `UPLOADING` | Parse in progress | "Uploading…" |
| `DRAFT` | Parsed, awaiting dispatch | "Draft — review before sending invites" |
| `PENDING_VERIFICATION` | Invites sent, consumers pending | "Pending verification" |
| `COMPLETED` | All rows in terminal states | "Completed" |
| `CANCELLED` | Admin cancelled | "Cancelled" |
| `FAILED` | Parse error | "Failed" |

### Row Status Lifecycle

```
DRAFT → (dispatch) → STAGED → OTP_SENT → VERIFIED → PROMOTED
                                                  ↘ REJECTED (admin cancel pre-promote)
                                                  ↘ EXPIRED  (review window lapsed)
                                                  ↘ INVITE_FAILED (SMTP error)
                                                  ↘ SUPERSEDED (re-upload with correction)
                                                  ↘ CANCELLED (admin cancelled)
```

### Dedup / Re-upload Logic

Identity key is `mobile`. Same mobile + identical content = `REJECTED` (duplicate). Same mobile + different content + old row not yet PROMOTED = new row `DRAFT`, old row `SUPERSEDED`. Cannot supersede a PROMOTED row — use `PUT /users/{profileId}/status` instead.

### Required Permissions

| Action | Permission |
|--------|-----------|
| Upload, dispatch, cancel, resend | `BULK_UPLOAD` |
| View jobs and rows | `BULK_READ` |

---

## 14. Verification Portal

### Route & Access

`/#/verify?token=<opaque-token>` — **public, no login required**. Token is read from `?token` query param on mount. An anonymous Axios instance (no auth headers, no `X-ORG-ID`) is used for all `/verify/*` API calls.

### Screen State Machine

```
LANDING
  │ POST /verify/otp/send
  ▼
OTP_INPUT
  │ POST /verify/otp/confirm
  ▼
REVIEWING  ─────────────────── review window expires ──► EXPIRED → back to LANDING
  │                    │
  │ POST /verify/promote    POST /verify/reject
  ▼                    ▼
DONE_ENROLLED       DONE_REJECTED

Any terminal error → TERMINAL_ERROR
```

State lives **only in component memory** — never in localStorage, sessionStorage, or cookies.

### Screens

| Screen | Description |
|--------|-------------|
| **Landing** | Explains what will happen; "Send code" button |
| **OTP Input** | 6-digit code entry with resend cooldown countdown |
| **Review** | Full unmasked PII details + countdown timer; "Yes, enrol me" / "Wrong info" |
| **Done — Enrolled** | Success confirmation |
| **Done — Rejected** | Notifies admin of data errors via reason chips + free text |
| **Terminal Error** | Static screen for invalid token, locked OTP, cancelled invite, etc. |

### Key Implementation Rules

- Token is **opaque** — never parse, decode, log, or include in error reports
- Pass token verbatim in every API request **body** (not headers or query params)
- No third-party tracking scripts on `/verify/*` — page reaches users before consent
- Review countdown = `verifiedAt + reviewWindowSeconds - now`; when ≤ 0, disable buttons
- OTP input: 6 separate `<input>` elements, auto-advance, auto-back on backspace, paste handling

---

## 15. API Reference Summary

### Base URL

| Environment | Value |
|-------------|-------|
| Local dev | `http://localhost:8008` (proxied via `/api/v1`) |
| Staging (via Vite proxy) | relative (empty) |
| Production | relative (empty — same domain) |

### Response Envelope

Every response uses:

```ts
interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string | null
  errorCode: string | null
}
```

### Endpoint Groups

| Group | Base Path | Auth Required | Org Header |
|-------|-----------|---------------|------------|
| Auth | `/auth/*` | No | No |
| CMS Users (backoffice ops) | `/cms-users/*` | Yes | Yes |
| Consumer Users | `/users/*` | Yes | Yes |
| Organisations | `/orgs/*` | Yes | Super admin: optional; users: yes |
| Roles & Permissions | `/roles/*`, `/permissions` | Yes | Yes |
| My Permissions | `/me/permissions` | Yes | Yes (before calling) |
| Bulk Upload | `/bulk/*` | Yes | Yes |
| Verify Portal | `/verify/*` | **No** | No |

### Auth Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login/password` | Password login → sets cookies |
| POST | `/auth/login/otp` | OTP login → sets cookies |
| POST | `/auth/otp/send` | Send OTP email (LOGIN / FORGOT_PASSWORD / INVITE) |
| POST | `/auth/otp/verify` | Verify OTP → returns `verifyToken` (non-login flows) |
| POST | `/auth/forgot-password` | Trigger reset OTP (always 200 — no enumeration) |
| POST | `/auth/reset-password` | Set new password with verifyToken |
| POST | `/auth/invite/accept` | Accept invite OTP + set password → sets cookies |
| POST | `/auth/refresh` | Rotate tokens (called by interceptor on TOKEN_EXPIRED) |
| POST | `/auth/logout` | Revoke session + clear cookies |

### CMS User Endpoints (Backoffice Operators)

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/cms-users` | `CMS_USER_READ` |
| GET | `/cms-users/{id}` | `CMS_USER_READ` |
| POST | `/cms-users` | `CMS_USER_CREATE` |
| POST | `/cms-users/invite` | `CMS_USER_CREATE` |
| PUT | `/cms-users/{id}` | `CMS_USER_UPDATE` |
| DELETE | `/cms-users/{id}` | `CMS_USER_DELETE` |
| POST | `/cms-users/{id}/revive` | `CMS_USER_UPDATE` |
| GET | `/cms-users/{userId}/roles` | `CMS_USER_READ` |
| POST | `/cms-users/{userId}/roles` | `ROLE_ASSIGN` |
| DELETE | `/cms-users/{userId}/roles/{roleId}` | `ROLE_ASSIGN` |

### Consumer User Endpoints

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/users` | `USER_READ` |
| GET | `/users/{id}` | `USER_READ` |
| GET | `/users/stats` | `USER_READ` |
| PUT | `/users/{id}/status` | `USER_UPDATE` |

---

## 16. Error Handling Strategy

### Interceptor-Handled (automatic)

| errorCode | Handling |
|-----------|---------|
| `TOKEN_EXPIRED` | Silent refresh + retry queue |
| `SESSION_INVALIDATED` | Hard logout → `/admin/login` |
| `REFRESH_TOKEN_EXPIRED` | Hard logout → `/admin/login` |
| `ACCOUNT_DISABLED` | Hard logout → `/admin/login` |
| `SESSION_DEVICE_MISMATCH` | Hard logout → `/admin/login` |
| `INVALID_ORG_CONTEXT` | Redirect to org picker |
| `INACTIVE_ORG` | Redirect to org picker |

### Component-Handled (mapped to user-facing strings)

Each Redux slice stores `errorCode` (not a message string). Components read `errorCode` and map it to a localised string. This keeps API error codes out of the UI layer.

### Verify Portal (explicit per-error UX)

Every error code has a prescribed UX (static error screen, inline retry, countdown, redirect to start). Unknown error codes fall back to displaying `message` verbatim — forward-compatible for new codes.

---

## 17. Key Conventions & Patterns

### Service Layer

All API calls go through `src/services/*.js`. Components and Redux slices never call `AxiosUtils` directly. This keeps API coupling in one place.

### Optimistic Updates

Mutations (create / update / delete) update Redux state in `fulfilled` handlers — no re-fetch needed after mutations. Soft-deletes mark `status: "inactive"` in the list; revives restore to `"active"`.

### Component File Structure

Every component lives at `src/components/ComponentName/index.jsx` with `styles.css` co-located. Never standalone files.

### Tab Re-mount Key Pattern

`key={activeOrg.id-${activeTab}}` forces a full re-mount on org switch or tab change, triggering fresh data fetches while the condition guards prevent duplicate calls.

### CSS

Plain CSS with BEM-like naming. No CSS framework. Co-located `styles.css` next to each `index.jsx`.

### Known Lint Warnings (do not introduce new ones)

`react-refresh/only-export-components` warnings exist in `PermissionGate`, `RoleDashboard`, and `AppContext` — these are known and accepted.

---

## 18. Environment Configuration

### Cookie Behaviour by Environment

| Environment | `Secure` flag | `SameSite` | Org Context |
|-------------|--------------|------------|-------------|
| Local dev (HTTP) | Omitted | Lax | `X-ORG-ID` header |
| Local → Staging (Vite proxy) | Omitted | Lax | `X-ORG-ID` header |
| Staging ↔ Staging (HTTPS) | Present | Lax | `X-ORG-ID` header |
| Production (subdomain) | Present | Lax | Subdomain slug + `X-ORG-ID` |

### Production Subdomain Model

In production each org gets `{slug}.mydomain.com`. All subdomains share one backend via wildcard DNS. The cookie `Domain=.mydomain.com` is shared across all subdomains — RBAC still gates access per-org.

Org switching in production navigates to `https://{slug}.mydomain.com`; in local/staging, only the `X-ORG-ID` header changes.

### Environment Variables

```env
# .env.local
VITE_API_BASE_URL=/api/v1

# .env.qa / staging (Vite proxy active)
VITE_API_BASE_URL=

# production
VITE_API_BASE_URL=
```

### Dev Services (local stack)

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | `http://10.0.21.159:8008` | — |
| Swagger UI | `http://localhost:8008/swagger-ui/index.html` | — |
| MailHog (SMTP catcher) | `http://localhost:8025` | — |
| MinIO (S3 for CSV storage) | `http://localhost:9000` | *(see team password manager)* |
| MinIO console | `http://localhost:9001` | *(see team password manager)* |

---

*End of SYSTEM_DESIGN.md*
