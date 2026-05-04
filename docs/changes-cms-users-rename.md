# Frontend Changes — CMS Users Rename

> **Last Updated:** 2026-04-30
> **Backend version:** Plan A — `/users` → `/cms-users` rename
> **Audience:** Frontend developers (or AI agents working on the frontend codebase)

This document describes every backend change in the rename and what the frontend must update. It is intended to be precise enough that another AI agent can apply it mechanically.

---

## TL;DR

The backoffice backend used `/users` for *backoffice operators* (the `cms_users` table). The consumer-app team also has a `users` table (for end-users of the mobile app). Same word, different entity, different team. The collision blocks the upcoming bulk-upload feature, which legitimately wants `/users` to mean the consumer end-users that the backoffice manages.

So **all backoffice-operator routes have been renamed from `/users` to `/cms-users`**, and **all related permission codes from `USER_*` to `CMS_USER_*`**. Authentication, cookies, JWT format, and request/response *body* shapes are unchanged.

---

## What changed

### 1. Route renames (substitute everywhere)

| Old route | New route | Notes |
|---|---|---|
| `GET /users` | `GET /cms-users` | List CMS users |
| `GET /users/{id}` | `GET /cms-users/{id}` | Get single CMS user |
| `POST /users` | `POST /cms-users` | Create CMS user (with known password) |
| `PUT /users/{id}` | `PUT /cms-users/{id}` | Update CMS user profile |
| `DELETE /users/{id}` | `DELETE /cms-users/{id}` | Soft-delete CMS user |
| `POST /users/invite` | `POST /cms-users/invite` | Invite a CMS user (sends OTP email) |
| `POST /users/{id}/revive` | `POST /cms-users/{id}/revive` | Reactivate a soft-deleted CMS user |
| `GET /users/{userId}/roles` | `GET /cms-users/{userId}/roles` | List roles assigned to a CMS user |
| `POST /users/{userId}/roles` | `POST /cms-users/{userId}/roles` | Assign a role to a CMS user |
| `DELETE /users/{userId}/roles/{roleId}` | `DELETE /cms-users/{userId}/roles/{roleId}` | Revoke a role from a CMS user |
| `GET /roles/{id}/users` | `GET /roles/{id}/cms-users` | List CMS users holding a role |
| `DELETE /roles/{id}/users` | `DELETE /roles/{id}/cms-users` | Bulk-revoke a role from CMS users |

### 2. Routes that did **not** change

- All `/auth/*` routes (login, logout, refresh, OTP send/verify, invite/accept, forgot-password, reset-password)
- `/me`, `/me/permissions` — session-scoped, describe the calling user
- `/orgs`, `/orgs/{id}/...`
- `/roles` (the resource itself), `/roles/{id}` (only the nested `/users` sub-path changed, see above)
- `/permissions`
- `/audit`

### 3. Permission code renames (substitute everywhere)

If your frontend has any client-side RBAC (e.g., to hide buttons, route guards, "Can I do X?" checks via `/me/permissions`), update the strings:

| Old permission code | New permission code |
|---|---|
| `USER_READ` | `CMS_USER_READ` |
| `USER_CREATE` | `CMS_USER_CREATE` |
| `USER_UPDATE` | `CMS_USER_UPDATE` |
| `USER_DELETE` | `CMS_USER_DELETE` |

These are returned by `GET /me/permissions` as part of the `permissions: string[]` array. If your code does `if (perms.includes("USER_READ"))`, change the literal.

### 4. Error code renames

If your error-handling code branches on `errorCode` strings:

| Old error code | New error code |
|---|---|
| `USER_NOT_FOUND` | `CMS_USER_NOT_FOUND` |

Other error codes (`UNAUTHORIZED`, `FORBIDDEN`, `DUPLICATE_EMAIL`, `SELF_DELETE`, `SUPER_ADMIN_DELETE`, `NOT_INACTIVE`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, etc.) are unchanged.

### 5. Audit log changes (if frontend reads `/audit`)

Audit log entries now use `entityType: "CmsUser"` (was `"User"`) for CMS user actions. Action strings emitted include `CREATE`, `UPDATE`, `DELETE`, `REVIVE` — same as before, no change there. If your audit UI filters by `entityType=User`, change to `entityType=CmsUser`.

In the rename commit, *new* audit rows are written with `"CmsUser"`. Pre-rename audit rows in the DB still say `"User"`. If your audit UI shows historical data, you may want to display both (or just rely on a backfill — see the kinko_db PR notes).

### 6. Swagger / OpenAPI spec

If your codegen consumes the OpenAPI spec from `/v3/api-docs` or `/swagger-ui`, regenerate. The `@Tag(name = ...)` values on the controllers changed:

- `Users` → `CMS Users`
- `User Roles` → `CMS User Roles`

This may cause TypeScript SDK class names to change (e.g., `UsersApi` → `CmsUsersApi`). Adjust import paths accordingly.

### 7. What did **not** change

- **Cookies, JWT, refresh tokens, device fingerprint** — auth flow is identical.
- **Request body shapes** — `CmsUserRequest`, `CmsUserResponse`, `CmsUserUpdateRequest`, `CmsUserInviteRequest` have the same fields as before (only the Java class names changed). JSON keys are unchanged: `email`, `fullName`, `password`, `organizationId`, `status`, `superAdmin`, etc.
- **Pagination, error envelope, success envelope** — `{ success, data, message, errorCode }` and `{ items, page, size, totalItems, totalPages, hasNext }` unchanged.
- **Org context resolution** — `X-ORG-ID` header, host slug subdomain, fallback to user's org — unchanged.

---

## Mechanical migration steps for the frontend codebase

### Step 1: Search-and-replace route literals

Run these substitutions (in order — longest patterns first to avoid partial matches):

```
# Path matches (exact strings)
"/users/{userId}/roles/{roleId}"  →  "/cms-users/{userId}/roles/{roleId}"
"/users/{userId}/roles"           →  "/cms-users/{userId}/roles"
"/users/{id}/revive"              →  "/cms-users/{id}/revive"
"/users/{id}"                     →  "/cms-users/{id}"
"/users/invite"                   →  "/cms-users/invite"
"/users"                          →  "/cms-users"
"/roles/{id}/users"               →  "/roles/{id}/cms-users"
"/roles/{roleId}/users"           →  "/roles/{roleId}/cms-users"
```

If your codebase uses template literals like `` `/users/${userId}` ``, run equivalent regex:

```
/users/\$\{    →  /cms-users/${
"/users\b      →  "/cms-users
`/users\b      →  `/cms-users
```

⚠️ Be careful: do NOT replace `/users` when it's a substring of `/cms-users` (already-renamed) or part of an unrelated path. Use word boundaries. Run in a dry-run / preview mode first.

### Step 2: Update permission strings

Find and replace these exact strings (whole word, case-sensitive):

```
"USER_READ"     →  "CMS_USER_READ"
"USER_CREATE"   →  "CMS_USER_CREATE"
"USER_UPDATE"   →  "CMS_USER_UPDATE"
"USER_DELETE"   →  "CMS_USER_DELETE"
'USER_READ'     →  'CMS_USER_READ'
'USER_CREATE'   →  'CMS_USER_CREATE'
'USER_UPDATE'   →  'CMS_USER_UPDATE'
'USER_DELETE'   →  'CMS_USER_DELETE'
```

If you have a typed enum/const, e.g. `Permission.USER_READ`, rename the enum members too.

### Step 3: Update error code branches

```
"USER_NOT_FOUND"   →  "CMS_USER_NOT_FOUND"
'USER_NOT_FOUND'   →  'CMS_USER_NOT_FOUND'
```

### Step 4: Regenerate API client (if applicable)

If you use OpenAPI codegen, openapi-typescript, swagger-codegen, etc., re-run codegen against the updated `/v3/api-docs` endpoint. Class/file names may shift from `UsersApi` to `CmsUsersApi` etc.

If you use a hand-written API client, update method names: `getUsers()` → `getCmsUsers()`, etc. (Optional — internal naming is up to you.)

### Step 5: UI strings

Page titles, breadcrumbs, navigation menu items — generally these should still say "Users" to the human reader (it's friendlier than "CMS Users" in a backoffice that already knows it's CMS). The rename is about disambiguation between teams/databases, not user-facing copy. Use judgment — if your app already shows "CMS Users" in headers, keep it; if it shows "Users", that's still fine.

### Step 6: Test the impact

- Login + `/me/permissions` — verify the array contains `CMS_USER_*` not `USER_*`
- List CMS users — `GET /cms-users` should work; `GET /users` should 404
- Invite flow — `POST /cms-users/invite` should send the OTP email
- Role assignment — `POST /cms-users/{userId}/roles` and `GET /roles/{id}/cms-users` should work
- Permission-gated UI — confirm buttons/menu items hidden by missing `CMS_USER_*` permissions stay hidden, and visible to roles that have them

---

## Backend deploy gating (info only)

The backend ships this rename in one PR. There is **no compatibility shim** — `/users` returns 404 immediately after deploy. Frontend must be deployed at the same time as (or just after) backend, or admins lose access to the user-management UI.

The kinko_db permission-code SQL migration (`UPDATE permissions SET code = 'CMS_' || code WHERE code LIKE 'USER_%'`) must apply to the DB **before** the renamed backend boots, or `@RequiresPermission("CMS_USER_*")` checks will fail to find permissions for currently-granted roles, locking out admins.

Coordinate the deploy as: **kinko_db migration → backend deploy → frontend deploy**. Tight window.

---

## Quick reference: full diff at a glance

Backend renames (informational, frontend doesn't see these but they're in the OpenAPI tags):

```
Java package:    com.insurance.backoffice.user → com.insurance.backoffice.cmsuser
Class:           UserController              → CmsUserController
Class:           UserService                 → CmsUserService
Class:           UserRoleController          → CmsUserRoleController
Class:           UserRoleService             → CmsUserRoleService
Class:           UserRequest (DTO)           → CmsUserRequest
Class:           UserResponse (DTO)          → CmsUserResponse
Class:           UpdateUserRequest (DTO)     → CmsUserUpdateRequest
Class:           InviteUserRequest (DTO)     → CmsUserInviteRequest
@Tag:            "Users"                     → "CMS Users"
@Tag:            "User Roles"                → "CMS User Roles"
@Auditable entity: "User"                    → "CmsUser"
```

Frontend-visible (the actual contract):

```
Route prefix:           /users          → /cms-users
Route prefix:           /roles/{id}/users → /roles/{id}/cms-users
Permission codes:       USER_*          → CMS_USER_*
Error code:             USER_NOT_FOUND  → CMS_USER_NOT_FOUND
Audit entityType:       "User"          → "CmsUser"
```

---

## Questions / blockers

If anything is unclear, the source-of-truth is the backend repo:

- Backend routes are defined in `kinko-backoffice-backend/src/main/java/com/insurance/backoffice/cmsuser/CmsUserController.java` and `CmsUserRoleController.java`.
- Permission code list is in `RbacSeeder.java` and documented in `.docs/source-of-truth/permissions-catalog.md`.
- Full feature spec: `.docs/features/02-cms-user-management.md`.
