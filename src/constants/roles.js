export const ROLES = {
  SUPER_ADMIN: "super_admin",
  TPA: "tpa",
  ORG_ADMIN: "org_admin",
  AGENT: "agent",
  VIEWER: "viewer",
};

export const PERMISSIONS = {
  MANAGE_ORGS: "manage_orgs",
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  VIEW_POLICIES: "view_policies",
  MANAGE_POLICIES: "manage_policies",
  VIEW_CLAIMS: "view_claims",
  PROCESS_CLAIMS: "process_claims",
  VIEW_REPORTS: "view_reports",
  MANAGE_SETTINGS: "manage_settings",
};

export const PERMISSION_LABELS = {
  manage_orgs:      { label: "Manage Organizations", group: "Admin" },
  manage_users:     { label: "Manage Users",          group: "Admin" },
  view_users:       { label: "View Users",            group: "Admin" },
  view_policies:    { label: "View Policies",         group: "Policies" },
  manage_policies:  { label: "Manage Policies",       group: "Policies" },
  view_claims:      { label: "View Claims",           group: "Claims" },
  process_claims:   { label: "Process Claims",        group: "Claims" },
  view_reports:     { label: "View Reports",          group: "Reports" },
  manage_settings:  { label: "Manage Settings",       group: "Settings" },
};

export const ROLE_PERMISSIONS = {
  super_admin: Object.values(PERMISSIONS),
  tpa: [
    PERMISSIONS.VIEW_POLICIES,
    PERMISSIONS.VIEW_CLAIMS,
    PERMISSIONS.PROCESS_CLAIMS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  org_admin: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_POLICIES,
    PERMISSIONS.MANAGE_POLICIES,
    PERMISSIONS.VIEW_CLAIMS,
    PERMISSIONS.PROCESS_CLAIMS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS,
  ],
  agent: [
    PERMISSIONS.VIEW_POLICIES,
    PERMISSIONS.MANAGE_POLICIES,
    PERMISSIONS.VIEW_CLAIMS,
  ],
  viewer: [
    PERMISSIONS.VIEW_POLICIES,
    PERMISSIONS.VIEW_CLAIMS,
    PERMISSIONS.VIEW_REPORTS,
  ],
};

export const ROLE_LABELS = {
  super_admin: "Super Admin",
  tpa:         "Third Party Admin",
  org_admin:   "Org Admin",
  agent:       "Agent",
  viewer:      "Viewer",
};

export const ROLE_COLORS = {
  super_admin: { bg: "#1e3a5f", color: "#60a5fa" },
  tpa:         { bg: "#3b1f5e", color: "#a78bfa" },
  org_admin:   { bg: "#1c3a2e", color: "#34d399" },
  agent:       { bg: "#422006", color: "#fdba74" },
  viewer:      { bg: "#1e2b3b", color: "#94a3b8" },
};

// Checks custom permissions first, falls back to role defaults
export const hasPermission = (role, permission, customPermissions = null) => {
  if (customPermissions) return customPermissions.includes(permission);
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
