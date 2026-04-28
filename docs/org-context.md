> Last Updated: 2026-04-22

# Org Context

> How the active organization is determined, how to switch orgs, and how the frontend communicates org context to the backend.

---

## How Org Context Is Resolved (Backend)

The backend resolves the active org in this priority order:

```
1. X-ORG-ID header     → if present, use it (validates user has access)
2. Host header slug    → extract slug from subdomain (e.g. "acme" from "acme.mydomain.com"), look up org
3. User's single org   → if user belongs to exactly one org (from DB), use that
4. No context          → 400 if multi-org user and no context provided
```

**Frontend rule:** Always send `X-ORG-ID` when you know the active org. The subdomain fallback works in production but `X-ORG-ID` is explicit, debuggable, and works everywhere including localhost.

---

## What to Put in X-ORG-ID

Send the org's **UUID** (not the slug):

```
X-ORG-ID: 550e8400-e29b-41d4-a716-446655440000
```

The backend validates that the requesting user has access to that org before accepting the context.

---

## Login Response Shape

The login endpoint (`POST /auth/login/password` or `POST /auth/login/otp`) returns:

```ts
type LoginResponse = {
  success: boolean
  data: {
    userId: string
    email: string
    currentOrgId: string | null  // null for super admins and TPPs
    orgs: Array<{
      id: string    // UUID — this is what goes in X-ORG-ID
      name: string  // display name for the picker pill
      slug: string  // for production subdomain navigation
    }>
  }
}
```

**Single-org user** (Org Admin, Regular Admin):
```json
{
  "data": {
    "userId": "...",
    "email": "alice@acme.com",
    "currentOrgId": "uuid-acme",
    "orgs": [{ "id": "uuid-acme", "name": "Acme Corp", "slug": "acme" }]
  }
}
```
→ `currentOrgId` is set. Skip the org picker. Set `X-ORG-ID = currentOrgId` and navigate to dashboard.

**Multi-org user** (Super Admin, TPP):
```json
{
  "data": {
    "userId": "...",
    "email": "tpp@provider.com",
    "currentOrgId": null,
    "orgs": [
      { "id": "uuid-acme",   "name": "Acme Corp", "slug": "acme" },
      { "id": "uuid-globex", "name": "Globex Inc", "slug": "globex" }
    ]
  }
}
```
→ `currentOrgId` is null. Show org picker before navigating to dashboard.

---

## Org Picker — Initial Selection

For multi-org users, show a fullscreen org selection step after login (before the dashboard):

```ts
function handleLoginResponse(data: LoginResponse['data']) {
  if (data.currentOrgId) {
    // Single-org user — go straight in
    setActiveOrg(data.orgs[0])
    apiClient.defaults.headers.common['X-ORG-ID'] = data.currentOrgId
    navigate('/dashboard')
  } else {
    // Multi-org — show picker
    navigate('/select-org', { state: { orgs: data.orgs } })
  }
}
```

---

## Org Switcher Pill (Persistent in Nav)

For multi-org users, render a **persistent dropdown pill** in the top navbar after they enter the dashboard. This allows switching orgs without logging out.

**What the pill shows:** `org.name` (human-readable)
**What it sends in the header:** `org.id` (UUID)

```ts
// Pill component behaviour
function switchOrg(org: OrgSummary) {
  setActiveOrg(org)                                           // update global state
  apiClient.defaults.headers.common['X-ORG-ID'] = org.id    // update API client header
  navigate('/dashboard')                                      // reset view to new org context
}
```

**Important:** Switching the pill changes the `X-ORG-ID` header on every subsequent request. The backend will return data scoped only to the newly selected org — users, roles, members, everything. The UI must reset any loaded data when the org changes to avoid showing stale data from the previous org.

For single-org users, do not show the switcher pill at all — they have no orgs to switch to.

In production, you can additionally navigate to `https://org.slug.mydomain.com` on switch. Both approaches work because `X-ORG-ID` takes precedence over the subdomain and the cookie is shared across `*.mydomain.com`.

---

## TPP: Different Roles in Different Orgs

A third-party provider (TPP) user can be assigned different roles in different orgs. This is natively supported:

```
cms_user_roles table:
  tpp-user-id  →  role-in-acme   (permissions: MEMBER_READ)
  tpp-user-id  →  role-in-globex (permissions: MEMBER_READ, MEMBER_CREATE, BULK_UPLOAD)
```

When the TPP switches the pill from Acme to Globex:
1. Frontend sets `X-ORG-ID: uuid-globex`
2. Backend resolves org context from the header
3. `AuthorizationService` queries `cms_user_roles → roles → role_permissions` filtered by `orgId = uuid-globex`
4. The TPP now has a different effective permission set
5. All API responses and permission guards operate against Globex's data only

**The frontend does not need to know the TPP's permissions per org upfront.** Permission failures return `403 FORBIDDEN`. The UI should handle this gracefully (e.g. hide actions that return 403, or catch them and show a "not allowed in this org" message).

If you need to know permissions before rendering UI (to show/hide buttons proactively), add a `GET /me/permissions` endpoint — but this is not implemented yet. For now, optimistic rendering + 403 handling is the pattern.

---

## Setting X-ORG-ID in the API Client

```ts
// After login / org selection
apiClient.defaults.headers.common['X-ORG-ID'] = activeOrg.id

// On org switch
apiClient.defaults.headers.common['X-ORG-ID'] = newOrg.id

// On logout — clear it
delete apiClient.defaults.headers.common['X-ORG-ID']
```

---

## Error Codes for Org Context

| errorCode | HTTP | Meaning | What to do |
|-----------|------|---------|-----------|
| `INVALID_ORG_CONTEXT` | 403 | User has no access to the org in `X-ORG-ID` | Redirect to org picker |
| `INACTIVE_ORG` | 403 | The org is suspended or deactivated | Show "org unavailable" page |
| `ORG_NOT_FOUND` | 404 | The org ID does not exist | Redirect to org picker |
| `FORBIDDEN` | 403 | User lacks the required permission in this org | Show "not allowed" message or hide action |
