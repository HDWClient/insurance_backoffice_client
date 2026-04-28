import { useApp } from "../../context/AppContext";
import { hasPermission, ROLE_PERMISSIONS, PERMISSIONS } from "../../constants/roles";

// Resolves effective permissions: custom overrides take precedence over role defaults
const getEffectivePermissions = (currentUser) => {
  if (!currentUser) return [];
  return currentUser.permissions ?? ROLE_PERMISSIONS[currentUser.role] ?? [];
};

/**
 * Renders children only if the current user has the required permission/role.
 *
 * Props:
 *   permission  {string}    – single permission key
 *   permissions {string[]}  – ALL of these must be present
 *   roles       {string[]}  – ANY of these roles matches
 *   fallback    {ReactNode} – rendered when access is denied (default: null)
 */
export default function PermissionGate({ permission, permissions = [], roles = [], fallback = null, children }) {
  const { currentUser, isSuperAdmin } = useApp();

  if (isSuperAdmin) return children;
  if (!currentUser) return fallback;

  const effectivePerms = getEffectivePermissions(currentUser);

  if (roles.length > 0 && !roles.includes(currentUser.role)) return fallback;
  if (permission && !effectivePerms.includes(permission)) return fallback;
  if (permissions.length > 0 && !permissions.every((p) => effectivePerms.includes(p))) return fallback;

  return children;
}

/**
 * Renders children only when the user LACKS the permission (locked/upgrade UI).
 */
export function DeniedGate({ permission, roles = [], children, fallback = null }) {
  const { currentUser, isSuperAdmin } = useApp();

  if (isSuperAdmin) return fallback;
  if (!currentUser) return children;

  const effectivePerms = getEffectivePermissions(currentUser);
  if (roles.length > 0 && roles.includes(currentUser.role)) return fallback;
  if (permission && effectivePerms.includes(permission)) return fallback;

  return children;
}

/** Returns true if the current user has the given permission. */
export function usePermission(permission) {
  const { currentUser, isSuperAdmin } = useApp();
  if (isSuperAdmin) return true;
  if (!currentUser) return false;
  return getEffectivePermissions(currentUser).includes(permission);
}

/** Returns true if the current user matches any of the given roles. */
export function useRole(...roles) {
  const { currentUser, isSuperAdmin } = useApp();
  if (isSuperAdmin) return true;
  if (!currentUser) return false;
  return roles.includes(currentUser.role);
}

/** Returns the full effective permission list for the current user. */
export function usePermissions() {
  const { currentUser, isSuperAdmin } = useApp();
  if (isSuperAdmin) return Object.values(PERMISSIONS);
  if (!currentUser) return [];
  return getEffectivePermissions(currentUser);
}
