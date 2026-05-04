import { useState, useEffect, useCallback, useRef } from "react";
import * as userService from "../../services/userService";
import * as roleService from "../../services/roleService";
import * as bulkService from "../../services/bulkService";
import * as consumerUserService from "../../services/consumerUserService";
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
  reviveUser as apiReviveUser,
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
  const [pendingStatus, setPendingStatus] = useState(null);
  const [actioning, setActioning]     = useState(null);

  useEffect(() => { dispatch(fetchOrgs()); }, [dispatch]);
  useEffect(() => () => { dispatch(clearSelectedOrg()); }, [dispatch]);

  const openPanel = (org, mode) => {
    if (expandedId === org.id && expandMode === mode) {
      setExpandedId(null);
      setPendingStatus(null);
      dispatch(clearSelectedOrg());
    } else {
      setExpandedId(org.id);
      setExpandMode(mode);
      if (mode === "edit") setEditName(org.name);
      setPendingStatus(null);
      dispatch(fetchOrg(org.id));
    }
  };

  const closePanel = () => {
    setExpandedId(null);
    setPendingStatus(null);
    dispatch(clearSelectedOrg());
  };

  const handleSave = async () => {
    if (!selectedOrg) return;
    const nameChanged   = editName.trim() && editName.trim() !== selectedOrg.name;
    const currentStatus = selectedOrg.status === "inactive" ? "suspended" : (selectedOrg.status ?? "active");
    const statusChanged = pendingStatus !== null && pendingStatus !== currentStatus;
    if (!nameChanged && !statusChanged) return;
    setEditSaving(true);
    if (nameChanged) await dispatch(apiUpdateOrg({ id: expandedId, name: editName.trim() }));
    if (statusChanged) {
      if (pendingStatus === "suspended") await dispatch(apiSuspendOrg(expandedId));
      else await dispatch(apiActivateOrg(expandedId));
    }
    setEditSaving(false);
    setPendingStatus(null);
    closePanel();
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
    const res = await dispatch(apiCreateOrg({ name: name.trim(), slug: slug.trim() }));
    if (apiCreateOrg.fulfilled.match(res)) { setName(""); setSlug(""); setErrors({}); }
    setSaving(false);
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

                                    {/* Status select */}
                                    <div className="form__field">
                                      <label className="form__label">Status</label>
                                      <select
                                        className="form__input"
                                        value={pendingStatus ?? (selectedOrg.status === "inactive" ? "suspended" : (selectedOrg.status ?? "active"))}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const cur = selectedOrg.status === "inactive" ? "suspended" : (selectedOrg.status ?? "active");
                                          setPendingStatus(val === cur ? null : val);
                                        }}
                                      >
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                      </select>
                                    </div>

                                    {/* Save */}
                                    <div>
                                      <button
                                        className="btn btn--primary btn--sm"
                                        disabled={
                                          editSaving ||
                                          (!pendingStatus && (!editName.trim() || editName.trim() === selectedOrg.name))
                                        }
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

  const canCreate = (actions.has("CREATE") || actions.has("MANAGE")) && can("CMS_USER_CREATE");
  const canDelete = (actions.has("DELETE") || actions.has("MANAGE")) && can("CMS_USER_DELETE");

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
  const [confirmAction, setConfirmAction] = useState(null); // { user, type: "toggle"|"delete" }
  const [confirming, setConfirming]      = useState(false);

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

    // Step 1 — POST /cms-users/invite
    const inviteRes = await dispatch(apiInviteUser({ fullName: fullName.trim(), email: email.trim() }));

    if (apiInviteUser.rejected.match(inviteRes)) {
      setErrors((p) => ({ ...p, email: inviteRes.payload ?? "Invite failed" }));
      setSaving(false);
      return;
    }

    const newUserId = inviteRes.payload?.id;

    // Step 3 — POST /cms-users/{newUserId}/roles if a role was selected
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
    await dispatch(apiRevokeRole({ userId, roleId }));
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { user: u, type } = confirmAction;
    setConfirming(true);
    if (u.status === "active" || type === "delete") {
      await dispatch(apiDeleteUser(u.id));
    } else {
      await dispatch(apiReviveUser(u.id));
    }
    setConfirming(false);
    setConfirmAction(null);
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
                        {canDelete && !u.isSuperAdmin && (u.status === "active" || u.status === "inactive") ? (
                          <button
                            className={`status-toggle${u.status === "active" ? " status-toggle--on" : " status-toggle--off"}`}
                            onClick={() => setConfirmAction({ user: u, type: "toggle" })}
                            title={u.status === "active" ? "Click to deactivate" : "Click to activate"}
                          >
                            <span className="status-toggle__track">
                              <span className="status-toggle__thumb" />
                            </span>
                            <span className="status-toggle__label">{u.status}</span>
                          </button>
                        ) : (
                          <span className={`badge badge--${u.status}`}>{u.status ?? "—"}</span>
                        )}
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

                      {/* Actions */}
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
                              onClick={() => setConfirmAction({ user: u, type: "delete" })}
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

      {/* ── Confirmation Modal ──────────────────────────────── */}
      {confirmAction && (
        <div className="uc-overlay" onClick={() => !confirming && setConfirmAction(null)}>
          <div className="uc-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`uc-modal__icon-wrap ${confirmAction.type === "delete" ? "uc-modal__icon-wrap--danger" : "uc-modal__icon-wrap--warn"}`}>
              {confirmAction.type === "delete" ? "🗑" : confirmAction.user.status === "active" ? "⏸" : "▶"}
            </div>

            <h3 className="uc-modal__title">
              {confirmAction.type === "delete"
                ? "Delete User?"
                : confirmAction.user.status === "active"
                  ? "Deactivate User?"
                  : "Activate User?"}
            </h3>

            <p className="uc-modal__body">
              {confirmAction.type === "delete"
                ? <>Are you sure you want to delete <strong>{confirmAction.user.fullName || confirmAction.user.email}</strong>? This cannot be undone.</>
                : confirmAction.user.status === "active"
                  ? <><strong>{confirmAction.user.fullName || confirmAction.user.email}</strong> will be deactivated and lose access.</>
                  : <><strong>{confirmAction.user.fullName || confirmAction.user.email}</strong> will be reactivated and regain access.</>}
            </p>

            <div className="uc-modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmAction(null)}
                disabled={confirming}
              >
                No, Cancel
              </button>
              <button
                className={`btn btn--sm ${confirmAction.type === "delete" ? "btn--danger" : "btn--primary"}`}
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming
                  ? "Please wait…"
                  : confirmAction.type === "delete"
                    ? "Yes, Delete"
                    : confirmAction.user.status === "active"
                      ? "Yes, Deactivate"
                      : "Yes, Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      // Step 2 — GET /roles/{roleId}/cms-users → list of all cms-users holding this role
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
              <div className="form__field">
                <label className="form__label">Role Name</label>
                <input className={`form__input${newRoleErr ? " form__input--err" : ""}`}
                  value={newRoleName} placeholder="e.g. Compliance Officer"
                  onChange={(e) => { setNewRoleName(e.target.value); setNewRoleErr(""); }} />
                {newRoleErr && <span className="form__err">{newRoleErr}</span>}
              </div>
              <div className="create-org-form__footer">
                <button className="btn btn--primary btn--sm btn--create-shimmer" type="submit" disabled={creating}>
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
/*  BULK module tab — CSV upload + job management (Operations) */
/* ─────────────────────────────────────────────────────────── */
const ROW_STATUSES = ["STAGED","OTP_SENT","VERIFIED","PROMOTED","REJECTED","EXPIRED","INVITE_FAILED","SUPERSEDED"];

function jobStatusClass(status) {
  return { PENDING: "badge--pending", PROCESSING: "badge--processing", COMPLETED: "badge--completed", FAILED: "badge--failed" }[status] ?? "badge--system";
}

function rowStatusClass(status) {
  return {
    STAGED: "badge--staged", OTP_SENT: "badge--otp-sent", VERIFIED: "badge--verified",
    PROMOTED: "badge--promoted", REJECTED: "badge--rejected", EXPIRED: "badge--expired",
    INVITE_FAILED: "badge--invite-failed", SUPERSEDED: "badge--superseded",
  }[status] ?? "badge--system";
}

function BulkModuleTab({ actions }) {
  const canUpload = actions.has("UPLOAD");
  const canRead   = actions.has("READ") || actions.has("UPLOAD");

  const [jobs, setJobs]               = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError]     = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const [detailJob, setDetailJob]           = useState(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [rows, setRows]                     = useState([]);
  const [rowsLoading, setRowsLoading]       = useState(false);
  const [rowFilter, setRowFilter]           = useState("STAGED");
  const [rowPage, setRowPage]               = useState(0);
  const [rowTotalPages, setRowTotalPages]   = useState(1);
  const [parseErrors, setParseErrors]       = useState(null);
  const [parseErrLoading, setParseErrLoading] = useState(false);
  const [showParseErrors, setShowParseErrors] = useState(false);
  const [resending, setResending]           = useState({});
  const [resendStatus, setResendStatus]     = useState({});

  const loadJobs = useCallback(async () => {
    if (!canRead) return;
    setJobsLoading(true);
    try {
      const data = await bulkService.listJobs();
      setJobs(data.items ?? []);
      setJobsError(null);
    } catch (err) {
      const status = err?.response?.status;
      const code   = err?.response?.data?.errorCode;
      setJobsError(
        status === 404 || code === "NOT_FOUND"
          ? "Backend bulk-upload feature not yet deployed"
          : code ?? "FETCH_FAILED"
      );
    } finally {
      setJobsLoading(false);
    }
  }, [canRead]);

  // Jobs are fetched only after an upload or manual Refresh — not on mount.
  // This avoids hitting /bulk before the backend has the endpoint.

  useEffect(() => {
    if (detailJob) return;
    const hasActive = jobs.some(j => j.status === "PENDING" || j.status === "PROCESSING");
    if (!hasActive) return;
    const id = setInterval(loadJobs, 2000);
    return () => clearInterval(id);
  }, [jobs, detailJob, loadJobs]);

  const loadRows = useCallback(async (jobId, status, pg) => {
    setRowsLoading(true);
    try {
      const data = await bulkService.getJobRows(jobId, { status, page: pg, size: 20 });
      setRows(data.items ?? []);
      setRowTotalPages(data.totalPages ?? 1);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailJob) return;
    loadRows(detailJob.id, rowFilter, rowPage);
  }, [detailJob?.id, rowFilter, rowPage, loadRows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detailJob) return;
    if (detailJob.status !== "PENDING" && detailJob.status !== "PROCESSING") return;
    const poll = async () => {
      try {
        const full = await bulkService.getJob(detailJob.id);
        setDetailJob(full);
        if (full.status === "COMPLETED" || full.status === "FAILED") {
          setRowPage(0);
          loadRows(full.id, rowFilter, 0);
        }
      } catch { /* poll failure silently ignored */ }
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [detailJob?.id, detailJob?.status, rowFilter, loadRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const job = await bulkService.uploadBulkFile(selectedFile);
      setUploadSuccess(`Job #${job.jobNumber} submitted for "${job.fileName}".`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadJobs();
    } catch (err) {
      const status = err?.response?.status;
      const code   = err?.response?.data?.errorCode;
      const msg    = err?.response?.data?.message;
      if (status === 404 || code === "NOT_FOUND") {
        setUploadError("Bulk upload endpoint not available on this backend. Please ensure the backend has deployed the bulk-upload feature (/bulk/upload).");
      } else if (code === "BULK_INVALID_FILE") {
        setUploadError(msg ?? "Invalid file — check format, size and header columns.");
      } else {
        setUploadError(msg ?? code ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
    }
  };

  const openDetail = async (job) => {
    setDetailJob(job);
    setDetailLoading(true);
    setRows([]); setRowPage(0); setRowFilter("STAGED");
    setParseErrors(null); setShowParseErrors(false);
    setResending({}); setResendStatus({});
    try {
      const full = await bulkService.getJob(job.id);
      setDetailJob(full);
    } catch { /* keep partial data on error */ } finally {
      setDetailLoading(false);
    }
  };

  const toggleParseErrors = async () => {
    if (!detailJob) return;
    if (parseErrors !== null) { setShowParseErrors(p => !p); return; }
    setParseErrLoading(true);
    try {
      const raw = await bulkService.getJobErrors(detailJob.id);
      const parsed = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
      setParseErrors(parsed);
      setShowParseErrors(true);
    } catch { setParseErrors([]); } finally { setParseErrLoading(false); }
  };

  const handleResend = async (rowId) => {
    if (!detailJob) return;
    setResending(p => ({ ...p, [rowId]: true }));
    setResendStatus(p => ({ ...p, [rowId]: null }));
    try {
      await bulkService.resendInvite(detailJob.id, rowId);
      setResendStatus(p => ({ ...p, [rowId]: "ok" }));
      loadRows(detailJob.id, rowFilter, rowPage);
    } catch (err) {
      setResendStatus(p => ({ ...p, [rowId]: err?.response?.data?.errorCode ?? "FAILED" }));
    } finally {
      setResending(p => ({ ...p, [rowId]: false }));
    }
  };

  /* ── DETAIL VIEW ── */
  if (detailJob) {
    const stats = detailJob.rowStats ?? {};
    return (
      <div className="tab-content">

        <div className="bulk-detail-header">
          <button className="btn btn--ghost btn--sm" onClick={() => setDetailJob(null)}>← Back to Jobs</button>
          <div className="bulk-detail-title">
            <span className="tbl__bold">Job #{detailJob.jobNumber}</span>
            <span className="tbl__muted" style={{ fontSize: 13 }}>{detailJob.fileName}</span>
            <span className={`badge ${jobStatusClass(detailJob.status)}`}>{detailJob.status}</span>
            {(detailJob.status === "PENDING" || detailJob.status === "PROCESSING") && (
              <span className="bulk-polling-dot" title="Polling for updates…" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title">
              Summary
              {detailLoading && <span className="tbl__muted" style={{ fontSize: 12 }}>Loading…</span>}
            </h2>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b" }}>
              <span>Total: <strong style={{ color: "#e2e8f0" }}>{detailJob.totalRows ?? "—"}</strong></span>
              <span>Parsed: <strong style={{ color: "#34d399" }}>{detailJob.parsedRows ?? "—"}</strong></span>
              <span>Invalid: <strong style={{ color: "#f87171" }}>{detailJob.invalidRows ?? "—"}</strong></span>
            </div>
          </div>
          <div className="card__body">
            <div className="bulk-stats-grid">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="bulk-stat-card">
                  <div className="bulk-stat-count">{v}</div>
                  <span className={`badge ${rowStatusClass(k)}`}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Rows</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ROW_STATUSES.map((s) => (
                <button
                  key={s}
                  className={`btn btn--ghost btn--sm${rowFilter === s ? " btn--active" : ""}`}
                  onClick={() => { setRowFilter(s); setRowPage(0); }}
                >
                  {s}
                  {stats[s] != null && <span style={{ marginLeft: 5, fontSize: 11, color: "#64748b" }}>{stats[s]}</span>}
                </button>
              ))}
            </div>
          </div>

          {rowsLoading && rows.length === 0 ? (
            <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <p className="empty-state__text">No rows with status {rowFilter}.</p>
            </div>
          ) : (
            <>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Mobile</th>
                    <th>Status</th><th>Invites Sent</th>
                    {canUpload && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isResending = resending[row.id];
                    const rStatus     = resendStatus[row.id];
                    const terminal    = ["PROMOTED","REJECTED","EXPIRED"].includes(row.status);
                    return (
                      <tr key={row.id}>
                        <td className="tbl__muted">{row.rowNumber}</td>
                        <td><span className="tbl__bold">{row.name || "—"}</span></td>
                        <td className="tbl__mono">{row.email || "—"}</td>
                        <td className="tbl__mono">{row.mobile || "—"}</td>
                        <td>
                          <span className={`badge ${rowStatusClass(row.status)}`}>{row.status}</span>
                          {row.rejectionReason && (
                            <div className="tbl__muted" style={{ fontSize: 11, marginTop: 3, maxWidth: 200 }}>
                              {row.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="tbl__muted">
                          {row.inviteSentCount ?? 0}×
                          {row.inviteLastSentAt ? ` (${new Date(row.inviteLastSentAt).toLocaleDateString()})` : ""}
                        </td>
                        {canUpload && (
                          <td>
                            {!terminal && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                                <button
                                  className="btn btn--ghost btn--sm"
                                  disabled={isResending}
                                  onClick={() => handleResend(row.id)}
                                >
                                  {isResending ? "Sending…" : "Resend"}
                                </button>
                                {rStatus === "ok" && <span style={{ fontSize: 11, color: "#34d399" }}>Sent!</span>}
                                {rStatus && rStatus !== "ok" && <span style={{ fontSize: 11, color: "#f87171" }}>{rStatus}</span>}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {rowTotalPages > 1 && (
                <div className="bulk-pagination">
                  <button className="btn btn--ghost btn--sm" disabled={rowPage === 0} onClick={() => setRowPage(p => p - 1)}>← Prev</button>
                  <span className="tbl__muted">Page {rowPage + 1} of {rowTotalPages}</span>
                  <button className="btn btn--ghost btn--sm" disabled={rowPage >= rowTotalPages - 1} onClick={() => setRowPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>

        {(detailJob.invalidRows ?? 0) > 0 && (
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                Parse Errors
                <span className="card__count">{detailJob.invalidRows}</span>
              </h2>
              <button className="btn btn--ghost btn--sm" onClick={toggleParseErrors} disabled={parseErrLoading}>
                {parseErrLoading ? "Loading…" : showParseErrors ? "Hide" : "Show"}
              </button>
            </div>
            {showParseErrors && (
              <div className="card__body">
                {(parseErrors ?? []).length === 0 ? (
                  <p className="status">No parse errors recorded.</p>
                ) : (
                  <div className="bulk-error-list">
                    {(parseErrors ?? []).map((e, i) => (
                      <div key={i} className="bulk-error-item">
                        <div className="bulk-error-row">
                          <span className="tbl__muted" style={{ whiteSpace: "nowrap" }}>Row {e.rowNumber}:</span>
                          <code className="bulk-error-raw">{e.rawLine}</code>
                        </div>
                        <div className="bulk-error-messages">
                          {(e.errors ?? []).map((msg, j) => (
                            <span key={j} className="bulk-error-msg">{msg}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── LIST VIEW ── */
  return (
    <div className="tab-content">

      {canUpload && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Upload CSV</h2>
          </div>
          <div className="card__body">
            {uploadSuccess && (
              <div className="bulk-success-banner">
                <span>✓ {uploadSuccess}</span>
                <button onClick={() => setUploadSuccess(null)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )}
            {uploadError && (
              <div className="error-banner" style={{ marginBottom: 14 }}>
                <span>⚠</span> {uploadError}
              </div>
            )}
            <div className="bulk-upload-zone">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                id="bulk-file-input"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <label htmlFor="bulk-file-input" className="bulk-upload-label">
                <span className="bulk-upload-icon">📄</span>
                <span className="bulk-upload-text">
                  {selectedFile ? selectedFile.name : "Click to choose a CSV file"}
                </span>
                {selectedFile && (
                  <span className="bulk-upload-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                )}
              </label>
              <div className="bulk-upload-meta">
                Required columns: <code>email</code>, <code>mobile</code>, <code>name</code> &nbsp;·&nbsp; Max 10 MB
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!selectedFile || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            Upload Jobs
            <span className="card__count">{jobs.length}</span>
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {jobs.some(j => j.status === "PENDING" || j.status === "PROCESSING") && (
              <span className="bulk-polling-dot" title="Polling for updates…" />
            )}
            <button className="btn btn--ghost btn--sm" onClick={loadJobs} disabled={jobsLoading}>
              {jobsLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {jobsError && (
          <p className="status status--error" style={{ padding: "12px 24px" }}>
            Failed to load ({jobsError})
          </p>
        )}

        {jobsLoading && jobs.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📂</div>
            <p className="empty-state__text">No upload jobs yet. Upload a CSV to get started.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>File</th><th>Status</th>
                <th>Total</th><th>Parsed</th><th>Invalid</th>
                <th>Submitted</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="tbl__muted">#{job.jobNumber}</td>
                  <td><span className="tbl__bold">{job.fileName}</span></td>
                  <td><span className={`badge ${jobStatusClass(job.status)}`}>{job.status}</span></td>
                  <td className="tbl__muted">{job.totalRows ?? "—"}</td>
                  <td className="tbl__muted">{job.parsedRows ?? "—"}</td>
                  <td className="tbl__muted">{job.invalidRows ?? "—"}</td>
                  <td className="tbl__muted">{job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}</td>
                  <td>
                    <button className="btn btn--ghost btn--sm" onClick={() => openDetail(job)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Consumer USER module tab — imported members from bulk      */
/* ─────────────────────────────────────────────────────────── */
function ConsumerUserModuleTab({ actions }) {
  const canRead   = actions.has("READ");
  const canUpdate = actions.has("UPDATE");

  const [stats, setStats]             = useState(null);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [totalItems, setTotalItems]   = useState(0);
  const [page, setPage]               = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId]   = useState(null);
  const [statusEdit, setStatusEdit]   = useState({});
  const [saving, setSaving]           = useState(null);
  const [saveErr, setSaveErr]         = useState(null);
  const searchTimeout = useRef(null);

  const loadStats = useCallback(async () => {
    if (!canRead) return;
    try { setStats(await consumerUserService.getConsumerUserStats()); } catch { /* silently ignored */ }
  }, [canRead]);

  const loadUsers = useCallback(async (q, st, pg) => {
    if (!canRead) return;
    setLoading(true);
    try {
      const data = await consumerUserService.listConsumerUsers({ search: q, status: st, page: pg, size: 20 });
      setUsers(data.items ?? []);
      setTotalItems(data.totalItems ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch { /* silently ignored */ } finally { setLoading(false); }
  }, [canRead]);

  useEffect(() => { loadStats(); loadUsers("", "", 0); }, [loadStats, loadUsers]);
  useEffect(() => () => clearTimeout(searchTimeout.current), []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(0); loadUsers(q, statusFilter, 0); }, 400);
  };

  const handleStatusFilter = (val) => {
    setStatusFilter(val); setPage(0); loadUsers(search, val, 0);
  };

  const handlePageChange = (pg) => { setPage(pg); loadUsers(search, statusFilter, pg); };

  const toggleExpand = (id) => {
    setExpandedId(p => p === id ? null : id);
    setSaveErr(null);
  };

  const handleStatusSave = async (user) => {
    const edit      = statusEdit[user.id] ?? {};
    const newStatus = edit.status ?? user.status;
    const reason    = edit.reason ?? "";
    if (newStatus === user.status && !reason) return;
    setSaving(user.id); setSaveErr(null);
    try {
      const updated = await consumerUserService.updateConsumerUserStatus(user.id, { status: newStatus, reason });
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
      setStatusEdit(p => { const n = { ...p }; delete n[user.id]; return n; });
      setExpandedId(null);
      loadStats();
    } catch (err) {
      setSaveErr(err?.response?.data?.errorCode ?? "UPDATE_FAILED");
    } finally { setSaving(null); }
  };

  const initial = (u) => (u.name || u.email || "?")[0].toUpperCase();

  return (
    <div className="tab-content">

      {stats && (
        <div className="cu-stats-row">
          {[
            { label: "Active",     val: stats.active,     cls: "badge--active" },
            { label: "Suspended",  val: stats.suspended,  cls: "badge--suspended" },
            { label: "Inactive",   val: stats.inactive,   cls: "badge--inactive" },
            { label: "Unverified", val: stats.unverified, cls: "badge--otp-sent" },
            { label: "Total",      val: stats.total,      cls: "badge--system" },
          ].map(({ label, val, cls }) => (
            <div key={label} className="cu-stat-card">
              <div className="cu-stat-val">{val ?? "—"}</div>
              <div className="cu-stat-label"><span className={`badge ${cls}`}>{label}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card__body" style={{ paddingBottom: 20 }}>
          <div className="cu-filter-bar">
            <div className="form__field" style={{ flex: 2 }}>
              <label className="form__label">Search by name</label>
              <input
                className="form__input"
                placeholder="Alice…"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div className="form__field" style={{ flex: 1 }}>
              <label className="form__label">Status</label>
              <select
                className="form__input form__select"
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            Members
            <span className="card__count">{totalItems}</span>
          </h2>
          <button className="btn btn--ghost btn--sm" onClick={() => loadUsers(search, statusFilter, page)} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {loading && users.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <p className="empty-state__text">No members found. Import some via the Operations tab.</p>
          </div>
        ) : (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Member</th><th>Mobile</th><th>Status</th>
                  <th>Source</th><th>Enrolled</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isOpen = expandedId === u.id;
                  const edit   = statusEdit[u.id] ?? {};
                  return (
                    <>
                      <tr key={u.id} className={isOpen ? "ut-row--open" : ""}>
                        <td>
                          <div className="ut-user-cell">
                            <div className="ut-avatar">{initial(u)}</div>
                            <div className="ut-user-info">
                              <span className="ut-user-name">{u.name || "—"}</span>
                              <span className="ut-user-email">{u.email || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="tbl__mono">{u.mobile || "—"}</td>
                        <td><span className={`badge badge--${u.status}`}>{u.status}</span></td>
                        <td className="tbl__muted">{u.source || u.registrationChannel || "—"}</td>
                        <td className="tbl__muted">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td>
                          <button
                            className={`btn btn--ghost btn--sm${isOpen ? " btn--active" : ""}`}
                            onClick={() => toggleExpand(u.id)}
                          >
                            {isOpen ? "Close" : canUpdate ? "Edit" : "View"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${u.id}-panel`} className="expand-row">
                          <td colSpan={6}>
                            <div className="expand-panel">
                              <div className="expand-panel__header">
                                <div className="ut-avatar ut-avatar--sm">{initial(u)}</div>
                                <span className="expand-panel__title">
                                  Profile — <strong>{u.name || u.email}</strong>
                                </span>
                                {!canUpdate && <span className="expand-panel__readonly">Read only</span>}
                              </div>
                              <div className="expand-panel__body">
                                <div className="cu-detail-grid">
                                  {[
                                    ["Email",   u.email],
                                    ["Mobile",  u.mobile],
                                    ["DOB",     u.dob],
                                    ["Gender",  u.gender],
                                    ["Pincode", u.pincode],
                                    ["City",    u.city],
                                    ["State",   u.state],
                                    ["PAN",     u.panNumber],
                                    ["Aadhaar", u.aadhaarLast4 ? `xxxx ${u.aadhaarLast4}` : null],
                                    ["Emp ID",  u.employeeId],
                                  ].filter(([, v]) => v).map(([label, val]) => (
                                    <div key={label} className="org-detail-item">
                                      <span className="org-detail-label">{label}</span>
                                      <span className="org-detail-value">{val}</span>
                                    </div>
                                  ))}
                                </div>

                                {canUpdate && (
                                  <div className="cu-status-edit">
                                    <div style={{ height: 1, background: "#1e3a5f", margin: "16px 0" }} />
                                    <p className="users-panel__section-label">Update Status</p>
                                    {saveErr && (
                                      <div className="error-banner" style={{ marginBottom: 12 }}>
                                        <span>⚠</span> {saveErr}
                                      </div>
                                    )}
                                    <div className="form__row" style={{ marginBottom: 12 }}>
                                      <div className="form__field">
                                        <label className="form__label">Status</label>
                                        <select
                                          className="form__input form__select"
                                          value={edit.status ?? u.status}
                                          onChange={(e) => setStatusEdit(p => ({ ...p, [u.id]: { ...p[u.id], status: e.target.value } }))}
                                        >
                                          <option value="active">Active</option>
                                          <option value="suspended">Suspended</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </div>
                                      <div className="form__field">
                                        <label className="form__label">
                                          Reason
                                          <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#64748b", marginLeft: 4 }}>optional</span>
                                        </label>
                                        <input
                                          className="form__input"
                                          placeholder="e.g. User requested suspension"
                                          maxLength={500}
                                          value={edit.reason ?? ""}
                                          onChange={(e) => setStatusEdit(p => ({ ...p, [u.id]: { ...p[u.id], reason: e.target.value } }))}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      className="btn btn--primary btn--sm"
                                      disabled={saving === u.id || ((edit.status ?? u.status) === u.status && !edit.reason)}
                                      onClick={() => handleStatusSave(u)}
                                    >
                                      {saving === u.id ? "Saving…" : "Save"}
                                    </button>
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

            {totalPages > 1 && (
              <div className="bulk-pagination">
                <button className="btn btn--ghost btn--sm" disabled={page === 0} onClick={() => handlePageChange(page - 1)}>← Prev</button>
                <span className="tbl__muted">Page {page + 1} of {totalPages}</span>
                <button className="btn btn--ghost btn--sm" disabled={page >= totalPages - 1} onClick={() => handlePageChange(page + 1)}>Next →</button>
              </div>
            )}
          </>
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
  if (module === "ORG")      return <OrgModuleTab  actions={actions} can={can} />;
  if (module === "ROLE")     return <RoleModuleTab actions={actions} can={can} />;
  if (module === "BULK")     return <BulkModuleTab actions={actions} />;
  if (module === "CMS_USER") return <UserModuleTab actions={actions} can={can} />;
  // USER module: consumer users (Plan B) only have READ/UPDATE.
  // If CREATE or DELETE is present the backend is pre-Plan-A → render admin user tab.
  if (module === "USER") {
    if (actions.has("CREATE") || actions.has("DELETE"))
      return <UserModuleTab actions={actions} can={can} />;
    return <ConsumerUserModuleTab actions={actions} />;
  }
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
  ORG:      "Organizations",
  USER:     "Manage Users",   // pre-Plan-A: admin users; post-Plan-B: consumer members
  CMS_USER: "Manage Users",   // post-Plan-A: admin users under /cms-users
  ROLE:     "Manage Roles",
  BULK:     "Operations",
  AUDIT:    "Audit Log",
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

  // Re-fetch /me/permissions and reset tab whenever the org changes
  useEffect(() => {
    if (!activeOrg?.id) return;
    dispatch(fetchMyPermissions());
    setActiveTab(null);
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
    .sort((a, b) => {
      if (a === "AUDIT" && b !== "AUDIT") return 1;
      if (a !== "AUDIT" && b === "AUDIT") return -1;
      return a.localeCompare(b);
    });

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
