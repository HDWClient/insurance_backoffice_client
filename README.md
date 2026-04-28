# InsureHub

A role-based insurance management portal built with **React 19**, **React Router v7**, and **Vite**.

---

## Getting Started

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`

---

## Login Credentials

### Super Admin
| Field        | Value        |
|--------------|--------------|
| Organization | `hdw`        |
| Username     | `admin` |
| Password     | `superadmin` |

> Access via: `/#/admin/login`

### Regular Users (TPA / Org Admin / Agent / Viewer)
Created by the Super Admin from the **Users** tab.

> Access via: `/#/login`

---

## Routes

| Route                | Page                   | Access              |
|----------------------|------------------------|---------------------|
| `/#/`                | Redirect to login      | —                   |
| `/#/login`           | User Login             | Public              |
| `/#/admin/login`     | Super Admin Login      | Public              |
| `/#/admin/dashboard` | Super Admin Dashboard  | Super Admin only    |
| `/#/dashboard`       | Role Dashboard         | Logged-in user only |

Protected routes redirect to their respective login page if unauthenticated.

---

## Project Structure

```
src/
├── App.jsx                          # Route definitions
├── main.jsx                         # Entry — HashRouter + AppProvider
│
├── constants/
│   └── roles.js                     # ROLES, PERMISSIONS, ROLE_PERMISSIONS matrix
│
├── context/
│   └── AppContext.jsx               # Global state — users, orgs, sessions (localStorage)
│
├── routes/
│   ├── AdminRoute.jsx               # Protects /admin/dashboard
│   └── UserRoute.jsx                # Protects /dashboard
│
├── components/
│   ├── SuperAdminLogin/             # HDW-only admin login
│   ├── SuperAdminDashboard/         # Tabs: Organizations · Users · Access Control
│   ├── UserLogin/                   # Login for TPA / Org Admin / Agent / Viewer
│   ├── RoleDashboard/               # Sidebar dashboard — content filtered by role
│   ├── RoleAccess/                  # Permission matrix — super admin grants rights
│   └── PermissionGate/             # Gate component + hooks
│
├── store/                           # Redux (loginSlice — available for API auth)
└── utils/
    └── AxiosUtils.js                # Axios instance with Bearer token interceptor
```

---

## Roles & Default Permissions

| Permission         | Super Admin | TPA | Org Admin | Agent | Viewer |
|--------------------|:-----------:|:---:|:---------:|:-----:|:------:|
| Manage Orgs        | ✓           |     |           |       |        |
| Manage Users       | ✓           |     | ✓         |       |        |
| View Users         | ✓           |     | ✓         |       |        |
| View Policies      | ✓           | ✓   | ✓         | ✓     | ✓      |
| Manage Policies    | ✓           |     | ✓         | ✓     |        |
| View Claims        | ✓           | ✓   | ✓         | ✓     | ✓      |
| Process Claims     | ✓           | ✓   | ✓         |       |        |
| View Reports       | ✓           | ✓   | ✓         |       | ✓      |
| Manage Settings    | ✓           |     | ✓         |       |        |

> Permissions can be customised per user from the **Access Control** tab.

---

## Super Admin Dashboard

### Organizations Tab
- Create organizations with name, code, admin email, and plan (Basic / Professional / Enterprise)
- View and delete organizations

### Users Tab
- Create users with role, username, password, and organization
- Each user row shows current permission count and a **Custom** badge if permissions differ from role defaults
- **🔑 N rights** button opens a per-user permission editor modal

### Access Control Tab
- Full permission matrix: users as rows, 9 permissions as columns
- **Column header checkbox** — toggle a permission for all visible users at once
- **Row checkbox** — toggle all permissions for a single user (indeterminate state supported)
- **Default dot** indicator marks each cell that matches the role's default
- **Yellow left border** on rows with unsaved changes
- **Save** per row or **Save All** in the header
- **↺ Reset** restores a user to their role's default permissions
- Search and role filter to narrow the user list

---

## Role Dashboard (User View)

Sidebar items are shown or hidden based on the logged-in user's effective permissions:

| Nav Item  | Required Permission  |
|-----------|----------------------|
| Overview  | — (always visible)   |
| Policies  | `view_policies`      |
| Claims    | `view_claims`        |
| Users     | `view_users`         |
| Reports   | `view_reports`       |
| Settings  | `manage_settings`    |

The **Claims** table shows approve/reject buttons only for users with `process_claims`.
The **Policies** page shows a **+ New Policy** button only for users with `manage_policies`.

---

## PermissionGate Component

**`src/components/PermissionGate/index.jsx`**

### Components

```jsx
// Show content only when user has the permission
<PermissionGate permission="process_claims">
  <ApproveButton />
</PermissionGate>

// Require ALL permissions
<PermissionGate permissions={["manage_users", "view_users"]}>
  <UserPanel />
</PermissionGate>

// Match any of the given roles
<PermissionGate roles={["tpa", "org_admin"]}>
  <ClaimsSection />
</PermissionGate>

// With fallback UI
<PermissionGate permission="view_reports" fallback={<UpgradePrompt />}>
  <ReportsPage />
</PermissionGate>

// Show when user LACKS a permission (locked/upgrade state)
<DeniedGate permission="manage_orgs">
  <LockedFeatureBanner />
</DeniedGate>
```

### Hooks

```js
const canProcess = usePermission("process_claims");   // boolean
const isTPA      = useRole("tpa", "org_admin");       // boolean
const allPerms   = usePermissions();                  // string[]
```

> Super Admin always passes every gate and hook check.

---

## State Persistence

| Data           | Storage          | Cleared on        |
|----------------|------------------|-------------------|
| Organizations  | `localStorage`   | Manual clear      |
| Users          | `localStorage`   | Manual clear      |
| User session   | `localStorage`   | Logout            |
| Admin session  | `sessionStorage` | Browser tab close |

---

## Tech Stack

| Library          | Version | Purpose                       |
|------------------|---------|-------------------------------|
| React            | 19      | UI                            |
| React Router DOM | 7       | Hash-based routing            |
| Redux Toolkit    | 2       | Auth slice (API integration)  |
| Axios            | latest  | HTTP client with interceptors |
| Vite             | 8       | Build tool                    |
