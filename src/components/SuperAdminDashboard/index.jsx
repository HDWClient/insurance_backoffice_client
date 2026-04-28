import { useState, useEffect } from "react";
import * as userService from "../../services/userService";
import * as roleService from "../../services/roleService";
import { getRoleUsers, bulkRevokeRoleUsers } from "../../services/roleService";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchOrgs,
  fetchOrg,
  createOrg as apiCreateOrg,
  updateOrg as apiUpdateOrg,
  suspendOrg as apiSuspendOrg,
  activateOrg as apiActivateOrg,
  deleteOrg as apiDeleteOrg,
  clearSelectedOrg,
} from "../../store/slices/orgSlice";
import {
  fetchUsers,
  fetchUserRoles,
  inviteUser as apiInviteUser,
  deleteUser as apiDeleteUser,
  assignRole as apiAssignRole,
  revokeRole as apiRevokeRole,
} from "../../store/slices/userSlice";
import {
  fetchRoles,
  fetchPermissions,
  createRole as apiCreateRole,
  deleteRole as apiDeleteRole,
  renameRole as apiRenameRole,
  addPermissionToRole,
  removePermissionFromRole,
} from "../../store/slices/roleSlice";
import { fetchMyPermissions } from "../../store/slices/meSlice";
import { useApp } from "../../context/AppContext";
import kinkoLogo from "../../assets/kinkologo1.png";
import "./styles.css";

/* ─────────────────────────────────────────────────────────── */
/*  ORG module tab                                             */
/*  - Reading orgs: requires ORG_READ permission              */
/*  - Create / update / suspend / delete: super admin only    */
/*  - Org-level admins: read-only, see only their own org     */
/* ─────────────────────────────────────────────────────────── */
function OrgModuleTab({ actions, can }) {
  const dispatch = useDispatch();
  const {
    orgs = [],
    loading,
    errorCode,
    selectedOrg,
    selectedOrgLoading,
    selectedOrgError,
  } = useSelector((s) => s.orgs);

  // Permission flags — driven entirely by /me/permissions response
  const canRead    = actions.has("READ")   || actions.has("MANAGE") || can("ORG_READ");
  const canCreate  = actions.has("CREATE") || actions.has("MANAGE") || can("ORG_CREATE");
  const canUpdate  = actions.has("UPDATE") || actions.has("MANAGE") || can("ORG_UPDATE");
  const canSuspend = actions.has("MANAGE") || can("ORG_SUSPEND");
  const canDelete  = actions.has("DELETE") || actions.has("MANAGE") || can("ORG_DELETE");
  const hasWriteActions = canCreate || canUpdate || canSuspend || canDelete;

  // Create-form state
  const [name, setName]     = useState("");
  const [slug, setSlug]     = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Expand panel state
  const [expandedId, setExpandedId]   = useState(null);
  const [expandMode, setExpandMode]   = useState("view"); // "view" | "edit"
  const [editName, setEditName]       = useState("");
  const [editSaving, setEditSaving]   = useState(false);
  const [actioning, setActioning]     = useState(null);

  useEffect(() => { dispatch(fetchOrgs()); }, [dispatch]);
  useEffect(() => () => { dispatch(clearSelectedOrg()); }, [dispatch]);

  const openPanel = (org, mode) => {
    if (expandedId === org.id && expandMode === mode) {
      // same button clicked again → close
      setExpandedId(null);
      dispatch(clearSelectedOrg());
    } else {
      setExpandedId(org.id);
      setExpandMode(mode);
      if (mode === "edit") setEditName(org.name);
      dispatch(fetchOrg(org.id));
    }
  };

  const closePanel = () => {
    setExpandedId(null);
    dispatch(clearSelectedOrg());
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setEditSaving(true);
    const res = await dispatch(apiUpdateOrg({ id: expandedId, name: editName.trim() }));
    setEditSaving(false);
    if (apiUpdateOrg.fulfilled.match(res)) closePanel();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = "Required";
    if (!slug.trim()) errs.slug = "Required";
    else if (!/^[a-z0-9-]{2,50}$/.test(slug))
      errs.slug = "Lowercase letters, numbers and hyphens only (2–50 chars)";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    await dispatch(apiCreateOrg({ name: name.trim(), slug: slug.trim() }));
    setName(""); setSlug(""); setErrors({});
    setSaving(false);
  };

  const handleToggleSuspend = async (org) => {
    setActioning(org.id);
    const isSuspended = org.status === "suspended" || org.status === "inactive";
    const res = isSuspended
      ? await dispatch(apiActivateOrg(org.id))
      : await dispatch(apiSuspendOrg(org.id));
    setActioning(null);
    if (apiActivateOrg.fulfilled.match(res) || apiSuspendOrg.fulfilled.match(res)) closePanel();
  };

  const handleDelete = async (orgId) => {
    setActioning(orgId);
    await dispatch(apiDeleteOrg(orgId));
    setActioning(null);
  };

  return (
    <div className="tab-content">

      {/* Read-only notice when user has no write permissions */}
      {canRead && !hasWriteActions && (
        <div className="org-readonly-banner">
          You have read-only access to your organization. Contact an admin to make changes.
        </div>
      )}

      {/* Create Organization */}
      {canCreate && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Create Organization</h2>
          </div>
          <div className="card__body">
            <form className="form" onSubmit={handleCreate} noValidate>

              {saving ? (
                /* ── Shimmer skeleton while submitting ── */
                <>
                  <div className="create-org-form__fields">
                    <div className="form__field">
                      <div className="shimmer-box" style={{ height: 12, width: 55, marginBottom: 8, borderRadius: 4 }} />
                      <div className="shimmer-box" style={{ height: 42 }} />
                    </div>
                    <div className="form__field">
                      <div className="shimmer-box" style={{ height: 12, width: 80, marginBottom: 8, borderRadius: 4 }} />
                      <div className="shimmer-box" style={{ height: 42 }} />
                    </div>
                  </div>
                  <div className="create-org-form__footer">
                    <div className="shimmer-box" style={{ height: 34, width: 90, borderRadius: 7 }} />
                  </div>
                </>
              ) : (
                /* ── Form fields ── */
                <>
                  <div className="create-org-form__fields">
                    <div className="form__field">
                      <label className="form__label">Name *</label>
                      <input
                        className={`form__input${errors.name ? " form__input--err" : ""}`}
                        value={name} placeholder="Acme Corp"
                        onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                      />
                      {errors.name && <span className="form__err">{errors.name}</span>}
                    </div>
                    <div className="form__field">
                      <label className="form__label">
                        Slug *{" "}
                        <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#64748b" }}>
                          immutable
                        </span>
                      </label>
                      <input
                        className={`form__input${errors.slug ? " form__input--err" : ""}`}
                        value={slug} placeholder="acme-corp"
                        onChange={(e) => { setSlug(e.target.value.toLowerCase()); setErrors((p) => ({ ...p, slug: "" })); }}
                      />
                      {errors.slug && <span className="form__err">{errors.slug}</span>}
                    </div>
                  </div>
                  <div className="create-org-form__footer">
                    <button className="btn btn--primary btn--sm btn--create-shimmer" type="submit">
                      + Create
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
        </div>
      )}

      {/* Organizations list */}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            Organizations
            <span className="card__count">{orgs.length}</span>
          </h2>
          {!hasWriteActions && (
            <span className="expand-panel__readonly">Read only</span>
          )}
        </div>

        {errorCode && (
          <p className="status status--error" style={{ padding: "12px 24px" }}>
            Failed to load ({errorCode})
          </p>
        )}

        {loading && orgs.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
        ) : orgs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <p className="empty-state__text">No organizations found.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Default</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const isActioning  = actioning === org.id;
                const isExpanded   = expandedId === org.id;
                const viewActive   = isExpanded && expandMode === "view";
                const editActive   = isExpanded && expandMode === "edit";

                return (
                  <>
                  <tr key={org.id}>
                    <td><span className="tbl__bold">{org.name}</span></td>

                    <td className="tbl__mono">{org.slug}</td>

                    <td>
                      <span className={`badge badge--${org.status ?? "active"}`}>
                        {org.status ?? "active"}
                      </span>
                    </td>

                    <td>
                      {org.isDefault
                        ? <span className="badge badge--system">Default</span>
                        : <span className="tbl__muted">—</span>}
                    </td>

                    <td className="tbl__muted">
                      {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}
                    </td>

                    <td>
                      <div className="tbl__actions">
                        {/* View — read-only detail panel */}
                        <button
                          className={`btn btn--ghost btn--sm${viewActive ? " btn--active" : ""}`}
                          onClick={() => openPanel(org, "view")}
                        >
                          {viewActive ? "Close" : "View"}
                        </button>

                        {/* Edit — editable panel (canUpdate only) */}
                        {canUpdate && (
                          <button
                            className={`btn btn--ghost btn--sm${editActive ? " btn--active" : ""}`}
                            onClick={() => openPanel(org, "edit")}
                          >
                            {editActive ? "Close" : "Edit"}
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            className="btn btn--danger btn--sm"
                            disabled={isActioning}
                            onClick={() => handleDelete(org.id)}
                          >
                            {isActioning ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── View / Edit panel ── */}
                  {isExpanded && (
                    <tr key={`${org.id}-panel`} className="expand-row">
                      <td colSpan={6}>
                        <div className="expand-panel">
                          <div className="expand-panel__header">
                            <span className="expand-panel__title">
                              {expandMode === "edit" ? "Edit Organization" : "Organization Detail"} — <strong>{org.name}</strong>
                            </span>
                            {expandMode === "view" && (
                              <span className="expand-panel__readonly">Read only</span>
                            )}
                          </div>

                          <div className="expand-panel__body">
                            {selectedOrgLoading && <p className="status">Loading…</p>}

                            {selectedOrgError && (
                              <div className="error-banner">
                                <span>⚠</span>
                                {selectedOrgError === "NOT_FOUND" || selectedOrgError === "FORBIDDEN"
                                  ? "You do not have access to this organization's details."
                                  : `Failed to load (${selectedOrgError})`}
                              </div>
                            )}

                            {!selectedOrgLoading && !selectedOrgError && selectedOrg?.id === org.id && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                                {/* ── Info grid ── */}
                                <div className="org-detail-grid">
                                  <div className="org-detail-item">
                                    <span className="org-detail-label">ID</span>
                                    <span className="org-detail-value tbl__mono">{selectedOrg.id}</span>
                                  </div>
                                  <div className="org-detail-item">
                                    <span className="org-detail-label">Slug</span>
                                    <span className="org-detail-value tbl__mono">{selectedOrg.slug}</span>
                                  </div>
                                  <div className="org-detail-item">
                                    <span className="org-detail-label">Status</span>
                                    <span className={`badge badge--${selectedOrg.status ?? "active"}`}>
                                      {selectedOrg.status ?? "active"}
                                    </span>
                                  </div>
                                  <div className="org-detail-item">
                                    <span className="org-detail-label">Default</span>
                                    <span className="org-detail-value">
                                      {selectedOrg.isDefault
                                        ? <span className="badge badge--system">Yes</span>
                                        : <span className="tbl__muted">No</span>}
                                    </span>
                                  </div>
                                  <div className="org-detail-item">
                                    <span className="org-detail-label">Created</span>
                                    <span className="org-detail-value tbl__muted">
                                      {selectedOrg.createdAt
                                        ? new Date(selectedOrg.createdAt).toLocaleString()
                                        : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* ── Edit form (edit mode only) ── */}
                                {expandMode === "edit" && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div style={{ height: 1, background: "#1e3a5f" }} />

                                    {/* Name */}
                                    <div className="form__field">
                                      <label className="form__label">Name</label>
                                      <input
                                        className="form__input"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                                      />
                                    </div>

                                    {/* Status toggle — shown for any user with canUpdate */}
                                    <div className="form__field">
                                      <label className="form__label">Status</label>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span className={`badge badge--${selectedOrg.status ?? "active"}`}>
                                          {selectedOrg.status ?? "active"}
                                        </span>
                                        <button
                                          className="btn btn--ghost btn--sm"
                                          style={
                                            selectedOrg.status === "suspended" || selectedOrg.status === "inactive"
                                              ? { borderColor: "#166534", color: "#34d399" }
                                              : { borderColor: "#4c1d95", color: "#a78bfa" }
                                          }
                                          disabled={isActioning}
                                          onClick={() => handleToggleSuspend(selectedOrg)}
                                        >
                                          {isActioning
                                            ? "…"
                                            : selectedOrg.status === "suspended" || selectedOrg.status === "inactive"
                                              ? "Activate"
                                              : "Suspend"}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Save name */}
                                    <div>
                                      <button
                                        className="btn btn--primary btn--sm"
                                        disabled={editSaving || !editName.trim() || editName.trim() === selectedOrg.name}
                                        onClick={handleSave}
                                      >
                                        {editSaving ? "Saving…" : "Save Changes"}
                                      </button>
                                    </div>
                                  </div>
                                )}

                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  USER module tab                                            */
/* ─────────────────────────────────────────────────────────── */
function UserModuleTab({ actions, can }) {
  const dispatch = useDispatch();
  const { items: users = [], loading, totalItems, userRoles = {} } = useSelector((s) => s.users);
  const { roles = [] } = useSelector((s) => s.roles);

  const canCreate = (actions.has("CREATE") || actions.has("MANAGE")) && can("USER_CREATE");
  const canDelete = (actions.has("DELETE") || actions.has("MANAGE")) && can("USER_DELETE");

  const [fullName, setFullName]         = useState("");
  const [email, setEmail]               = useState("");
  const [inviteRole, setInviteRole]     = useState("");
  const [errors, setErrors]             = useState({});
  const [saving, setSaving]             = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState({});
  const [assigning, setAssigning]       = useState(false);
  const [assignErr, setAssignErr]       = useState("");
  const [deleteUserErr, setDeleteUserErr] = useState("");

  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchUsers()).then((res) => {
      if (fetchUsers.fulfilled.match(res))
        (res.payload?.items ?? []).forEach((u) => dispatch(fetchUserRoles(u.id)));
    });
  }, [dispatch]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!fullName.trim()) errs.fullName = "Required";
    if (!email.trim())    errs.email    = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setInviteSuccess("");

    // Step 1 — POST /users/invite
    const inviteRes = await dispatch(apiInviteUser({ fullName: fullName.trim(), email: email.trim() }));

    if (apiInviteUser.rejected.match(inviteRes)) {
      setErrors((p) => ({ ...p, email: inviteRes.payload ?? "Invite failed" }));
      setSaving(false);
      return;
    }

    const newUserId = inviteRes.payload?.id;

    // Step 3 — POST /users/{newUserId}/roles if a role was selected
    if (newUserId && inviteRole) {
      await dispatch(apiAssignRole({ userId: newUserId, roleId: inviteRole }));
      dispatch(fetchUserRoles(newUserId));
    }

    const roleName = roles.find((r) => r.id === inviteRole)?.name;
    setInviteSuccess(
      roleName
        ? `${fullName.trim()} invited and assigned role "${roleName}".`
        : `${fullName.trim()} invited successfully.`
    );

    setFullName(""); setEmail(""); setInviteRole(""); setErrors({});
    setSaving(false);
  };

  const toggleExpand = (userId) => {
    setExpandedUser((p) => (p === userId ? null : userId));
    setAssignErr("");
  };

  const handleAssign = async (userId) => {
    const roleId = selectedRole[userId];
    if (!roleId) return;
    setAssigning(true); setAssignErr("");
    const res = await dispatch(apiAssignRole({ userId, roleId }));
    if (apiAssignRole.rejected.match(res)) setAssignErr(res.payload ?? "Failed — check permissions");
    else dispatch(fetchUserRoles(userId));
    setAssigning(false);
  };

  const handleRevoke = async (userId, roleId) => {
    const res = await dispatch(apiRevokeRole({ userId, roleId }));
    if (apiRevokeRole.fulfilled.match(res)) dispatch(fetchUserRoles(userId));
  };

  const initial = (u) => (u.fullName || u.email || "?")[0].toUpperCase();

  return (
    <div className="tab-content">

      {/* ── Invite User ─────────────────────────────────────── */}
      {canCreate && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Invite User</h2>
          </div>
          <div className="card__body">

            {inviteSuccess && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", marginBottom: 14,
                background: "#0f2e1a", border: "1px solid #166534",
                borderRadius: 8, color: "#34d399", fontSize: 13,
              }}>
                <span>✓ {inviteSuccess}</span>
                <button onClick={() => setInviteSuccess("")}
                  style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            )}

            <form className="form" onSubmit={handleInvite} noValidate>
              <div className="form__row">
                {/* Step 1 fields */}
                <div className="form__field">
                  <label className="form__label">Full Name *</label>
                  <input className={`form__input${errors.fullName ? " form__input--err" : ""}`}
                    value={fullName} placeholder="Jane Doe"
                    onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: "" })); }} />
                  {errors.fullName && <span className="form__err">{errors.fullName}</span>}
                </div>
                <div className="form__field">
                  <label className="form__label">Email *</label>
                  <input className={`form__input${errors.email ? " form__input--err" : ""}`}
                    value={email} placeholder="jane@org.com" type="email"
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} />
                  {errors.email && <span className="form__err">{errors.email}</span>}
                </div>
                {/* Step 2 — pick role to assign after invite */}
                <div className="form__field">
                  <label className="form__label">
                    Assign Role
                    <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#64748b", marginLeft: 4 }}>
                      optional
                    </span>
                  </label>
                  <select
                    className="form__input form__select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
                  {saving ? "Inviting…" : "+ Invite User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Users List ──────────────────────────────────────── */}
      {deleteUserErr && (
        <div className="error-banner" style={{ marginBottom: 12, justifyContent: "space-between" }}>
          <span>⚠ {deleteUserErr}</span>
          <button onClick={() => setDeleteUserErr("")}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            Users
            <span className="card__count">{totalItems ?? users.length}</span>
          </h2>
        </div>

        {loading && users.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <p className="empty-state__text">No users yet</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Org</th>
                <th>Joined</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const assigned = userRoles[u.id] ?? [];
                const isOpen   = expandedUser === u.id;

                return (
                  <>
                    <tr key={u.id} className={isOpen ? "ut-row--open" : ""}>
                      {/* User identity */}
                      <td>
                        <div className="ut-user-cell">
                          <div className="ut-avatar">{initial(u)}</div>
                          <div className="ut-user-info">
                            <span className="ut-user-name">{u.fullName || "—"}</span>
                            <span className="ut-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`badge badge--${u.status}`}>{u.status ?? "—"}</span>
                      </td>

                      <td className="tbl__muted">{u.orgSlug || "—"}</td>

                      <td className="tbl__muted">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>

                      {/* Role chips preview */}
                      <td>
                        {assigned.length === 0 ? (
                          <span className="tbl__muted">No roles</span>
                        ) : (
                          <div className="ut-role-chips">
                            {assigned.slice(0, 2).map((r) => (
                              <span key={r.id} className={`badge ${r.systemRole ? "badge--system" : "badge--custom"}`}>
                                {r.name}
                              </span>
                            ))}
                            {assigned.length > 2 && (
                              <span className="ut-role-more">+{assigned.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions — always shown */}
                      <td>
                        <div className="tbl__actions">
                          <button
                            className={`btn btn--ghost btn--sm${isOpen ? " btn--active" : ""}`}
                            onClick={() => toggleExpand(u.id)}
                          >
                            {isOpen ? "Close" : "Roles"}
                          </button>
                          {canDelete && !u.isSuperAdmin && (
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={async () => {
                                setDeleteUserErr("");
                                const res = await dispatch(apiDeleteUser(u.id));
                                if (apiDeleteUser.rejected.match(res)) {
                                  setDeleteUserErr(
                                    res.payload === "SELF_DELETE"
                                      ? "You cannot delete your own account."
                                      : `Delete failed: ${res.payload ?? "Unknown error"}`
                                  );
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Role assignment panel ── */}
                    {isOpen && (
                      <tr key={`${u.id}-roles`} className="expand-row">
                        <td colSpan={6}>
                          <div className="expand-panel">
                            <div className="expand-panel__header">
                              <div className="ut-avatar ut-avatar--sm">{initial(u)}</div>
                              <span className="expand-panel__title">
                                Role Assignments — <strong>{u.fullName || u.email}</strong>
                              </span>
                            </div>

                            <div className="expand-panel__body">
                              <div className="ut-roles-layout">

                                {/* Left: assigned roles */}
                                <div className="ut-roles-section">
                                  <p className="users-panel__section-label">
                                    Assigned Roles
                                    {assigned.length > 0 && (
                                      <span className="card__count" style={{ marginLeft: 8 }}>{assigned.length}</span>
                                    )}
                                  </p>
                                  {assigned.length === 0 ? (
                                    <div className="ut-roles-empty">
                                      <span style={{ fontSize: 22, opacity: 0.4 }}>🎭</span>
                                      <span>No roles assigned yet</span>
                                    </div>
                                  ) : (
                                    <div className="ut-assigned-list">
                                      {assigned.map((r) => (
                                        <div key={r.id} className="ut-role-row">
                                          <div className="ut-role-row__info">
                                            <span className="ut-role-row__name">{r.name}</span>
                                            <div className="ut-role-row__badges">
                                              <span className={`badge badge--${r.organizationId ? "org" : "global"}`}>
                                                {r.organizationId ? "Org" : "Global"}
                                              </span>
                                              <span className={`badge ${r.systemRole ? "badge--system" : "badge--custom"}`}>
                                                {r.systemRole ? "System" : "Custom"}
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => handleRevoke(u.id, r.id)}
                                          >
                                            Revoke
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Divider */}
                                <div className="ut-roles-divider" />

                                {/* Right: assign new role */}
                                <div className="ut-roles-section">
                                  <p className="users-panel__section-label">Assign New Role</p>
                                  {assignErr && (
                                    <div className="error-banner" style={{ marginBottom: 12 }}>
                                      <span>⚠</span> {assignErr}
                                    </div>
                                  )}
                                  <div className="form__field" style={{ marginBottom: 12 }}>
                                    <label className="form__label">Select Role</label>
                                    <select
                                      className="form__input form__select"
                                      value={selectedRole[u.id] ?? ""}
                                      onChange={(e) => {
                                        setAssignErr("");
                                        setSelectedRole((p) => ({ ...p, [u.id]: e.target.value }));
                                      }}
                                    >
                                      <option value="">— Choose a role —</option>
                                      {roles.map((r) => (
                                        <option
                                          key={r.id} value={r.id}
                                          disabled={assigned.some((ar) => ar.id === r.id)}
                                        >
                                          {r.name}{assigned.some((ar) => ar.id === r.id) ? " (assigned)" : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <button
                                    className="btn btn--primary btn--sm"
                                    disabled={assigning || !selectedRole[u.id] || assigned.some((ar) => ar.id === selectedRole[u.id])}
                                    onClick={() => handleAssign(u.id)}
                                  >
                                    {assigning ? "Assigning…" : "Assign Role"}
                                  </button>
                                </div>

                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  ROLE module tab                                            */
/*  Calls GET /roles on mount (tab click).                    */
/*  Renders one section per action from /me/permissions:      */
/*    MANAGE → create / list / rename / delete / permissions  */
/*    ASSIGN → assign role to user / revoke                   */
/* ─────────────────────────────────────────────────────────── */
function RoleModuleTab({ actions, can }) {
  const dispatch = useDispatch();
  const { roles, permissions, loading: rolesLoading } = useSelector((s) => s.roles);
  const { items: users, userRoles }                   = useSelector((s) => s.users);
  const { currentUser }                               = useApp();

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleErr,  setNewRoleErr]  = useState("");
  const [creating,    setCreating]    = useState(false);
  const [renaming,    setRenaming]    = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [deleteErr,   setDeleteErr]   = useState({});
  const [deleteInfo,  setDeleteInfo]  = useState(null); // success acknowledgment
  const [forceDeleting, setForceDeleting] = useState(null);

  /* ── fetch on mount ──────────────────────────────────────── */
  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchPermissions());
    dispatch(fetchUsers()).then((res) => {
      if (fetchUsers.fulfilled.match(res))
        (res.payload?.items ?? []).forEach((u) => dispatch(fetchUserRoles(u.id)));
    });
  }, [dispatch]);

  /* ── helpers ──────────────────────────────────────────────── */
  const openPanel = (roleId, panel) =>
    setExpanded((p) => p?.roleId === roleId && p?.panel === panel ? null : { roleId, panel });

  const getUsersForRole = (roleId) =>
    Object.entries(userRoles)
      .filter(([, list]) => list.some((r) => r.id === roleId))
      .map(([uid]) => users.find((u) => u.id === uid))
      .filter(Boolean);

  const permsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  /* ── handlers ────────────────────────────────────────────── */
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) { setNewRoleErr("Required"); return; }
    setCreating(true);
    await dispatch(apiCreateRole(newRoleName.trim()));
    setNewRoleName(""); setNewRoleErr(""); setCreating(false);
  };

  const handleRename = async (role) => {
    if (!renaming?.value.trim() || renaming.value === role.name) { setRenaming(null); return; }
    await dispatch(apiRenameRole({ id: role.id, name: renaming.value.trim() }));
    setRenaming(null);
  };

  const togglePermission = (role, perm) => {
    const has = (role.permissions ?? []).some((p) => p.id === perm.id);
    if (has) dispatch(removePermissionFromRole({ roleId: role.id, permId: perm.id }));
    else     dispatch(addPermissionToRole({ roleId: role.id, permissionId: perm.id }));
  };

  const handleDelete = async (roleId) => {
    setDeleteErr((p) => ({ ...p, [roleId]: null }));
    setDeleteInfo(null);
    setForceDeleting(roleId);
    try {
      // Step 1 — confirm role exists and is not a system role
      const allRoles = await roleService.listRoles();
      const role = allRoles.find((r) => r.id === roleId);
      if (!role) {
        setDeleteErr((p) => ({ ...p, [roleId]: "Role not found." }));
        return;
      }
      if (role.systemRole) {
        setDeleteErr((p) => ({ ...p, [roleId]: "System roles cannot be deleted." }));
        return;
      }

      // Step 2 — GET /roles/{roleId}/users → list of all users holding this role
      const assignedUsers = await getRoleUsers(roleId);
      const userIds = (Array.isArray(assignedUsers) ? assignedUsers : [])
        .map((u) => u.id ?? u.userId)
        .filter(Boolean);

      // Step 3 — bulk-revoke all assignments in one shot
      if (userIds.length > 0) {
        const revokeRes = await bulkRevokeRoleUsers(roleId, userIds);
        const notFound = revokeRes?.notFound ?? [];
        if (notFound.length > 0) {
          setDeleteErr((p) => ({
            ...p,
            [roleId]: `Revoke incomplete — ${notFound.length} user(s) not found: ${notFound.join(", ")}`,
          }));
          return;
        }
      }

      // Step 4 — DELETE /roles/{roleId} — now succeeds with no active assignments
      const del = await dispatch(apiDeleteRole(roleId));
      if (apiDeleteRole.fulfilled.match(del)) {
        if (expanded?.roleId === roleId) setExpanded(null);
        setDeleteInfo(
          userIds.length > 0
            ? `Role deleted. ${userIds.length} assignment${userIds.length > 1 ? "s" : ""} were revoked automatically.`
            : "Role deleted successfully."
        );
      } else {
        setDeleteErr((p) => ({ ...p, [roleId]: del.payload ?? "DELETE_FAILED" }));
      }
    } catch (err) {
      setDeleteErr((p) => ({ ...p, [roleId]: err?.response?.data?.errorCode ?? "DELETE_FAILED" }));
    } finally {
      setForceDeleting(null);
    }
  };

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="tab-content">

      {/* ── Delete acknowledgment banner ── */}
      {deleteInfo && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16,
          background: "#0f2e1a", border: "1px solid #166534",
          borderRadius: 8, color: "#34d399", fontSize: 13,
        }}>
          <span>✓ {deleteInfo}</span>
          <button onClick={() => setDeleteInfo(null)}
            style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── Create Role (only when user has create permission) ── */}
      {(actions.has("CREATE") || actions.has("MANAGE")) && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Create Role</h2>
          </div>
          <div className="card__body">
            <form className="form" onSubmit={handleCreate} noValidate>
              <div className="form__inline">
                <div className="form__field">
                  <label className="form__label">Role Name</label>
                  <input className={`form__input${newRoleErr ? " form__input--err" : ""}`}
                    value={newRoleName} placeholder="e.g. Compliance Officer"
                    onChange={(e) => { setNewRoleName(e.target.value); setNewRoleErr(""); }} />
                  {newRoleErr && <span className="form__err">{newRoleErr}</span>}
                </div>
                <button className="btn btn--primary btn--sm" type="submit" disabled={creating}>
                  {creating ? "Creating…" : "+ Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Roles List ───────────────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            All Roles
            <span className="card__count">{roles.length}</span>
          </h2>
        </div>

        {rolesLoading && roles.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading roles…</p></div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎭</div>
            <p className="empty-state__text">No roles yet</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Role</th><th>Scope</th><th>Type</th>
                <th>Permissions</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const isSystem   = !!role.systemRole;
                const scope      = role.organizationId ? "ORG" : "GLOBAL";
                const isRenaming = renaming?.id === role.id;
                const permOpen   = expanded?.roleId === role.id && expanded?.panel === "permissions";

                return (
                  <>
                    <tr key={role.id}>
                      {/* Role name / inline rename */}
                      <td>
                        {isRenaming ? (
                          <div className="rename-row">
                            <input className="form__input" autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ id: role.id, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(role); if (e.key === "Escape") setRenaming(null); }}
                            />
                            <button className="btn btn--ghost btn--sm" onClick={() => handleRename(role)}>Save</button>
                            <button className="btn btn--ghost btn--sm" onClick={() => setRenaming(null)}>✕</button>
                          </div>
                        ) : (
                          <span className="tbl__bold">{role.name}</span>
                        )}
                      </td>

                      <td><span className={`badge badge--${scope.toLowerCase()}`}>{scope}</span></td>
                      <td><span className={`badge ${isSystem ? "badge--system" : "badge--custom"}`}>{isSystem ? "System" : "Custom"}</span></td>

                      <td>
                        {(role.permissions ?? []).length === 0
                          ? <span className="tbl__muted">—</span>
                          : <>
                            {(role.permissions ?? []).slice(0, 3).map((p) => <span key={p.id} className="perm-chip">{p.code}</span>)}
                            {(role.permissions ?? []).length > 3 && <span className="perm-chip">+{(role.permissions ?? []).length - 3}</span>}
                          </>
                        }
                      </td>

                      {/* Action buttons */}
                      <td>
                        <div className="tbl__actions">
                          {!isSystem && !isRenaming && (
                            <button className="btn btn--ghost btn--sm"
                              onClick={() => setRenaming({ id: role.id, value: role.name })}>
                              Edit
                            </button>
                          )}
                          <button className={`btn btn--ghost btn--sm${permOpen ? " btn--active" : ""}`}
                            onClick={() => openPanel(role.id, "permissions")}>
                            Permissions
                          </button>
                          {!isSystem && (
                            forceDeleting === role.id ? (
                              <span className="tbl__muted" style={{ fontSize: 12 }}>Revoking & deleting…</span>
                            ) : (
                              <button className="btn btn--danger btn--sm"
                                onClick={() => handleDelete(role.id)}>
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Delete error row (non-assignment errors only) ── */}
                    {deleteErr[role.id] && (
                      <tr key={`${role.id}-derr`}>
                        <td colSpan={5} style={{ padding: "0 16px 12px", borderBottom: "none" }}>
                          <div className="error-banner">
                            <span>⚠</span>
                            <span>Delete failed: {deleteErr[role.id]}</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ── Permissions panel ── */}
                    {permOpen && (
                      <tr key={`${role.id}-p`} className="expand-row">
                        <td colSpan={5}>
                          <div className="expand-panel">
                            <div className="expand-panel__header">
                              <span className="expand-panel__title">
                                Permissions — <strong>{role.name}</strong>
                              </span>
                              {isSystem && <span className="expand-panel__readonly">System — read only</span>}
                            </div>
                            <div className="expand-panel__body">
                              {Object.keys(permsByModule).length === 0 ? (
                                <p className="status">No permissions loaded.</p>
                              ) : (
                                Object.entries(permsByModule).map(([mod, perms]) => (
                                  <div key={mod} className="perm-section">
                                    <div className="perm-section__label">{mod}</div>
                                    <div className="perm-grid">
                                      {perms.map((perm) => {
                                        const checked = (role.permissions ?? []).some((p) => p.id === perm.id);
                                        return (
                                          <label key={perm.id}
                                            className={`perm-toggle${checked ? " perm-toggle--on" : ""}${isSystem ? " perm-toggle--disabled" : ""}`}>
                                            <input type="checkbox" checked={checked} disabled={isSystem}
                                              onChange={() => !isSystem && togglePermission(role, perm)} />
                                            {perm.code}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Generic fallback tab — for modules with no mapped API yet */
/* ─────────────────────────────────────────────────────────── */
function GenericModuleTab({ module, actions }) {
  const MODULE_ICONS = {
    AUDIT: "🔍", REPORT: "📊", NOTIFICATION: "🔔", SYSTEM: "⚙️",
    POLICY: "📋", CLAIM: "🗂️", PAYMENT: "💳", DOCUMENT: "📄",
  };
  const icon = MODULE_ICONS[module] ?? "🧩";

  return (
    <div className="tab-content">
      {/* Module header */}
      <div className="generic-tab__hero">
        <div className="generic-tab__hero-icon">{icon}</div>
        <div>
          <div className="generic-tab__hero-title">{module}</div>
          <div className="generic-tab__hero-sub">
            {actions.size} permission{actions.size !== 1 ? "s" : ""} assigned to your account
          </div>
        </div>
      </div>

      {/* Permission cards */}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            Granted Permissions
            <span className="card__count">{actions.size}</span>
          </h2>
        </div>
        <div className="card__body">
          <div className="generic-tab__perm-grid">
            {[...actions].map((action) => (
              <div key={action} className="generic-tab__perm-card">
                <div className="generic-tab__perm-code">{module}_{action}</div>
                <span className={`action-badge action-badge--${action.toLowerCase()}`}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Route module → component                                   */
/* ─────────────────────────────────────────────────────────── */
function ModuleTab({ module, actions, can }) {
  if (module === "ORG")  return <OrgModuleTab  actions={actions} can={can} />;
  if (module === "USER") return <UserModuleTab actions={actions} can={can} />;
  if (module === "ROLE") return <RoleModuleTab actions={actions} can={can} />;
  return <GenericModuleTab module={module} actions={actions} />;
}

/* ─────────────────────────────────────────────────────────── */
/*  Org dropdown (header)                                      */
/* ─────────────────────────────────────────────────────────── */
function OrgDropdown() {
  const { currentUser, activeOrg, switchOrg } = useApp();
  const dispatch = useDispatch();
  // Prefer Redux orgs (full list from GET /orgs); fall back to login payload orgs
  const reduxOrgs = useSelector((s) => s.orgs?.orgs ?? []);
  const orgs = reduxOrgs.length > 0 ? reduxOrgs : (currentUser?.orgs ?? []);
  const [open, setOpen] = useState(false);

  // Find Kinco/default org: isDefault flag first, then by name, then first in list
  const findDefault = (list) =>
    list.find((o) => o.isDefault) ?? list.find((o) => o.name === "Kinko") ?? list[0];

  // Ensure the full org list is loaded
  useEffect(() => { dispatch(fetchOrgs()); }, [dispatch]);

  // Auto-select Kinko when no org is active yet
  useEffect(() => {
    if (!activeOrg && orgs.length > 0) {
      switchOrg(findDefault(orgs));
    }
  }, [orgs, activeOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!orgs || orgs.length === 0) return null;

  const selected = activeOrg ?? findDefault(orgs);

  if (orgs.length === 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" }}>
        <span>🏢</span>
        <span>{selected.name}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }} onBlur={() => setOpen(false)} tabIndex={-1}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#0f172a", border: "1px solid #334155",
          borderRadius: 8, padding: "6px 12px",
          color: "#e2e8f0", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <span>🏢</span>
        <span>{selected.name}</span>
        {selected.isDefault && (
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>default</span>
        )}
        <span style={{ fontSize: 9, color: "#64748b" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#1e293b", border: "1px solid #334155",
          borderRadius: 10, minWidth: 220,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          zIndex: 50, padding: 4,
        }}>
          {orgs.map((org) => {
            const isActive = (selected?.id) === org.id;
            return (
              <button
                key={org.id}
                onMouseDown={() => { switchOrg(org); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", background: isActive ? "#1e3a5f" : "none",
                  border: "none", borderRadius: 7, cursor: "pointer",
                  fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#93c5fd" : "#e2e8f0" }}>
                    {org.name}
                    {org.isDefault && (
                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400, marginLeft: 6 }}>
                        default
                      </span>
                    )}
                  </div>
                  {org.slug && (
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", marginTop: 1 }}>
                      {org.slug}
                    </div>
                  )}
                </div>
                {isActive && <span style={{ color: "#3b82f6", fontWeight: 700 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Dashboard shell                                            */
/* ─────────────────────────────────────────────────────────── */
const EXCLUDED_MODULES = new Set(["MEMBER", "DEPENDENT"]);

const MODULE_LABELS = {
  ORG:  "Organizations",
  USER: "Manage Users",
  ROLE: "Manage Roles",
  BULK: "Operations",
};

export default function SuperAdminDashboard() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { currentUser, logoutSuperAdmin, activeOrg } = useApp();
  const {
    permissions: rawPerms,
    loading: meLoading,
    errorCode: meError,
  } = useSelector((s) => s.me ?? {});
  const myPermissions = Array.isArray(rawPerms) ? rawPerms : [];

  const [activeTab, setActiveTab] = useState(null);

  // Fetch /me/permissions on mount
  useEffect(() => {
    dispatch(fetchMyPermissions());
  }, [dispatch]);

  // Re-fetch /me/permissions and reset tab selection whenever the org changes
  useEffect(() => {
    if (!activeOrg?.id) return;
    dispatch(fetchMyPermissions());
    setActiveTab(null); // will auto-select first tab once new permissions arrive
  }, [activeOrg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build module → Set<action> from the normalised permissions
  const moduleActionMap = myPermissions.reduce((acc, { module, action } = {}) => {
    if (!module) return acc;
    if (!acc[module]) acc[module] = new Set();
    acc[module].add(action);
    return acc;
  }, {});

  const modules = Object.keys(moduleActionMap)
    .filter((m) => !EXCLUDED_MODULES.has(m))
    .sort();

  // can("ROLE_MANAGE") → true if user holds that permission code
  const can = (code) => myPermissions.some((p) => p.code === code);

  // Auto-select first tab once permissions load
  useEffect(() => {
    if (!activeTab && modules.length > 0) setActiveTab(modules[0]);
  }, [modules]);

  const handleLogout = () => {
    logoutSuperAdmin();
    navigate("/admin/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "inherit" }}>

      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 60,
        background: "#1e293b", borderBottom: "1px solid #334155",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={kinkoLogo}
            alt="Kinko"
            style={{
              height: 34,
              objectFit: "contain",
              background: "#f1f5f9",
              borderRadius: 10,
              padding: "8px 20px",
              display: "block",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OrgDropdown />
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{currentUser?.email ?? ""}</span>
          <button onClick={handleLogout} style={{
            background: "none", border: "1px solid #334155", color: "#94a3b8",
            borderRadius: 7, padding: "6px 14px", fontSize: 13, cursor: "pointer",
          }}>Logout</button>
        </div>
      </header>

      {/* Tab bar — dynamic, one per module */}
      <div style={{
        display: "flex", background: "#0d1424",
        borderBottom: "2px solid #1e3a5f",
        padding: "0 32px", overflowX: "auto",
      }}>
        {meLoading ? (
          <span style={{ padding: "16px 0", fontSize: 13, color: "#475569" }}>
            Loading permissions…
          </span>
        ) : meError ? (
          <span style={{ padding: "16px 0", fontSize: 13, color: "#f87171" }}>
            ⚠ Failed to load permissions ({meError})
          </span>
        ) : modules.length === 0 ? (
          <span style={{ padding: "16px 0", fontSize: 13, color: "#475569" }}>
            No permissions assigned to your account.
          </span>
        ) : (
          modules.map((m) => (
            <button key={m} onClick={() => setActiveTab(m)}
              style={{
                background: activeTab === m ? "#1e3a5f" : "none",
                border: "none",
                borderBottom: activeTab === m ? "3px solid #3b82f6" : "3px solid transparent",
                color: activeTab === m ? "#60a5fa" : "#94a3b8",
                fontWeight: activeTab === m ? 600 : 400,
                fontSize: 14, padding: "14px 22px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                transition: "all 0.15s", marginBottom: -2,
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {MODULE_LABELS[m] ?? m}
            </button>
          ))
        )}
      </div>

      {/* Tab content */}
      <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
        {activeTab && (
          <ModuleTab
            key={`${activeOrg?.id ?? "default"}-${activeTab}`}
            module={activeTab}
            actions={moduleActionMap[activeTab] ?? new Set()}
            can={can}
          />
        )}
      </div>
    </div>
  );
}
