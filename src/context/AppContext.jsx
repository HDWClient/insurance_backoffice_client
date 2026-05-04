import { createContext, useContext, useState } from "react";
import { setActiveOrg } from "../utils/AxiosUtils";
import * as authService from "../services/authService";

const AppContext = createContext(null);

export const DEFAULT_ORG = {
  id: "kinco-default",
  name: "Kinco",
  code: "KINCO",
  adminName: "Super Admin",
  adminEmail: "admin@kinco.in",
  plan: "enterprise",
  createdAt: "Built-in",
  isDefault: true,
};

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export function AppProvider({ children }) {
  const [orgs, setOrgs]           = useState(() => {
    const stored = load("ih_orgs", []);
    const hasKinco = stored.some((o) => o.id === DEFAULT_ORG.id);
    return hasKinco ? stored : [DEFAULT_ORG, ...stored];
  });
  const [users, setUsers]         = useState(() => load("ih_users", []));
  const [customRoles, setCustomRoles] = useState(() => load("ih_custom_roles", []));
  const [currentUser, setCurrentUser] = useState(() => load("ih_session_user", null));
  const [activeOrg, setActiveOrgState] = useState(() => {
    const u = load("ih_session_user", null);
    if (!u) return null;
    const org = u.orgs?.find((o) => o.id === u.currentOrgId) ?? u.orgs?.[0] ?? null;
    if (org) setActiveOrg(org.id);
    return org;
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => {
    if (sessionStorage.getItem("ih_sa") === "1") return true;
    const u = load("ih_session_user", null);
    return u?.isSuperAdmin === true;
  });

  // ── Org management (local, super admin only) ───────────────
  const createOrg = (org) => {
    const next = [{ ...org, id: Date.now(), createdAt: new Date().toLocaleDateString() }, ...orgs];
    setOrgs(next);
    save("ih_orgs", next.filter((o) => !o.isDefault));
  };

  const deleteOrg = (id) => {
    if (id === DEFAULT_ORG.id) return;
    const next = orgs.filter((o) => o.id !== id);
    setOrgs(next);
    save("ih_orgs", next.filter((o) => !o.isDefault));
  };

  // ── User management (local, super admin only) ──────────────
  const createUser = (user) => {
    const next = [{ ...user, id: Date.now(), createdAt: new Date().toLocaleDateString() }, ...users];
    setUsers(next);
    save("ih_users", next);
  };

  const deleteUser = (id) => {
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    save("ih_users", next);
  };

  const createRole = (role) => {
    const next = [{ ...role, id: Date.now(), createdAt: new Date().toLocaleDateString(), isCustom: true }, ...customRoles];
    setCustomRoles(next);
    save("ih_custom_roles", next);
  };

  const deleteRole = (id) => {
    const next = customRoles.filter((r) => r.id !== id);
    setCustomRoles(next);
    save("ih_custom_roles", next);
  };

  const updateUserPermissions = (id, permissions) => {
    const next = users.map((u) => u.id === id ? { ...u, permissions } : u);
    setUsers(next);
    save("ih_users", next);
    if (currentUser?.id === id) {
      const updated = { ...currentUser, permissions };
      setCurrentUser(updated);
      save("ih_session_user", updated);
    }
  };

  // Called by UserLogin after a successful loginAsync dispatch
  // Syncs the Redux payload into AppContext session state
  const setSessionFromApi = (payload) => {
    const org = payload.activeOrg ?? null;
    if (org) setActiveOrg(org.id);
    setActiveOrgState(org);
    setCurrentUser(payload);
    save("ih_session_user", payload);
  };

  const switchOrg = (org) => {
    setActiveOrg(org.id);
    setActiveOrgState(org);
    const updated = { ...currentUser, currentOrgId: org.id };
    setCurrentUser(updated);
    save("ih_session_user", updated);
  };

  // ── Regular user login ─────────────────────────────────────
  const login = async (email, password) => {
    try {
      const { data, activeOrg } = await authService.loginWithPassword(email, password);
      setActiveOrgState(activeOrg);
      setCurrentUser(data);
      save("ih_session_user", data);
      return { ok: true };
    } catch (error) {
      const errorCode = error?.response?.data?.errorCode;
      const message = error?.response?.data?.message || "Login failed";
      return { ok: false, errorCode, message };
    }
  };

  const logout = async () => {
    await authService.logout();   // clears cookies + X-ORG-ID header
    setCurrentUser(null);
    setActiveOrgState(null);
    localStorage.removeItem("ih_session_user");
  };

  // ── Super admin login (local — HDW internal) ──────────────
  const loginSuperAdmin = () => {
    setIsSuperAdmin(true);
    sessionStorage.setItem("ih_sa", "1");
  };

  const logoutSuperAdmin = () => {
    setIsSuperAdmin(false);
    sessionStorage.removeItem("ih_sa");
  };

  return (
    <AppContext.Provider value={{
      orgs, users, customRoles, currentUser, activeOrg, isSuperAdmin,
      createOrg, deleteOrg, createUser, deleteUser, updateUserPermissions,
      createRole, deleteRole,
      setSessionFromApi, switchOrg, login, logout, loginSuperAdmin, logoutSuperAdmin,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
