import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import * as userService from "../../services/userService";
import * as roleService from "../../services/roleService";
import * as bulkService from "../../services/bulkService";
import * as consumerUserService from "../../services/consumerUserService";
import * as auditService from "../../services/auditService";
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
  resetUsers,
} from "../../store/slices/userSlice";
import {
  fetchRoles,
  fetchPermissions,
  createRole as apiCreateRole,
  deleteRole as apiDeleteRole,
  renameRole as apiRenameRole,
  addPermissionToRole,
  removePermissionFromRole,
  resetRoles,
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

  // Search / filter / delete confirm
  const [orgSearch, setOrgSearch]         = useState("");
  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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

  // Computed stats + filtered list
  const orgActiveCount    = orgs.filter((o) => (o.status ?? "active") === "active").length;
  const orgInactiveCount  = orgs.filter((o) => o.status === "inactive").length;

  const filteredOrgs = orgs.filter((o) => {
    const q = orgSearch.toLowerCase();
    const matchSearch = !q || o.name?.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q);
    const matchStatus = orgStatusFilter === "all" || (orgStatusFilter === "inactive" ? o.status === "inactive" : (o.status ?? "active") === orgStatusFilter);
    return matchSearch && matchStatus;
  });

  return (
    <div className="tab-content">

      {/* Read-only notice */}
      {canRead && !hasWriteActions && (
        <div className="org-readonly-banner">
          ℹ You have read-only access to organisations. Contact a super admin to make changes.
        </div>
      )}

      {/* ── Create Organisation ────────────────────────────── */}
      {canCreate && (
        <div className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>🏢</span>
                Create Organisation
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                The slug is a permanent identifier and cannot be changed after creation.
              </p>
            </div>
          </div>
          <div className="card__body">
            <form className="form" onSubmit={handleCreate} noValidate>

              {saving ? (
                <>
                  <div className="create-org-form__fields">
                    <div className="form__field">
                      <div className="shimmer-box" style={{ height: 12, width: 140, marginBottom: 8, borderRadius: 4 }} />
                      <div className="shimmer-box" style={{ height: 42 }} />
                    </div>
                    <div className="form__field">
                      <div className="shimmer-box" style={{ height: 12, width: 110, marginBottom: 8, borderRadius: 4 }} />
                      <div className="shimmer-box" style={{ height: 42 }} />
                    </div>
                  </div>
                  <div className="create-org-form__footer">
                    <div className="shimmer-box" style={{ height: 34, width: 140, borderRadius: 7 }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="create-org-form__fields">
                    <div className="form__field">
                      <label className="form__label">Organisation Name *</label>
                      <input
                        className={`form__input${errors.name ? " form__input--err" : ""}`}
                        value={name} placeholder="e.g. Acme Insurance"
                        onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                      />
                      {errors.name && <span className="form__err">{errors.name}</span>}
                    </div>
                    <div className="form__field">
                      <label className="form__label">
                        Slug *
                        <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#ea580c", marginLeft: 6 }}>
                          permanent · cannot be changed
                        </span>
                      </label>
                      <input
                        className={`form__input${errors.slug ? " form__input--err" : ""}`}
                        value={slug} placeholder="e.g. acme-insurance"
                        onChange={(e) => { setSlug(e.target.value.toLowerCase()); setErrors((p) => ({ ...p, slug: "" })); }}
                      />
                      {errors.slug
                        ? <span className="form__err">{errors.slug}</span>
                        : <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Lowercase letters, numbers and hyphens only (2–50 chars)</span>}
                    </div>
                  </div>
                  <div className="create-org-form__footer">
                    <button className="btn btn--primary btn--sm btn--create-shimmer" type="submit">
                      Create Organisation
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
        </div>
      )}

      {/* ── Organisations List ─────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <h2 className="card__title">
            <span style={{ fontSize: 16 }}>🏢</span>
            Organisations
            <span className="card__count">{orgs.length}</span>
          </h2>
          {!hasWriteActions && (
            <span className="expand-panel__readonly">Read only</span>
          )}
        </div>

        {/* ── Stats strip ── */}
        {orgs.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            borderBottom: "1px solid rgba(99,102,241,0.1)",
          }}>
            {[
              { key: "all",      label: "Total",    count: orgs.length,        color: "#4f46e5", bg: "rgba(99,102,241,0.05)" },
              { key: "active",   label: "Active",   count: orgActiveCount,     color: "#16a34a", bg: "rgba(22,163,74,0.05)"  },
              { key: "inactive", label: "Inactive", count: orgInactiveCount,   color: "#dc2626", bg: "rgba(220,38,38,0.05)" },
            ].map(({ key, label, count, color, bg }, i) => (
              <div
                key={key}
                onClick={() => setOrgStatusFilter(key)}
                style={{
                  padding: "10px 16px",
                  display: "flex", flexDirection: "column", gap: 2,
                  background: orgStatusFilter === key ? bg.replace("0.05", "0.1") : bg,
                  borderRight: i < 2 ? "1px solid rgba(99,102,241,0.08)" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + Filter bar ── */}
        {orgs.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid rgba(99,102,241,0.08)",
            flexWrap: "wrap",
            background: "rgba(248,250,252,0.6)",
          }}>
            <div style={{ position: "relative", flex: "1", minWidth: 180, maxWidth: 300 }}>
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, color: "#94a3b8", pointerEvents: "none",
              }}>🔍</span>
              <input
                type="search"
                className="form__input"
                placeholder="Search by name or slug…"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { key: "all",      label: "All",      count: orgs.length },
                { key: "active",   label: "Active",   count: orgActiveCount },
                { key: "inactive", label: "Inactive", count: orgInactiveCount },
              ].filter(({ key, count }) => key === "all" || count > 0).map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`btn btn--ghost btn--sm${orgStatusFilter === key ? " btn--active" : ""}`}
                  onClick={() => setOrgStatusFilter(key)}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  {label}
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "1px 6px",
                    background: orgStatusFilter === key ? "rgba(99,102,241,0.18)" : "rgba(100,116,139,0.12)",
                    color: orgStatusFilter === key ? "#4f46e5" : "#64748b",
                  }}>{count}</span>
                </button>
              ))}
              {(orgSearch || orgStatusFilter !== "all") && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => { setOrgSearch(""); setOrgStatusFilter("all"); }}
                  style={{ color: "#94a3b8", fontSize: 12 }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}

        {errorCode && (
          <p className="status status--error" style={{ padding: "12px 24px" }}>
            Failed to load organisations ({errorCode})
          </p>
        )}

        {loading && orgs.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading organisations…</p></div>
        ) : orgs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <p className="empty-state__text">No organisations found.{canCreate ? " Use the form above to create one." : ""}</p>
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <p className="empty-state__text">No organisations match your search or filter.</p>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setOrgSearch(""); setOrgStatusFilter("all"); }}
              style={{ marginTop: 4 }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Status</th>
                <th>Default</th>
                <th>Created</th>
                <th style={{ width: 210 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((org) => {
                const isActioning  = actioning === org.id;
                const isExpanded   = expandedId === org.id;
                const viewActive   = isExpanded && expandMode === "view";
                const editActive   = isExpanded && expandMode === "edit";
                const orgInitial   = (org.name || "O")[0].toUpperCase();

                return (
                  <>
                  <tr key={org.id} className={isExpanded ? "ut-row--open" : ""}>

                    {/* Organisation identity */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, fontWeight: 700, color: "#fff",
                        }}>
                          {orgInitial}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{org.name}</div>
                          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", marginTop: 2 }}>{org.slug}</div>
                        </div>
                      </div>
                    </td>

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

                    <td>
                      {org.createdAt
                        ? <span style={{ fontSize: 13, color: "#475569" }}>
                            {new Date(org.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        : <span className="tbl__muted">—</span>}
                    </td>

                    <td>
                      <div className="tbl__actions">
                        <button
                          className={`btn btn--ghost btn--sm${viewActive ? " btn--active" : ""}`}
                          onClick={() => openPanel(org, "view")}
                          title="View full organisation details"
                        >
                          {viewActive ? "✕ Close" : "Details"}
                        </button>
                        {canUpdate && (
                          <button
                            className={`btn btn--ghost btn--sm${editActive ? " btn--active" : ""}`}
                            onClick={() => openPanel(org, "edit")}
                            title="Edit name or status"
                          >
                            {editActive ? "✕ Close" : "Edit"}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn--danger btn--sm"
                            disabled={isActioning}
                            onClick={() => setDeleteConfirm(org)}
                            title={`Delete ${org.name}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── Detail / Edit panel ── */}
                  {isExpanded && (
                    <tr key={`${org.id}-panel`} className="expand-row">
                      <td colSpan={5}>
                        <div className="expand-panel">
                          <div className="expand-panel__header">
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, color: "#fff",
                            }}>
                              {orgInitial}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span className="expand-panel__title">
                                {expandMode === "edit" ? "Edit Organisation" : "Organisation Details"} — <strong>{org.name}</strong>
                              </span>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                {expandMode === "edit"
                                  ? "Update the display name or change the operational status."
                                  : "Full metadata snapshot — read-only view."}
                              </div>
                            </div>
                            {expandMode === "view" && (
                              <span className="expand-panel__readonly">Read only</span>
                            )}
                          </div>

                          <div className="expand-panel__body">
                            {selectedOrgLoading && <p className="status">Loading details…</p>}

                            {selectedOrgError && (
                              <div className="error-banner">
                                <span>⚠</span>
                                {selectedOrgError === "NOT_FOUND" || selectedOrgError === "FORBIDDEN"
                                  ? "You do not have access to this organisation's details."
                                  : `Failed to load (${selectedOrgError})`}
                              </div>
                            )}

                            {!selectedOrgLoading && !selectedOrgError && selectedOrg?.id === org.id && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                                {/* ── Info grid ── */}
                                <div className="org-detail-grid">
                                  {[
                                    { label: "Organisation ID", value: selectedOrg.id,   mono: true },
                                    { label: "Slug",            value: selectedOrg.slug,  mono: true },
                                    { label: "Status",          value: <span className={`badge badge--${selectedOrg.status ?? "active"}`}>{selectedOrg.status ?? "active"}</span> },
                                    { label: "Default Org",     value: selectedOrg.isDefault ? <span className="badge badge--system">Yes — new users land here</span> : <span className="tbl__muted">No</span> },
                                    { label: "Created At",      value: selectedOrg.createdAt ? new Date(selectedOrg.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—", muted: true },
                                  ].map(({ label, value, mono, muted }) => (
                                    <div key={label} className="org-detail-item">
                                      <span className="org-detail-label">{label}</span>
                                      <span className={`org-detail-value${mono ? " tbl__mono" : muted ? " tbl__muted" : ""}`}>{value}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* ── Edit form ── */}
                                {expandMode === "edit" && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div style={{ height: 1, background: "rgba(99,102,241,0.15)" }} />

                                    <div className="create-org-form__fields">
                                      <div className="form__field">
                                        <label className="form__label">Organisation Name</label>
                                        <input
                                          className="form__input"
                                          value={editName}
                                          placeholder={org.name}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                                        />
                                      </div>
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
                                          <option value="active">Active — Organisation is operational</option>
                                          <option value="suspended">Suspended — Organisation is locked out</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                                      <button
                                        className="btn btn--ghost btn--sm"
                                        onClick={closePanel}
                                        disabled={editSaving}
                                      >
                                        Cancel
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

        {/* Filtered result count */}
        {filteredOrgs.length > 0 && filteredOrgs.length < orgs.length && (
          <div style={{
            padding: "10px 20px",
            borderTop: "1px solid rgba(99,102,241,0.08)",
            fontSize: 12, color: "#64748b", textAlign: "center",
          }}>
            Showing {filteredOrgs.length} of {orgs.length} organisations
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ──────────────────────── */}
      {deleteConfirm && (
        <div className="uc-overlay" onClick={() => !actioning && setDeleteConfirm(null)}>
          <div className="uc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uc-modal__icon-wrap uc-modal__icon-wrap--danger">🗑</div>
            <h3 className="uc-modal__title">Delete Organisation?</h3>
            <p className="uc-modal__body">
              Are you sure you want to permanently delete{" "}
              <strong>{deleteConfirm.name}</strong>?{" "}
              This will remove all associated data and cannot be undone.
            </p>
            <div className="uc-modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={!!actioning}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger btn--sm"
                disabled={!!actioning}
                onClick={async () => {
                  await handleDelete(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
              >
                {actioning === deleteConfirm.id ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activePanel, setActivePanel]   = useState("active");
  const [reInviting, setReInviting]     = useState({}); // { [userId]: true }
  const [reInviteStatus, setReInviteStatus] = useState({}); // { [userId]: "success"|"error" }

  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchUsers());
  }, [dispatch]);

  // Load userRoles whenever the user list populates or gains new members.
  // Using the joined ID string as dependency avoids stale closures from the .then() pattern
  // and handles the case where users were pre-fetched before this tab mounted.
  const loadedUserIds = users.map((u) => u.id).join(",");
  useEffect(() => {
    if (users.length === 0) return;
    users.forEach((u) => {
      if (!userRoles[u.id]) dispatch(fetchUserRoles(u.id));
    });
  }, [loadedUserIds]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleReInvite = async (u) => {
    setReInviting((p) => ({ ...p, [u.id]: true }));
    setReInviteStatus((p) => ({ ...p, [u.id]: null }));
    const res = await dispatch(apiInviteUser({ fullName: u.fullName || "", email: u.email }));
    setReInviting((p) => ({ ...p, [u.id]: false }));
    setReInviteStatus((p) => ({
      ...p,
      [u.id]: apiInviteUser.rejected.match(res) ? "error" : "success",
    }));
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

  const activeCount  = users.filter((u) => u.status === "active").length;
  const pendingCount = users.filter((u) => u.status === "pending_verification").length;
  const deletedUsers = users.filter((u) => u.status === "inactive");
  const mainUsers    = users.filter((u) => u.status !== "inactive");

  const filteredMainUsers = mainUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredDeletedUsers = deletedUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const initial = (u) => (u.fullName || u.email || "?")[0].toUpperCase();

  return (
    <div className="tab-content">

      {/* ── Invite User ─────────────────────────────────────── */}
      {canCreate && (
        <div className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>✉️</span>
                Invite New User
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                An email invitation will be sent with a link to set their password.
              </p>
            </div>
          </div>
          <div className="card__body">

            {inviteSuccess && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", marginBottom: 14,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, color: "#16a34a", fontSize: 13,
              }}>
                <span>✓ {inviteSuccess}</span>
                <button onClick={() => setInviteSuccess("")}
                  style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            )}

            <form className="form" onSubmit={handleInvite} noValidate>
              <div className="form__row">
                <div className="form__field">
                  <label className="form__label">Full Name *</label>
                  <input className={`form__input${errors.fullName ? " form__input--err" : ""}`}
                    value={fullName} placeholder="e.g. Jane Doe"
                    onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: "" })); }} />
                  {errors.fullName && <span className="form__err">{errors.fullName}</span>}
                </div>
                <div className="form__field">
                  <label className="form__label">Work Email *</label>
                  <input className={`form__input${errors.email ? " form__input--err" : ""}`}
                    value={email} placeholder="e.g. jane@company.com" type="email"
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} />
                  {errors.email && <span className="form__err">{errors.email}</span>}
                </div>
                <div className="form__field">
                  <label className="form__label">
                    Assign Role
                    <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>
                      optional — can be changed later
                    </span>
                  </label>
                  <select
                    className="form__input form__select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="">— No role —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                <button className="btn btn--primary btn--sm btn--create-shimmer" type="submit" disabled={saving}>
                  {saving ? "Sending…" : "Send Invitation"}
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
            <span style={{ fontSize: 16 }}>👥</span>
            Manage Users
            <span className="card__count">{totalItems ?? users.length}</span>
          </h2>
        </div>

        {/* ── Inner panel tabs ── */}
        {users.length > 0 && (
          <div style={{ display: "flex", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
            {[
              { key: "active",  label: "Active Users",  count: mainUsers.length,    activeColor: "#4f46e5", activeBg: "rgba(99,102,241,0.06)" },
              { key: "deleted", label: "Deleted Users", count: deletedUsers.length, activeColor: "#dc2626", activeBg: "rgba(220,38,38,0.04)" },
            ].map(({ key, label, count, activeColor, activeBg }) => (
              <button
                key={key}
                onClick={() => { setActivePanel(key); setSearchQuery(""); setStatusFilter("all"); setExpandedUser(null); }}
                style={{
                  padding: "10px 20px",
                  fontSize: 13, fontWeight: 600,
                  background: activePanel === key ? activeBg : "transparent",
                  borderBottom: activePanel === key ? `2px solid ${activeColor}` : "2px solid transparent",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  color: activePanel === key ? activeColor : "#64748b",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 700, borderRadius: 20,
                  padding: "1px 6px",
                  background: activePanel === key ? `${activeColor}22` : "rgba(100,116,139,0.12)",
                  color: activePanel === key ? activeColor : "#64748b",
                }}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {activePanel === "active" ? (
          <>
            {/* ── Stats strip ── */}
            {mainUsers.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                borderBottom: "1px solid rgba(99,102,241,0.1)",
              }}>
                {[
                  { label: "Active",  count: activeCount,  color: "#16a34a", bg: "rgba(22,163,74,0.05)",  key: "active" },
                  { label: "Pending", count: pendingCount, color: "#ea580c", bg: "rgba(234,88,12,0.05)", key: "pending_verification" },
                ].map(({ label, count, color, bg, key }, i) => (
                  <div
                    key={label}
                    onClick={() => setStatusFilter(key)}
                    style={{
                      padding: "10px 16px",
                      display: "flex", flexDirection: "column", gap: 2,
                      background: bg,
                      borderRight: i < 1 ? "1px solid rgba(99,102,241,0.08)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8" }}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Search + Filter bar ── */}
            {mainUsers.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(99,102,241,0.08)",
                flexWrap: "wrap",
                background: "rgba(248,250,252,0.6)",
              }}>
                <div style={{ position: "relative", flex: "1", minWidth: 180, maxWidth: 300 }}>
                  <span style={{
                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: 13, color: "#94a3b8", pointerEvents: "none",
                  }}>🔍</span>
                  <input
                    type="search"
                    className="form__input"
                    placeholder="Search by name or email…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 13 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { key: "all",                  label: "All",     count: mainUsers.length },
                    { key: "active",               label: "Active",  count: activeCount },
                    { key: "pending_verification", label: "Pending", count: pendingCount },
                  ].filter(({ key, count }) => key === "all" || count > 0).map(({ key, label, count }) => (
                    <button
                      key={key}
                      className={`btn btn--ghost btn--sm${statusFilter === key ? " btn--active" : ""}`}
                      onClick={() => setStatusFilter(key)}
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "1px 6px",
                        background: statusFilter === key ? "rgba(99,102,241,0.18)" : "rgba(100,116,139,0.12)",
                        color: statusFilter === key ? "#4f46e5" : "#64748b",
                      }}>{count}</span>
                    </button>
                  ))}
                  {(searchQuery || statusFilter !== "all") && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                      style={{ color: "#94a3b8", fontSize: 12 }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {loading && mainUsers.length === 0 ? (
              <div className="empty-state"><p className="empty-state__text">Loading users…</p></div>
            ) : mainUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">👥</div>
                <p className="empty-state__text">No active users yet. Use the form above to invite the first user.</p>
              </div>
            ) : filteredMainUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🔍</div>
                <p className="empty-state__text">No users match your search or filter.</p>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                  style={{ marginTop: 4 }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Organisation</th>
                    <th>Joined</th>
                    <th>Roles</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMainUsers.map((u) => {
                    const assigned = userRoles[u.id] ?? [];
                    const isOpen   = expandedUser === u.id;

                    return (
                      <Fragment key={u.id}>
                        <tr className={isOpen ? "ut-row--open" : ""}>
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
                            {canDelete && !u.isSuperAdmin && u.status === "active" ? (
                              <button
                                className="status-toggle status-toggle--on"
                                onClick={() => setConfirmAction({ user: u, type: "toggle" })}
                                title="Click to deactivate this user"
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

                          <td>
                            {u.orgSlug
                              ? <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{u.orgSlug}</span>
                              : <span className="tbl__muted">—</span>}
                          </td>

                          <td>
                            {u.createdAt
                              ? <span style={{ fontSize: 13, color: "#475569" }}>
                                  {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              : <span className="tbl__muted">—</span>}
                          </td>

                          <td>
                            {assigned.length === 0 ? (
                              <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>None assigned</span>
                            ) : (
                              <div className="ut-role-chips">
                                {assigned.slice(0, 2).map((r) => (
                                  <span key={r.id} className={`badge ${r.systemRole ? "badge--system" : "badge--custom"}`}>
                                    {r.name}
                                  </span>
                                ))}
                                {assigned.length > 2 && (
                                  <span className="ut-role-more">+{assigned.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td>
                            <div className="tbl__actions">
                              <button
                                className={`btn btn--ghost btn--sm${isOpen ? " btn--active" : ""}`}
                                onClick={() => toggleExpand(u.id)}
                                title={isOpen ? "Close role panel" : `Manage roles for ${u.fullName || u.email}`}
                              >
                                {isOpen
                                  ? "✕ Close"
                                  : assigned.length > 0
                                    ? `Roles (${assigned.length})`
                                    : "Assign Role"}
                              </button>
                              {canDelete && !u.isSuperAdmin && (
                                <button
                                  className="btn btn--danger btn--sm"
                                  onClick={() => setConfirmAction({ user: u, type: "delete" })}
                                  title={`Delete ${u.fullName || u.email}`}
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
                                  <div style={{ flex: 1 }}>
                                    <span className="expand-panel__title">
                                      Role Assignments — <strong>{u.fullName || u.email}</strong>
                                    </span>
                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                      {assigned.length === 0
                                        ? "This user has no roles. Assign one from the right panel."
                                        : `${assigned.length} role${assigned.length > 1 ? "s" : ""} assigned — click Revoke to remove any.`}
                                    </div>
                                  </div>
                                </div>

                                <div className="expand-panel__body">
                                  <div className="ut-roles-layout">

                                    <div className="ut-roles-section">
                                      <p className="users-panel__section-label">
                                        Current Roles
                                        {assigned.length > 0 && (
                                          <span className="card__count" style={{ marginLeft: 8 }}>{assigned.length}</span>
                                        )}
                                      </p>
                                      {assigned.length === 0 ? (
                                        <div className="ut-roles-empty">
                                          <span style={{ fontSize: 22, opacity: 0.4 }}>🎭</span>
                                          <span>No roles assigned yet</span>
                                          <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Use the panel on the right to assign a role</span>
                                        </div>
                                      ) : (
                                        <div className="ut-assigned-list">
                                          {assigned.map((r) => (
                                            <div key={r.id} className="ut-role-row">
                                              <div className="ut-role-row__info">
                                                <span className="ut-role-row__name">{r.name}</span>
                                                <div className="ut-role-row__badges">
                                                  <span className={`badge badge--${r.organizationId ? "org" : "global"}`}>
                                                    {r.organizationId ? "Org-level" : "Global"}
                                                  </span>
                                                  <span className={`badge ${r.systemRole ? "badge--system" : "badge--custom"}`}>
                                                    {r.systemRole ? "System" : "Custom"}
                                                  </span>
                                                </div>
                                              </div>
                                              <button
                                                className="btn btn--danger btn--sm"
                                                onClick={() => handleRevoke(u.id, r.id)}
                                                title={`Remove "${r.name}" from ${u.fullName || u.email}`}
                                              >
                                                Revoke
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="ut-roles-divider" />

                                    <div className="ut-roles-section">
                                      <p className="users-panel__section-label">Assign a Role</p>
                                      <p style={{ fontSize: 12, color: "#64748b", margin: "-4px 0 12px" }}>
                                        Select a role and click Assign to grant access.
                                      </p>
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
                                              {r.name}{assigned.some((ar) => ar.id === r.id) ? " ✓ Already assigned" : ""}
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
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {filteredMainUsers.length > 0 && filteredMainUsers.length < mainUsers.length && (
              <div style={{
                padding: "10px 20px",
                borderTop: "1px solid rgba(99,102,241,0.08)",
                fontSize: 12, color: "#64748b", textAlign: "center",
              }}>
                Showing {filteredMainUsers.length} of {mainUsers.length} users
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Deleted Users Panel ── */}
            {deletedUsers.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(99,102,241,0.08)",
                background: "rgba(248,250,252,0.6)",
              }}>
                <div style={{ position: "relative", flex: "1", minWidth: 180, maxWidth: 300 }}>
                  <span style={{
                    position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: 13, color: "#94a3b8", pointerEvents: "none",
                  }}>🔍</span>
                  <input
                    type="search"
                    className="form__input"
                    placeholder="Search deleted users…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 13 }}
                  />
                </div>
                {searchQuery && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSearchQuery("")}
                    style={{ color: "#94a3b8", fontSize: 12 }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            )}

            {deletedUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🗑️</div>
                <p className="empty-state__text">No deleted users.</p>
              </div>
            ) : filteredDeletedUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🔍</div>
                <p className="empty-state__text">No deleted users match your search.</p>
                <button className="btn btn--ghost btn--sm" onClick={() => setSearchQuery("")} style={{ marginTop: 4 }}>Clear search</button>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Organisation</th>
                    <th>Joined</th>
                    <th>Roles</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletedUsers.map((u) => {
                    const assigned = userRoles[u.id] ?? [];
                    return (
                      <tr key={u.id} style={{ opacity: 0.75 }}>
                        <td>
                          <div className="ut-user-cell">
                            <div className="ut-avatar" style={{ background: "#e2e8f0", color: "#64748b" }}>{initial(u)}</div>
                            <div className="ut-user-info">
                              <span className="ut-user-name" style={{ color: "#94a3b8" }}>{u.fullName || "—"}</span>
                              <span className="ut-user-email">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.orgSlug
                            ? <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{u.orgSlug}</span>
                            : <span className="tbl__muted">—</span>}
                        </td>
                        <td>
                          {u.createdAt
                            ? <span style={{ fontSize: 13, color: "#94a3b8" }}>
                                {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            : <span className="tbl__muted">—</span>}
                        </td>
                        <td>
                          {assigned.length === 0 ? (
                            <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>None</span>
                          ) : (
                            <div className="ut-role-chips">
                              {assigned.slice(0, 2).map((r) => (
                                <span key={r.id} className={`badge ${r.systemRole ? "badge--system" : "badge--custom"}`} style={{ opacity: 0.7 }}>
                                  {r.name}
                                </span>
                              ))}
                              {assigned.length > 2 && <span className="ut-role-more">+{assigned.length - 2}</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          {canCreate && (
                            reInviteStatus[u.id] === "success" ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 12, fontWeight: 600, color: "#16a34a",
                              }}>
                                ✓ Invite sent
                              </span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <button
                                  className="btn btn--primary btn--sm"
                                  disabled={reInviting[u.id]}
                                  onClick={() => handleReInvite(u)}
                                  title={`Re-invite ${u.fullName || u.email}`}
                                >
                                  {reInviting[u.id] ? "Sending…" : "Re-invite"}
                                </button>
                                {reInviteStatus[u.id] === "error" && (
                                  <span style={{ fontSize: 11, color: "#dc2626" }}>Failed, retry</span>
                                )}
                              </div>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
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
                  : "Reactivate User?"}
            </h3>

            <p className="uc-modal__body">
              {confirmAction.type === "delete"
                ? <>Are you sure you want to permanently delete <strong>{confirmAction.user.fullName || confirmAction.user.email}</strong>? This action cannot be undone.</>
                : confirmAction.user.status === "active"
                  ? <><strong>{confirmAction.user.fullName || confirmAction.user.email}</strong> will be deactivated and lose all platform access immediately.</>
                  : <><strong>{confirmAction.user.fullName || confirmAction.user.email}</strong> will be reactivated and regain their previous access level.</>}
            </p>

            <div className="uc-modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmAction(null)}
                disabled={confirming}
              >
                Cancel
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
                      : "Yes, Reactivate"}
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
  const { roles = [], permissions = [], loading: rolesLoading } = useSelector((s) => s.roles);
  const { items: users = [], userRoles = {} }                   = useSelector((s) => s.users);
  const { currentUser }                               = useApp();

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleErr,  setNewRoleErr]  = useState("");
  const [creating,    setCreating]    = useState(false);
  const [renaming,    setRenaming]    = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [deleteErr,   setDeleteErr]   = useState({});
  const [deleteInfo,  setDeleteInfo]  = useState(null); // success acknowledgment
  const [forceDeleting, setForceDeleting] = useState(null);
  const [roleSearch, setRoleSearch]           = useState("");
  const [roleDeleteConfirm, setRoleDeleteConfirm] = useState(null);

  /* ── fetch on mount ──────────────────────────────────────── */
  useEffect(() => {
    dispatch(fetchRoles());
    dispatch(fetchPermissions());
    dispatch(fetchUsers());
  }, [dispatch]);

  // Mirror the same loadedUserIds pattern as UserModuleTab so userRoles always
  // populate regardless of whether users were pre-fetched before mount.
  const loadedUserIds = users.map((u) => u.id).join(",");
  useEffect(() => {
    if (users.length === 0) return;
    users.forEach((u) => {
      if (!userRoles[u.id]) dispatch(fetchUserRoles(u.id));
    });
  }, [loadedUserIds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helpers ──────────────────────────────────────────────── */
  const openPanel = (roleId, panel) =>
    setExpanded((p) => p?.roleId === roleId && p?.panel === panel ? null : { roleId, panel });

  const getUsersForRole = (roleId) =>
    Object.entries(userRoles)
      .filter(([, list]) => Array.isArray(list) && list.some((r) => r.id === roleId))
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
    dispatch(fetchMyPermissions());
    setNewRoleName(""); setNewRoleErr(""); setCreating(false);
  };

  const handleRename = async (role) => {
    if (!renaming?.value.trim() || renaming.value === role.name) { setRenaming(null); return; }
    await dispatch(apiRenameRole({ id: role.id, name: renaming.value.trim() }));
    dispatch(fetchMyPermissions());
    setRenaming(null);
  };

  const togglePermission = async (role, perm) => {
    const has = (role.permissions ?? []).some((p) => p.id === perm.id);
    if (has) await dispatch(removePermissionFromRole({ roleId: role.id, permId: perm.id }));
    else     await dispatch(addPermissionToRole({ roleId: role.id, permissionId: perm.id }));
    dispatch(fetchMyPermissions());
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
        dispatch(fetchMyPermissions());
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

  /* ── computed ───────────────────────────────────────────── */
  const systemRolesCount = roles.filter((r) => !!r.systemRole).length;
  const customRolesCount = roles.filter((r) => !r.systemRole).length;
  const filteredRoles = !roleSearch
    ? roles
    : roles.filter((r) => r.name.toLowerCase().includes(roleSearch.toLowerCase()));

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="tab-content">

      {/* ── Delete acknowledgment banner ── */}
      {deleteInfo && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px",
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 8, color: "#16a34a", fontSize: 13,
        }}>
          <span>✓ {deleteInfo}</span>
          <button onClick={() => setDeleteInfo(null)}
            style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        </div>
      )}

      {/* ── Create Role ─────────────────────────────────────── */}
      {(actions.has("CREATE") || actions.has("MANAGE")) && (
        <div className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title" style={{ marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>🎭</span>
                Create Role
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                Custom roles can be given any combination of system permissions.
              </p>
            </div>
          </div>
          <div className="card__body">
            <form className="form" onSubmit={handleCreate} noValidate>
              <div className="create-org-form__fields">
                <div className="form__field">
                  <label className="form__label">Role Name *</label>
                  <input
                    className={`form__input${newRoleErr ? " form__input--err" : ""}`}
                    value={newRoleName} placeholder="e.g. Compliance Officer"
                    onChange={(e) => { setNewRoleName(e.target.value); setNewRoleErr(""); }}
                  />
                  {newRoleErr
                    ? <span className="form__err">{newRoleErr}</span>
                    : <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>After creating, open the Permissions panel to assign access.</span>}
                </div>
              </div>
              <div className="create-org-form__footer">
                <button className="btn btn--primary btn--sm btn--create-shimmer" type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create Role"}
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
            <span style={{ fontSize: 16 }}>🎭</span>
            All Roles
            <span className="card__count">{roles.length}</span>
          </h2>
        </div>

        {/* ── Stats strip ── */}
        {roles.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            borderBottom: "1px solid rgba(99,102,241,0.1)",
          }}>
            {[
              { label: "Total",   count: roles.length,       color: "#4f46e5", bg: "rgba(99,102,241,0.05)" },
              { label: "System",  count: systemRolesCount,   color: "#64748b", bg: "rgba(100,116,139,0.05)" },
              { label: "Custom",  count: customRolesCount,   color: "#7c3aed", bg: "rgba(124,58,237,0.05)" },
            ].map(({ label, count, color, bg }, i) => (
              <div key={label} style={{
                padding: "10px 16px", display: "flex", flexDirection: "column", gap: 2,
                background: bg, borderRight: i < 2 ? "1px solid rgba(99,102,241,0.08)" : "none",
              }}>
                <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "#94a3b8" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Search bar ── */}
        {roles.length > 0 && (
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid rgba(99,102,241,0.08)",
            background: "rgba(248,250,252,0.6)",
          }}>
            <div style={{ position: "relative", maxWidth: 300 }}>
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, color: "#94a3b8", pointerEvents: "none",
              }}>🔍</span>
              <input
                type="search"
                className="form__input"
                placeholder="Search roles by name…"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                style={{ paddingLeft: 32, paddingTop: 7, paddingBottom: 7, fontSize: 13 }}
              />
            </div>
          </div>
        )}

        {rolesLoading && roles.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading roles…</p></div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎭</div>
            <p className="empty-state__text">No roles yet.{(actions.has("CREATE") || actions.has("MANAGE")) ? " Use the form above to create one." : ""}</p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <p className="empty-state__text">No roles match your search.</p>
            <button className="btn btn--ghost btn--sm" onClick={() => setRoleSearch("")} style={{ marginTop: 4 }}>Clear search</button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Role</th>
                <th>Scope</th>
                <th>Type</th>
                <th>Permissions</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => {
                const isSystem   = !!role.systemRole;
                const scope      = role.organizationId ? "ORG" : "GLOBAL";
                const isRenaming = renaming?.id === role.id;
                const permOpen   = expanded?.roleId === role.id && expanded?.panel === "permissions";
                const permCount  = (role.permissions ?? []).length;
                const roleInitial = role.name[0]?.toUpperCase() ?? "R";

                return (
                  <>
                    <tr key={role.id} className={permOpen ? "ut-row--open" : ""}>

                      {/* Role identity / inline rename */}
                      <td>
                        {isRenaming ? (
                          <div className="rename-row">
                            <input
                              className="form__input" autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ id: role.id, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")  handleRename(role);
                                if (e.key === "Escape") setRenaming(null);
                              }}
                            />
                            <button className="btn btn--primary btn--sm" onClick={() => handleRename(role)}>Save</button>
                            <button className="btn btn--ghost btn--sm" onClick={() => setRenaming(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                              background: isSystem
                                ? "linear-gradient(135deg, #94a3b8, #64748b)"
                                : "linear-gradient(135deg, #7c3aed, #6366f1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 700, color: "#fff",
                            }}>
                              {roleInitial}
                            </div>
                            <span className="tbl__bold">{role.name}</span>
                          </div>
                        )}
                      </td>

                      <td><span className={`badge badge--${scope.toLowerCase()}`}>{scope}</span></td>
                      <td><span className={`badge ${isSystem ? "badge--system" : "badge--custom"}`}>{isSystem ? "System" : "Custom"}</span></td>

                      <td>
                        {permCount === 0 ? (
                          <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>None</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                            {(role.permissions ?? []).slice(0, 3).map((p) => (
                              <span key={p.id} className="perm-chip">{p.code}</span>
                            ))}
                            {permCount > 3 && (
                              <span className="perm-chip" style={{ background: "rgba(99,102,241,0.1)", color: "#4f46e5", borderColor: "rgba(99,102,241,0.2)" }}>
                                +{permCount - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="tbl__actions">
                          {!isSystem && !isRenaming && (
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setRenaming({ id: role.id, value: role.name })}
                              title="Rename this role"
                            >
                              Rename
                            </button>
                          )}
                          <button
                            className={`btn btn--ghost btn--sm${permOpen ? " btn--active" : ""}`}
                            onClick={() => openPanel(role.id, "permissions")}
                            title={`View and edit permissions for ${role.name}`}
                          >
                            {permOpen ? "✕ Close" : `Permissions${permCount > 0 ? ` (${permCount})` : ""}`}
                          </button>
                          {!isSystem && (
                            forceDeleting === role.id ? (
                              <span className="tbl__muted" style={{ fontSize: 12 }}>Revoking…</span>
                            ) : (
                              <button
                                className="btn btn--danger btn--sm"
                                onClick={() => setRoleDeleteConfirm(role)}
                                title={`Delete ${role.name}`}
                              >
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Per-role delete error ── */}
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
                              <div style={{
                                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                background: isSystem ? "linear-gradient(135deg, #94a3b8, #64748b)" : "linear-gradient(135deg, #7c3aed, #6366f1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 700, color: "#fff",
                              }}>
                                {roleInitial}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span className="expand-panel__title">
                                  Permissions — <strong>{role.name}</strong>
                                </span>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                  {isSystem
                                    ? "System roles are read-only. Permissions cannot be changed."
                                    : "Toggle permissions on or off. Changes take effect immediately."}
                                </div>
                              </div>
                              {isSystem && <span className="expand-panel__readonly">Read only</span>}
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
                                          <label
                                            key={perm.id}
                                            className={`perm-toggle${checked ? " perm-toggle--on" : ""}${isSystem ? " perm-toggle--disabled" : ""}`}
                                          >
                                            <input
                                              type="checkbox" checked={checked} disabled={isSystem}
                                              onChange={() => !isSystem && togglePermission(role, perm)}
                                            />
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

        {/* Filtered result count */}
        {filteredRoles.length > 0 && filteredRoles.length < roles.length && (
          <div style={{
            padding: "10px 20px",
            borderTop: "1px solid rgba(99,102,241,0.08)",
            fontSize: 12, color: "#64748b", textAlign: "center",
          }}>
            Showing {filteredRoles.length} of {roles.length} roles
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ──────────────────────── */}
      {roleDeleteConfirm && (
        <div className="uc-overlay" onClick={() => !forceDeleting && setRoleDeleteConfirm(null)}>
          <div className="uc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uc-modal__icon-wrap uc-modal__icon-wrap--danger">🗑</div>
            <h3 className="uc-modal__title">Delete Role?</h3>
            <p className="uc-modal__body">
              Are you sure you want to delete <strong>{roleDeleteConfirm.name}</strong>?{" "}
              All user assignments will be <strong>automatically revoked</strong> before deletion.
              This action cannot be undone.
            </p>
            <div className="uc-modal__actions">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setRoleDeleteConfirm(null)}
                disabled={!!forceDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger btn--sm"
                disabled={!!forceDeleting}
                onClick={async () => {
                  await handleDelete(roleDeleteConfirm.id);
                  setRoleDeleteConfirm(null);
                }}
              >
                {forceDeleting === roleDeleteConfirm.id ? "Revoking & deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  BULK module tab — CSV upload + job management (Operations) */
/* ─────────────────────────────────────────────────────────── */
const ROW_STATUSES = ["DRAFT","STAGED","OTP_SENT","VERIFIED","PROMOTED","REJECTED","EXPIRED","INVITE_FAILED","SUPERSEDED","CANCELLED"];

function jobStatusClass(status) {
  return { PENDING: "badge--pending", PROCESSING: "badge--processing", COMPLETED: "badge--completed", FAILED: "badge--failed", CANCELLED: "badge--cancelled" }[status] ?? "badge--system";
}

function rowStatusClass(status) {
  return {
    DRAFT: "badge--draft", STAGED: "badge--staged", OTP_SENT: "badge--otp-sent",
    VERIFIED: "badge--verified", PROMOTED: "badge--promoted", REJECTED: "badge--rejected",
    EXPIRED: "badge--expired", INVITE_FAILED: "badge--invite-failed",
    SUPERSEDED: "badge--superseded", CANCELLED: "badge--cancelled",
  }[status] ?? "badge--system";
}

function rowStatusColor(status) {
  return { PROMOTED: "#16a34a", VERIFIED: "#059669", STAGED: "#6366f1", OTP_SENT: "#f59e0b",
    DRAFT: "#94a3b8", REJECTED: "#dc2626", EXPIRED: "#f87171", INVITE_FAILED: "#ef4444",
    CANCELLED: "#cbd5e1", SUPERSEDED: "#8b5cf6" }[status] ?? "#6366f1";
}

function formatTimeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function BulkModuleTab({ actions, onJobsLoad }) {
  const canUpload = actions.has("UPLOAD");
  const canRead   = actions.has("READ") || actions.has("UPLOAD");

  const [jobs, setJobs]               = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError]     = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  const [detailJob, setDetailJob]           = useState(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [rows, setRows]                     = useState([]);
  const [rowsLoading, setRowsLoading]       = useState(false);
  const [rowsError, setRowsError]           = useState(null);
  const [rowFilter, setRowFilter]           = useState("");
  const [rowPage, setRowPage]               = useState(0);
  const [rowTotalPages, setRowTotalPages]   = useState(1);
  const [parseErrors, setParseErrors]       = useState(null);
  const [parseErrLoading, setParseErrLoading] = useState(false);
  const [showParseErrors, setShowParseErrors] = useState(false);
  const [resending, setResending]           = useState({});
  const [resendStatus, setResendStatus]     = useState({});
  const [rowSearch, setRowSearch]           = useState("");
  const [dispatching, setDispatching]       = useState(false);
  const [dispatchErr, setDispatchErr]       = useState(null);
  const [cancelJobConfirm, setCancelJobConfirm] = useState(false);
  const [cancellingJob, setCancellingJob]   = useState(false);
  const [cancelJobErr, setCancelJobErr]     = useState(null);
  const [cancellingRow, setCancellingRow]   = useState({});
  const [editingRow, setEditingRow]         = useState(null);
  const [editState, setEditState]           = useState({});
  const [editSaving, setEditSaving]         = useState(false);
  const [editErr, setEditErr]               = useState(null);

  const loadJobs = useCallback(async () => {
    if (!canRead) return;
    setJobsLoading(true);
    try {
      const data = await bulkService.listJobs();
      const items = data.items ?? [];
      setJobs(items);
      setJobsError(null);
      onJobsLoad?.(items.length);
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
  }, [canRead, onJobsLoad]);

  // Load jobs on mount so the list is populated immediately when the tab opens.
  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (detailJob) return;
    const hasActive = jobs.some(j => j.status === "PENDING" || j.status === "PROCESSING");
    if (!hasActive) return;
    const id = setInterval(loadJobs, 2000);
    return () => clearInterval(id);
  }, [jobs, detailJob, loadJobs]);

  const loadRows = useCallback(async (jobId, status, pg, search = "") => {
    setRowsLoading(true);
    setRowsError(null);
    try {
      const data = await bulkService.getJobRows(jobId, { status: status || undefined, page: pg, size: 20, search: search || undefined });
      setRows(data.items ?? []);
      setRowTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setRows([]);
      setRowsError(err?.response?.data?.errorCode ?? "FETCH_FAILED");
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailJob) return;
    loadRows(detailJob.id, rowFilter, rowPage, rowSearch);
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
    setUploadProgress(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress({ loaded: 0, total: selectedFile.size });
    try {
      const job = await bulkService.uploadBulkFile(selectedFile, (evt) => {
        setUploadProgress({ loaded: evt.loaded, total: evt.total || selectedFile.size });
      });
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
      setUploadProgress(null);
    }
  };

  const openDetail = async (job) => {
    setDetailJob(job);
    setDetailLoading(true);
    setRows([]); setRowsError(null); setRowPage(0); setRowFilter(""); setRowSearch("");
    setParseErrors(null); setShowParseErrors(false);
    setResending({}); setResendStatus({});
    setDispatching(false); setDispatchErr(null);
    setCancelJobConfirm(false); setCancelJobErr(null);
    setEditingRow(null); setEditState({});
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
      loadRows(detailJob.id, rowFilter, rowPage, rowSearch);
    } catch (err) {
      setResendStatus(p => ({ ...p, [rowId]: err?.response?.data?.errorCode ?? "FAILED" }));
    } finally {
      setResending(p => ({ ...p, [rowId]: false }));
    }
  };

  const handleDispatch = async () => {
    if (!detailJob) return;
    setDispatching(true); setDispatchErr(null);
    try {
      const updated = await bulkService.dispatchJob(detailJob.id);
      setDetailJob(updated);
      setRowPage(0);
      loadRows(updated.id, "", 0, "");
      setRowFilter(""); setRowSearch("");
    } catch (err) {
      const errMsg  = err?.response?.data?.message;
      const errCode = err?.response?.data?.errorCode;
      setDispatchErr(errMsg ?? errCode ?? "Failed to send invites. Please try again.");
    } finally {
      setDispatching(false);
    }
  };

  const handleCancelJob = async () => {
    if (!detailJob) return;
    setCancellingJob(true); setCancelJobErr(null);
    try {
      await bulkService.cancelJob(detailJob.id);
      const updated = await bulkService.getJob(detailJob.id);
      setDetailJob(updated);
      setCancelJobConfirm(false);
      loadRows(updated.id, rowFilter, rowPage, rowSearch);
    } catch (err) {
      setCancelJobErr(err?.response?.data?.errorCode ?? "CANCEL_FAILED");
    } finally {
      setCancellingJob(false);
    }
  };

  const handleCancelRow = async (rowId) => {
    if (!detailJob) return;
    setCancellingRow(p => ({ ...p, [rowId]: true }));
    try {
      await bulkService.cancelRow(detailJob.id, rowId);
      const updated = await bulkService.getJob(detailJob.id);
      setDetailJob(updated);
      loadRows(detailJob.id, rowFilter, rowPage, rowSearch);
    } catch { /* row stays as-is on error */ } finally {
      setCancellingRow(p => ({ ...p, [rowId]: false }));
    }
  };

  const handleEditSave = async (rowId) => {
    if (!detailJob) return;
    setEditSaving(true); setEditErr(null);
    try {
      await bulkService.editRow(detailJob.id, rowId, editState);
      setEditingRow(null); setEditState({});
      loadRows(detailJob.id, rowFilter, rowPage, rowSearch);
    } catch (err) {
      setEditErr(err?.response?.data?.errorCode ?? "SAVE_FAILED");
    } finally {
      setEditSaving(false);
    }
  };

  /* ── DETAIL VIEW ── */
  if (detailJob) {
    const stats = detailJob.rowStats ?? {};
    const needsAttention = [];
    if ((stats.DRAFT          ?? 0) > 0) needsAttention.push({ icon: "📨", color: "#6366f1", msg: `${stats.DRAFT} draft row${stats.DRAFT !== 1 ? "s" : ""} ready — send invites to start enrollment`, cta: "Send Invites", onClick: handleDispatch, busy: dispatching });
    if ((stats.INVITE_FAILED  ?? 0) > 0) needsAttention.push({ icon: "⚠️", color: "#f59e0b", msg: `${stats.INVITE_FAILED} invite${stats.INVITE_FAILED !== 1 ? "s" : ""} failed to deliver`, hint: "Resend from the rows table below" });
    if ((stats.EXPIRED        ?? 0) > 0) needsAttention.push({ icon: "⏰", color: "#ef4444", msg: `${stats.EXPIRED} row${stats.EXPIRED !== 1 ? "s" : ""} expired — invites need to be resent`, hint: "Resend from the rows table below" });

    return (
      <div className="tab-content bulk-view-enter">

        {/* Detail page header */}
        <div className="bulk-detail-hdr">
          <button className="btn btn--ghost btn--sm" onClick={() => setDetailJob(null)}>← Back</button>
          <div className="bulk-detail-hdr__center">
            <div className="bulk-detail-hdr__title">
              Job #{detailJob.jobNumber}
              <span className={`badge ${jobStatusClass(detailJob.status)}`}>{detailJob.status}</span>
              {(detailJob.status === "PENDING" || detailJob.status === "PROCESSING") && (
                <span className="bulk-polling-dot" title="Polling for updates…" />
              )}
              {detailLoading && <span className="tbl__muted" style={{ fontSize: 12, fontWeight: 400 }}>Loading…</span>}
            </div>
            <div className="bulk-detail-hdr__file">📄 {detailJob.fileName}</div>
          </div>
          {canUpload && !["CANCELLED","FAILED"].includes(detailJob.status) && (
            cancelJobConfirm ? (
              <div className="bulk-cancel-confirm">
                <span>Cancel all non-promoted rows?</span>
                <button className="btn btn--danger btn--sm" onClick={handleCancelJob} disabled={cancellingJob}>
                  {cancellingJob ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => { setCancelJobConfirm(false); setCancelJobErr(null); }}>No</button>
                {cancelJobErr && <span style={{ fontSize: 11, color: "#f87171" }}>{cancelJobErr}</span>}
              </div>
            ) : (
              <button className="btn btn--danger btn--sm" onClick={() => setCancelJobConfirm(true)}>✕ Cancel Job</button>
            )
          )}
        </div>

        {/* Key stats strip */}
        <div className="bulk-summary-strip">
          {[
            { label: "Total Rows",  value: detailJob.totalRows  ?? "—", accent: "#6366f1" },
            { label: "Valid",       value: detailJob.parsedRows  ?? "—", accent: "#16a34a" },
            { label: "Invalid",     value: detailJob.invalidRows ?? 0,   accent: (detailJob.invalidRows ?? 0) > 0 ? "#dc2626" : "#94a3b8" },
            { label: "Submitted",   value: detailJob.createdAt ? new Date(detailJob.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—", accent: "#64748b", small: true },
          ].map(({ label, value, accent, small }) => (
            <div key={label} className="bulk-summary-card">
              <div className="bulk-summary-card__value" style={{ color: accent, fontSize: small ? 17 : undefined }}>{value}</div>
              <div className="bulk-summary-card__label">{label}</div>
            </div>
          ))}
        </div>

        {/* Needs attention action panel */}
        {needsAttention.length > 0 && (
          <div className="bulk-action-panel">
            <div className="bulk-action-panel__title">⚡ Needs Attention</div>
            {needsAttention.map((item, i) => (
              <div key={i} className="bulk-action-panel__item" style={{ "--item-color": item.color }}>
                <span className="bulk-action-panel__icon">{item.icon}</span>
                <span className="bulk-action-panel__msg">{item.msg}</span>
                {item.cta && (
                  <button className="btn btn--primary btn--sm" onClick={item.onClick} disabled={item.busy}>
                    {item.busy ? "Sending…" : item.cta}
                  </button>
                )}
                {item.hint && <span className="bulk-action-panel__hint">{item.hint}</span>}
              </div>
            ))}
            {dispatchErr && <div className="bulk-action-panel__err">⚠ {dispatchErr}</div>}
          </div>
        )}

        {/* Enrollment progress breakdown */}
        {Object.keys(stats).length > 0 && (
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Enrollment Progress</h2>
              <span className="card__count">{detailJob.totalRows ?? 0} rows</span>
            </div>
            <div className="card__body">
              <div className="bulk-progress-breakdown">
                {Object.entries(stats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => {
                    const pct = detailJob.totalRows > 0 ? Math.round(v / detailJob.totalRows * 100) : 0;
                    return (
                      <div key={k} className="bulk-pb-row">
                        <div className="bulk-pb-label">
                          <span className={`badge ${rowStatusClass(k)}`}>{k}</span>
                        </div>
                        <div className="bulk-pb-bar-wrap">
                          <div className="bulk-pb-bar-fill" style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%`, background: rowStatusColor(k) }} />
                        </div>
                        <div className="bulk-pb-right">
                          <span className="bulk-pb-count">{v}</span>
                          <span className="bulk-pb-pct">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Rows card */}
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">Rows</h2>
            <input
              className="bulk-search-input"
              placeholder="Search name, mobile, email…"
              value={rowSearch}
              onChange={(e) => {
                const q = e.target.value;
                setRowSearch(q);
                setRowPage(0);
                loadRows(detailJob.id, rowFilter, 0, q);
              }}
            />
          </div>

          {/* Status filter checkboxes */}
          <div className="bulk-filter-grid">
            <label className={`bulk-filter-check${rowFilter === "" ? " bulk-filter-check--on" : ""}`}>
              <input
                type="checkbox"
                checked={rowFilter === ""}
                onChange={() => { setRowFilter(""); setRowPage(0); }}
              />
              <span>All</span>
            </label>
            {ROW_STATUSES.map((s) => (
              <label key={s} className={`bulk-filter-check bulk-filter-check--${s.toLowerCase().replace("_","-")}${rowFilter === s ? " bulk-filter-check--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={rowFilter === s}
                  onChange={() => { const next = rowFilter === s ? "" : s; setRowFilter(next); setRowPage(0); }}
                />
                <span>{s.replace("_", " ")}</span>
                {stats[s] != null && <span className="bulk-filter-check__count">{stats[s]}</span>}
              </label>
            ))}
          </div>

          {rowsLoading && rows.length === 0 ? (
            <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
          ) : rowsError ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚠</div>
              <p className="empty-state__text">
                {rowsError === "INTERNAL_ERROR"
                  ? `The "${rowFilter || "All"}" filter is not yet supported by the backend. Try a different status.`
                  : `Failed to load rows (${rowsError}).`}
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <p className="empty-state__text">{rowFilter ? `No rows with status ${rowFilter}.` : "No rows found."}</p>
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
                    const isResending   = resending[row.id];
                    const rStatus       = resendStatus[row.id];
                    const isCancelling  = cancellingRow[row.id];
                    const isEditingThis = editingRow === row.id;
                    const terminal      = ["PROMOTED","REJECTED","SUPERSEDED","CANCELLED"].includes(row.status);
                    const isDraft       = row.status === "DRAFT";
                    const canResend     = ["STAGED","OTP_SENT","INVITE_FAILED","EXPIRED"].includes(row.status);
                    const canCancel     = !terminal;
                    return (
                      <>
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
                              <div className="bulk-row-actions">
                                {isDraft && (
                                  <button
                                    className={`btn btn--ghost btn--sm${isEditingThis ? " btn--active" : ""}`}
                                    onClick={() => {
                                      setEditingRow(isEditingThis ? null : row.id);
                                      setEditState({ email: row.email, mobile: row.mobile, name: row.name, dob: row.dob ?? "", gender: row.gender ?? "", pincode: row.pincode ?? "", city: row.city ?? "", state: row.state ?? "", panNumber: row.panNumber ?? "", aadhaarLast4: row.aadhaarLast4 ?? "", employeeId: row.employeeId ?? "" });
                                      setEditErr(null);
                                    }}
                                  >
                                    {isEditingThis ? "Close" : "✏ Edit"}
                                  </button>
                                )}
                                {canResend && (
                                  <>
                                    <button className="btn btn--ghost btn--sm" disabled={isResending} onClick={() => handleResend(row.id)}>
                                      {isResending ? "…" : "↩ Resend"}
                                    </button>
                                    {rStatus === "ok" && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>✓ Sent</span>}
                                    {rStatus && rStatus !== "ok" && <span style={{ fontSize: 11, color: "#dc2626" }}>{rStatus}</span>}
                                  </>
                                )}
                                {canCancel && (
                                  <button className="btn btn--danger btn--sm" disabled={isCancelling} onClick={() => handleCancelRow(row.id)}>
                                    {isCancelling ? "…" : "Cancel"}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                        {isEditingThis && (
                          <tr key={`${row.id}-edit`}>
                            <td colSpan={canUpload ? 7 : 6} style={{ padding: "12px 16px", background: "rgba(99,102,241,0.06)", borderTop: "1px solid rgba(165,180,252,0.12)" }}>
                              <div className="bulk-edit-form">
                                {[
                                  ["email","Email"],["mobile","Mobile"],["name","Name"],
                                  ["dob","DOB (YYYY-MM-DD)"],["gender","Gender (M/F/O)"],["pincode","Pincode"],
                                  ["city","City"],["state","State"],["panNumber","PAN"],
                                  ["aadhaarLast4","Aadhaar Last 4"],["employeeId","Employee ID"],
                                ].map(([field, label]) => (
                                  <label key={field} className="bulk-edit-field">
                                    <span className="bulk-edit-label">{label}</span>
                                    <input
                                      className="bulk-edit-input"
                                      value={editState[field] ?? ""}
                                      onChange={(e) => setEditState(p => ({ ...p, [field]: e.target.value }))}
                                    />
                                  </label>
                                ))}
                              </div>
                              {editErr && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{editErr}</div>}
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button className="btn btn--primary btn--sm" onClick={() => handleEditSave(row.id)} disabled={editSaving}>
                                  {editSaving ? "Saving…" : "Save"}
                                </button>
                                <button className="btn btn--ghost btn--sm" onClick={() => { setEditingRow(null); setEditErr(null); }}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
  const totalRows    = jobs.reduce((s, j) => s + (j.totalRows   ?? 0), 0);
  const totalValid   = jobs.reduce((s, j) => s + (j.parsedRows  ?? 0), 0);
  const totalInvalid = jobs.reduce((s, j) => s + (j.invalidRows ?? 0), 0);
  const activeJobs   = jobs.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length;

  return (
    <div className="tab-content bulk-view-enter">

      {/* Overview header */}
      <div className="bulk-overview">
        <div className="bulk-overview__left">
          <div className="bulk-page-hero__icon">📦</div>
          <div>
            <h2 className="bulk-page-hero__title">Bulk Operations</h2>
            <p className="bulk-page-hero__sub">Upload CSV files and track member enrollment at scale.</p>
          </div>
        </div>
        <div className="bulk-overview__kpis">
          <div className="bulk-kpi">
            <span className="bulk-kpi__val">{jobs.length}</span>
            <span className="bulk-kpi__lbl">Total Jobs</span>
          </div>
          <div className="bulk-kpi bulk-kpi--active">
            <span className="bulk-kpi__val">{activeJobs || 0}</span>
            <span className="bulk-kpi__lbl">Active</span>
            {activeJobs > 0 && <span className="bulk-polling-dot" style={{ marginLeft: 4 }} />}
          </div>
          <div className="bulk-kpi">
            <span className="bulk-kpi__val">{totalRows > 0 ? totalRows.toLocaleString() : "—"}</span>
            <span className="bulk-kpi__lbl">Total Rows</span>
          </div>
          <div className="bulk-kpi bulk-kpi--success">
            <span className="bulk-kpi__val">{totalValid > 0 ? totalValid.toLocaleString() : "—"}</span>
            <span className="bulk-kpi__lbl">Valid Rows</span>
          </div>
          {totalInvalid > 0 && (
            <div className="bulk-kpi bulk-kpi--warn">
              <span className="bulk-kpi__val">{totalInvalid.toLocaleString()}</span>
              <span className="bulk-kpi__lbl">Invalid</span>
            </div>
          )}
        </div>
      </div>

      {canUpload && (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">📤 Upload CSV</h2>
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
            <div className="bulk-upload-layout">
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
                {uploading && uploadProgress && (
                  <div className="bulk-upload-progress">
                    <div className="bulk-progress-info">
                      <span>Uploading…</span>
                      <span>
                        {(uploadProgress.loaded / (1024 * 1024)).toFixed(2)} MB
                        {" / "}
                        {(uploadProgress.total / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="bulk-progress-track">
                      <div
                        className="bulk-progress-fill"
                        style={{ width: `${Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%` }}
                      />
                    </div>
                    <div className="bulk-progress-pct">
                      {Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%
                    </div>
                  </div>
                )}
              </div>
              <div className="bulk-upload-sidebar">
                <div className="bulk-upload-reqs">
                  <div className="bulk-upload-reqs__title">Required columns</div>
                  <div className="bulk-upload-reqs__chips">
                    <code>email</code><code>mobile</code><code>name</code>
                  </div>
                  <div className="bulk-upload-reqs__note">Max 10 MB · CSV format only</div>
                </div>
                <button
                  className="btn btn--primary btn--create-shimmer"
                  style={{ width: "100%" }}
                  disabled={!selectedFile || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? "Uploading…" : "Upload File"}
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
              {jobsLoading ? "Refreshing…" : "↻ Refresh"}
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
          <div className="bulk-jobs-list">
            {jobs.map((job) => {
              const isActive = job.status === "PENDING" || job.status === "PROCESSING";
              const validPct = job.totalRows > 0 ? Math.round((job.parsedRows ?? 0) / job.totalRows * 100) : 0;
              const hasInvalid = (job.invalidRows ?? 0) > 0;
              const timeAgo = job.createdAt ? formatTimeAgo(new Date(job.createdAt)) : "—";
              return (
                <div key={job.id} className={`bulk-job-card${isActive ? " bulk-job-card--active" : ""}`}>
                  <div className="bulk-job-card__num">#{job.jobNumber}</div>
                  <div className="bulk-job-card__info">
                    <span className="bulk-job-card__name">{job.fileName}</span>
                    <div className="bulk-job-card__meta">
                      <span>🕐 {timeAgo}</span>
                      <span className="bulk-job-card__sep">·</span>
                      <span>{(job.totalRows ?? 0).toLocaleString()} rows total</span>
                      {hasInvalid && <span className="bulk-job-card__warn">⚠ {job.invalidRows} invalid</span>}
                    </div>
                    {(job.totalRows ?? 0) > 0 && (
                      <div className="bulk-job-card__progress-row">
                        <div className="bulk-job-card__bar">
                          <div
                            className="bulk-job-card__bar-fill"
                            style={{ width: `${validPct}%`, background: isActive ? undefined : "#16a34a" }}
                          />
                        </div>
                        <span className="bulk-job-card__pct">{validPct}% valid</span>
                      </div>
                    )}
                  </div>
                  <div className="bulk-job-card__action">
                    <span className={`badge ${jobStatusClass(job.status)}`}>{job.status}</span>
                    <button className="btn btn--primary btn--sm" onClick={() => openDetail(job)}>View →</button>
                  </div>
                </div>
              );
            })}
          </div>
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
/*  AUDIT module tab — paginated audit log with filters        */
/* ─────────────────────────────────────────────────────────── */
const AUDIT_MODULES = ["", "Organization", "CmsUser", "Role", "BulkUpload", "ConsumerUser", "ORG", "CMS_USER", "ROLE", "BULK", "USER"];
const AUDIT_ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "READ", "UPLOAD", "ASSIGN", "REVOKE", "LOGIN", "LOGOUT"];
const AUDIT_MODULE_LABELS = {
  Organization: "Organization", CmsUser: "CMS User", Role: "Role",
  BulkUpload: "Bulk Upload", ConsumerUser: "Consumer User",
  ORG: "Organisation", CMS_USER: "CMS User", ROLE: "Role", BULK: "Bulk Ops", USER: "Consumer User",
};
const AUDIT_MODULE_COLORS = {
  Organization: { bg: "rgba(99,102,241,0.08)",  color: "#4f46e5",  border: "rgba(99,102,241,0.2)"  },
  CmsUser:      { bg: "rgba(16,185,129,0.08)",  color: "#059669",  border: "rgba(16,185,129,0.2)"  },
  Role:         { bg: "rgba(124,58,237,0.08)",  color: "#7c3aed",  border: "rgba(124,58,237,0.2)"  },
  BulkUpload:   { bg: "rgba(245,158,11,0.08)",  color: "#b45309",  border: "rgba(245,158,11,0.2)"  },
  ConsumerUser: { bg: "rgba(20,184,166,0.08)",  color: "#0d9488",  border: "rgba(20,184,166,0.2)"  },
  ORG:          { bg: "rgba(99,102,241,0.08)",  color: "#4f46e5",  border: "rgba(99,102,241,0.2)"  },
  CMS_USER:     { bg: "rgba(16,185,129,0.08)",  color: "#059669",  border: "rgba(16,185,129,0.2)"  },
  ROLE:         { bg: "rgba(124,58,237,0.08)",  color: "#7c3aed",  border: "rgba(124,58,237,0.2)"  },
  BULK:         { bg: "rgba(245,158,11,0.08)",  color: "#b45309",  border: "rgba(245,158,11,0.2)"  },
  USER:         { bg: "rgba(20,184,166,0.08)",  color: "#0d9488",  border: "rgba(20,184,166,0.2)"  },
};


function AuditModuleTab({ actions, isGlobal = false }) {
  // Global audit is super-admin only — always allow; org-scoped audit requires READ/MANAGE
  const canRead = isGlobal || actions.has("READ") || actions.has("MANAGE");
  const allOrgs = useSelector((s) => s.orgs?.orgs ?? []);

  // Start with ready=false so no API call fires on mount.
  // Once the user triggers a load and the endpoint responds with data, ready flips to true.
  const [ready, setReady]           = useState(false);
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [orgFilter, setOrgFilter]       = useState("");
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");

  const loadLogs = useCallback(async (pg, mod, act, from, to, org) => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      // API expects ISO datetime strings; date inputs give YYYY-MM-DD
      const fromIso = from ? `${from}T00:00:00.000Z` : undefined;
      const toIso   = to   ? `${to}T23:59:59.999Z`   : undefined;
      const data = await auditService.listAuditLogs({
        page:           pg,
        size:           20,
        module:         mod || undefined,
        entityType:     mod || undefined,
        action:         act || undefined,
        from:           fromIso,
        to:             toIso,
        organizationId: org || undefined,   // org ID from dropdown; sets X-ORG-ID for the request
        isGlobal,
      });
      setReady(true);
      setLogs(data?.content ?? data?.items ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotalItems(data?.totalElements ?? data?.totalItems ?? 0);
    } catch (err) {
      const code = err?.response?.data?.errorCode;
      // NOT_FOUND means the endpoint isn't deployed yet — leave ready=false, no error shown
      if (code !== "NOT_FOUND") {
        setError(code ?? "FETCH_FAILED");
      }
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  // Load on mount so data is visible as soon as the tab opens.
  useEffect(() => { loadLogs(0, "", "", "", "", ""); }, [loadLogs]);

  const handleApplyFilters = () => {
    setPage(0);
    loadLogs(0, moduleFilter, actionFilter, fromDate, toDate, orgFilter);
  };

  const handleClearFilters = () => {
    setModuleFilter(""); setActionFilter(""); setOrgFilter(""); setFromDate(""); setToDate("");
    setPage(0);
    loadLogs(0, "", "", "", "", "");
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    loadLogs(pg, moduleFilter, actionFilter, fromDate, toDate, orgFilter);
  };

  const handleRefresh = () => loadLogs(page, moduleFilter, actionFilter, fromDate, toDate, orgFilter);

  if (!canRead) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <p className="empty-state__text">You don't have permission to view audit logs.</p>
        </div>
      </div>
    );
  }

  // Loading skeleton shown on first load (before data or error arrives)
  if (!ready && loading) {
    return (
      <div className="tab-content">
        <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
      </div>
    );
  }

  // First load failed (auth error, network issue, or endpoint not found)
  if (!ready && !loading) {
    return (
      <div className="tab-content">
        <div className="card">
          <div className="card__body" style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>{error ? "⚠️" : "🔍"}</div>
            <h3 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: 16, fontWeight: 600 }}>
              {error ? "Failed to load audit logs" : "Audit Log unavailable"}
            </h3>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 14, maxWidth: 360, marginInline: "auto" }}>
              {error
                ? `Error: ${error}`
                : "The audit log endpoint could not be reached. It may not yet be deployed on this backend."}
            </p>
            <button className="btn btn--ghost btn--sm" onClick={() => loadLogs(0, "", "", "", "", "")}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = moduleFilter || actionFilter || fromDate || toDate || orgFilter;

  return (
    <div className="tab-content">
      <div className="card">

        {/* ── Card header ── */}
        <div className="card__header">
          <h2 className="card__title">
            <span style={{ fontSize: 16 }}>🔍</span>
            Audit Log
            {totalItems > 0 && <span className="card__count">{totalItems.toLocaleString()}</span>}
          </h2>
          <button className="btn btn--ghost btn--sm" onClick={handleRefresh} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {/* ── Filter row ── */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(99,102,241,0.08)",
          background: "rgba(248,250,252,0.6)",
        }}>
          <div className="form__field" style={{ minWidth: 130, flex: 1 }}>
            <label className="form__label">Entity Type</label>
            <select className="form__input form__select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="Organization">Organization</option>
              <option value="CmsUser">CMS User</option>
              <option value="Role">Role</option>
              <option value="BulkUpload">Bulk Upload</option>
              <option value="ConsumerUser">Consumer User</option>
            </select>
          </div>
          <div className="form__field" style={{ minWidth: 130, flex: 1 }}>
            <label className="form__label">Action</label>
            <select className="form__input form__select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{a || "All Actions"}</option>
              ))}
            </select>
          </div>
          {isGlobal && (
            <div className="form__field" style={{ minWidth: 140, flex: 1 }}>
              <label className="form__label">Organization</label>
              <select
                className="form__input form__select"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="">All Organizations</option>
                {allOrgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form__field" style={{ minWidth: 120, flex: 1 }}>
            <label className="form__label">From</label>
            <input type="date" className="form__input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="form__field" style={{ minWidth: 120, flex: 1 }}>
            <label className="form__label">To</label>
            <input type="date" className="form__input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
            {hasActiveFilters && (
              <button className="btn btn--ghost btn--sm" onClick={handleClearFilters} style={{ color: "#94a3b8" }}>
                ✕ Clear
              </button>
            )}
            <button className="btn btn--primary btn--sm" onClick={handleApplyFilters} disabled={loading}>
              {loading ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilters && (() => {
          const chipStyle = { display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600,
            padding:"3px 9px", borderRadius:20, border:"1px solid #ddd6c8", background:"#fff",
            color:"#374151", whiteSpace:"nowrap" };
          const xBtn = (onClear) => (
            <button onClick={onClear} style={{ background:"none", border:"none", cursor:"pointer",
              fontSize:12, color:"#9ca3af", padding:0, lineHeight:1, marginLeft:2 }}
              title="Remove filter">×</button>
          );
          const orgName = isGlobal && orgFilter
            ? (allOrgs.find((o) => o.id === orgFilter)?.name ?? orgFilter)
            : null;
          return (
            <div style={{
              display:"flex", flexWrap:"wrap", gap:6, alignItems:"center",
              padding:"8px 16px", borderBottom:"1px solid #ede8de",
              background:"#faf7f2",
            }}>
              <span style={{ fontSize:11, color:"#9ca3af", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginRight:2 }}>
                Active filters:
              </span>
              {moduleFilter && (
                <span style={{ ...chipStyle, background:"#fdf5f0", borderColor:"#f5c6bb", color:"#c0392b" }}>
                  Type: {AUDIT_MODULE_LABELS[moduleFilter] ?? moduleFilter}
                  {xBtn(() => { setModuleFilter(""); loadLogs(0, "", actionFilter, fromDate, toDate, orgFilter); })}
                </span>
              )}
              {actionFilter && (
                <span style={{ ...chipStyle, background:"#f0fdf4", borderColor:"#bbf7d0", color:"#15803d" }}>
                  Action: {actionFilter}
                  {xBtn(() => { setActionFilter(""); loadLogs(0, moduleFilter, "", fromDate, toDate, orgFilter); })}
                </span>
              )}
              {orgName && (
                <span style={{ ...chipStyle, background:"#eff6ff", borderColor:"#bfdbfe", color:"#1d4ed8" }}>
                  Org: {orgName}
                  {xBtn(() => { setOrgFilter(""); loadLogs(0, moduleFilter, actionFilter, fromDate, toDate, ""); })}
                </span>
              )}
              {fromDate && (
                <span style={chipStyle}>
                  From: {fromDate}
                  {xBtn(() => { setFromDate(""); loadLogs(0, moduleFilter, actionFilter, "", toDate, orgFilter); })}
                </span>
              )}
              {toDate && (
                <span style={chipStyle}>
                  To: {toDate}
                  {xBtn(() => { setToDate(""); loadLogs(0, moduleFilter, actionFilter, fromDate, "", orgFilter); })}
                </span>
              )}
              <button onClick={handleClearFilters}
                style={{ marginLeft:"auto", fontSize:11, color:"#9ca3af", background:"none",
                  border:"none", cursor:"pointer", fontFamily:"inherit", padding:"2px 6px",
                  borderRadius:6, transition:"color 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.color="#c0392b"}
                onMouseLeave={(e) => e.currentTarget.style.color="#9ca3af"}>
                Clear all
              </button>
            </div>
          );
        })()}

        {/* ── Error ── */}
        {error && (
          <div className="error-banner" style={{ margin: "10px 16px" }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* ── Log table ── */}
        {loading && logs.length === 0 ? (
          <div className="empty-state"><p className="empty-state__text">Loading audit logs…</p></div>
        ) : !loading && logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <p className="empty-state__text">
              {hasActiveFilters ? "No logs match the current filters." : "No audit logs found."}
            </p>
            {hasActiveFilters && (
              <button className="btn btn--ghost btn--sm" onClick={handleClearFilters} style={{ marginTop: 4 }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="tbl" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Timestamp</th>
                  <th style={{ width: 160 }}>Actor</th>
                  <th style={{ width: 110 }}>Entity Type</th>
                  <th style={{ width: 100 }}>Action</th>
                  <th style={{ width: 130 }}>Organization</th>
                  <th style={{ width: 170 }}>Target</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actorInitial = ((log.actor?.fullName ?? log.actor?.email) || "?")[0].toUpperCase();
                  const entityType  = log.entityType || log.module || "";
                  const modStyle    = entityType ? (AUDIT_MODULE_COLORS[entityType] ?? null) : null;
                  const ts          = log.createdAt ? new Date(log.createdAt) : null;
                  const targetText  = log.target?.label ?? log.target?.id ?? "—";
                  const orgDisplay  = log.organization?.name
                    ? `${log.organization.name} (${log.orgSlug || log.organization.slug || ""})`
                    : (log.orgSlug || "—");
                  /* clip = reliable BFC clip; summary uses maxHeight for 2-line cap */
                  const clip = { overflow: "hidden", width: "100%" };
                  const summaryLineH = 1.55;
                  const summaryMaxH  = `${Math.ceil(12 * summaryLineH * 2) + 2}px`; // ~40px

                  return (
                    <tr key={log.id}>
                      {/* Timestamp */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip}>
                          {ts ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                                {formatTimeAgo(ts)}
                              </div>
                              <div className="tbl__mono" style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", marginTop: 2 }}
                                title={ts.toLocaleString()}>
                                {ts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </div>
                            </>
                          ) : "—"}
                        </div>
                      </td>

                      {/* Actor */}
                      <td style={{ verticalAlign: "top", textAlign: "left" }}>
                        <div style={{ ...clip, display: "flex", alignItems: "flex-start", gap: 7 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700, color: "#fff", marginTop: 1,
                          }}>
                            {actorInitial}
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {log.actor?.fullName ?? log.actor?.email ?? "—"}
                            </div>
                            {log.actor?.email && log.actor?.fullName && (
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {log.actor.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Entity Type */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip}>
                          {entityType ? (
                            <span style={{
                              display: "inline-block", fontSize: 10, fontWeight: 700,
                              padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap",
                              background: modStyle?.bg ?? "rgba(100,116,139,0.08)",
                              color: modStyle?.color ?? "#64748b",
                              border: `1px solid ${modStyle?.border ?? "#dde6f2"}`,
                            }}>
                              {AUDIT_MODULE_LABELS[entityType] ?? entityType}
                            </span>
                          ) : <span className="tbl__muted">—</span>}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip}>
                          {log.action ? (
                            <span className={`action-badge action-badge--${log.action.toLowerCase()}`}
                              style={{ whiteSpace: "nowrap" }}>
                              {log.action}
                            </span>
                          ) : "—"}
                        </div>
                      </td>

                      {/* Organization */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip} title={orgDisplay}>
                          <span style={{ display: "block", fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {log.organization?.name || log.orgSlug || "—"}
                          </span>
                          {log.orgSlug && log.organization?.name && (
                            <span className="tbl__mono" style={{ fontSize: 10, color: "#9ca3af" }}>{log.orgSlug}</span>
                          )}
                        </div>
                      </td>

                      {/* Target */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip} title={targetText}>
                          <span style={{
                            display: "block", fontSize: 12, color: "#64748b",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {targetText}
                          </span>
                        </div>
                      </td>

                      {/* Summary — capped to 2 lines via maxHeight on the BFC div */}
                      <td style={{ verticalAlign: "top", textAlign: "left" }}>
                        <div style={{
                          ...clip,
                          maxHeight: summaryMaxH,
                          overflow: "hidden",
                          fontSize: 12,
                          color: "#475569",
                          lineHeight: summaryLineH,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }} title={log.summary ?? ""}>
                          {log.summary ?? "—"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="bulk-pagination" style={{ justifyContent: "space-between" }}>
                <span className="tbl__muted" style={{ fontSize: 12 }}>
                  Page {page + 1} of {totalPages}
                  {totalItems > 0 && ` · ${totalItems.toLocaleString()} entries`}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn--ghost btn--sm" disabled={page === 0}
                    onClick={() => handlePageChange(0)} title="First page">«</button>
                  <button className="btn btn--ghost btn--sm" disabled={page === 0}
                    onClick={() => handlePageChange(page - 1)}>← Prev</button>
                  <button className="btn btn--ghost btn--sm" disabled={page >= totalPages - 1}
                    onClick={() => handlePageChange(page + 1)}>Next →</button>
                  <button className="btn btn--ghost btn--sm" disabled={page >= totalPages - 1}
                    onClick={() => handlePageChange(totalPages - 1)} title="Last page">»</button>
                </div>
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
function ModuleTab({ module, actions, can, onJobsLoad, isGlobal }) {
  if (module === "ORG")      return <OrgModuleTab      actions={actions} can={can} />;
  if (module === "ROLE")     return <RoleModuleTab     actions={actions} can={can} />;
  if (module === "BULK")     return <BulkModuleTab     actions={actions} onJobsLoad={onJobsLoad} />;
  if (module === "CMS_USER") return <UserModuleTab     actions={actions} can={can} />;
  if (module === "USER")     return <ConsumerUserModuleTab actions={actions} />;
  if (module === "AUDIT")    return <AuditModuleTab    actions={actions} isGlobal={!!isGlobal} />;
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
const EXCLUDED_MODULES = new Set(["MEMBER", "DEPENDENT", "USER"]);

const MODULE_LABELS = {
  ORG:      "Organizations",
  USER:     "Consumer Users",  // consumer end-users (mobile app members) via /users
  CMS_USER: "Manage Users",   // backoffice operators via /cms-users
  ROLE:     "Manage Roles",
  BULK:     "Operations",
  AUDIT:    "Audit Log",
};

const MODULE_ICONS = {
  ORG: "🏢", CMS_USER: "👥", ROLE: "🎭",
  BULK: "📦", AUDIT: "🔍", REPORT: "📊",
  NOTIFICATION: "🔔", SYSTEM: "⚙️", POLICY: "📋",
  CLAIM: "🗂️", PAYMENT: "💳", DOCUMENT: "📄",
};

const MODULE_COLORS = {
  ORG:          { from: "#6366f1", to: "#818cf8", bg: "rgba(99,102,241,0.12)",   border: "rgba(99,102,241,0.28)"   },
  CMS_USER:     { from: "#ec4899", to: "#f472b6", bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.28)"  },
  ROLE:         { from: "#8b5cf6", to: "#a78bfa", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.28)"  },
  BULK:         { from: "#f59e0b", to: "#fbbf24", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.28)"  },
  AUDIT:        { from: "#14b8a6", to: "#2dd4bf", bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.28)"  },
  REPORT:       { from: "#3b82f6", to: "#60a5fa", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.28)"  },
  NOTIFICATION: { from: "#f97316", to: "#fb923c", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.28)"  },
  SYSTEM:       { from: "#64748b", to: "#94a3b8", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.28)" },
  POLICY:       { from: "#10b981", to: "#34d399", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.28)"  },
  CLAIM:        { from: "#ef4444", to: "#f87171", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.28)"   },
  PAYMENT:      { from: "#06b6d4", to: "#22d3ee", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.28)"   },
  DOCUMENT:     { from: "#84cc16", to: "#a3e635", bg: "rgba(132,204,22,0.12)",  border: "rgba(132,204,22,0.28)"  },
  __default:    { from: "#6366f1", to: "#818cf8", bg: "rgba(99,102,241,0.12)",   border: "rgba(99,102,241,0.28)"  },
};

const MODULE_DESCRIPTIONS = {
  ORG:          "Create and manage organizations",
  CMS_USER:     "Backoffice operators & access control",
  ROLE:         "Roles, permissions & policy rules",
  BULK:         "Upload and process bulk data jobs",
  AUDIT:        "System activity logs & audit trail",
  REPORT:       "Analytics, reports & data exports",
  NOTIFICATION: "Push, email & in-app notifications",
  SYSTEM:       "System settings & configuration",
  POLICY:       "Policy rules & compliance settings",
  CLAIM:        "Claims processing & management",
  PAYMENT:      "Payments, billing & transactions",
  DOCUMENT:     "Document storage & management",
};

const TILE_BG_ROTS = [-4, 3, -3, 4, -2, 3, -4, 2];

/* ─────────────────────────────────────────────────────────── */
/*  Helpers & constants                                         */
/* ─────────────────────────────────────────────────────────── */
const VIEW_LABELS = {
  orgs: "Organizations", "super-admins": "Super Admins",
  "global-audit": "Global Audit", "system-settings": "System Settings",
  "org-dashboard": "Dashboard", CMS_USER: "CMS Users",
  ROLE: "Roles & Perms", BULK: "Bulk Upload",
  AUDIT: "Audit Log", USER: "Members", settings: "Settings",
};

const ORG_AVATAR_COLORS = [
  "#e74c3c","#e67e22","#16a085","#2980b9","#8e44ad",
  "#d35400","#27ae60","#c0392b","#2471a3","#117a65",
];
function orgAvatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ORG_AVATAR_COLORS[Math.abs(h) % ORG_AVATAR_COLORS.length];
}
function orgInitials(name = "") {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "??";
}
function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/* ── NavItem ── */
function NavItem({ icon, label, view, activeView, onClick, count }) {
  return (
    <button
      className={`bp-nav-item${activeView === view ? " bp-nav-item--active" : ""}`}
      onClick={() => onClick(view)}
    >
      <span className="bp-nav-item__icon">{icon}</span>
      <span className="bp-nav-item__label">{label}</span>
      {count != null && <span className="bp-nav-item__count">{count}</span>}
    </button>
  );
}

/* ── OrgLandingView ── */
function OrgLandingView({ onEnterOrg, can }) {
  const dispatch  = useDispatch();
  const orgs      = useSelector((s) => s.orgs?.orgs ?? []);
  const loading   = useSelector((s) => s.orgs?.loading ?? false);

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode]         = useState("table"); // "table" | "grid"
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState("");
  const [newSlug, setNewSlug]           = useState("");
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating]         = useState(false);

  const handleExport = () => {
    const headers = ["Name","Slug","Status","Members","Operators","Bulk Jobs","Created","Last Updated"];
    const rows = filtered.map((o) => [
      `"${(o.name ?? "").replace(/"/g,'""')}"`,
      o.slug ?? "",
      o.status ?? "active",
      o.consumerUserCount ?? 0,
      o.cmsUserCount ?? 0,
      o.bulkOperationsCount ?? 0,
      o.createdAt ? new Date(o.createdAt).toISOString().slice(0,10) : "",
      o.updatedAt ? new Date(o.updatedAt).toISOString().slice(0,10) : "",
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url, download: `organisations-${new Date().toISOString().slice(0,10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = orgs.filter((o) => {
    const q  = search.toLowerCase();
    const ok = !q || o.name?.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q);
    const st = o.status ?? "active";
    const sf = statusFilter === "all" || st === statusFilter ||
               (statusFilter === "pending" && st === "pending_setup");
    return ok && sf;
  });

  const activeCount    = orgs.filter((o) => (o.status ?? "active") === "active").length;
  const inactiveCount  = orgs.filter((o) => o.status === "inactive" || o.status === "suspended").length;
  const pendingCount   = orgs.filter((o) => o.status === "pending_setup").length;
  const totalMembers   = orgs.reduce((s, o) => s + (o.consumerUserCount ?? 0), 0);
  const totalBulk      = orgs.reduce((s, o) => s + (o.bulkOperationsCount ?? 0), 0);

  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!newName.trim()) errs.name = "Required";
    if (!newSlug.trim()) errs.slug = "Required";
    else if (!/^[a-z0-9-]{2,50}$/.test(newSlug.trim())) errs.slug = "2–50 chars, lowercase alphanumeric & hyphens only";
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }
    setCreating(true);
    const res = await dispatch(apiCreateOrg({ name: newName.trim(), slug: newSlug.trim() }));
    setCreating(false);
    if (apiCreateOrg.fulfilled.match(res)) {
      setNewName(""); setNewSlug(""); setCreateErrors({}); setShowCreate(false);
    } else {
      setCreateErrors({ slug: res.payload === "SLUG_TAKEN" ? "Slug already taken" : "Create failed" });
    }
  };

  const statusClass = (st) => {
    if (!st || st === "active") return "bp-status--active";
    if (st === "suspended") return "bp-status--suspended";
    return "bp-status--inactive";
  };

  return (
    <div className="bp-landing">
      {/* Scope label */}
      <p className="bp-landing__scope-label">Super Admin Scope · All Tenants</p>

      {/* Header */}
      <div className="bp-landing__hdr">
        <div>
          <h1 className="bp-landing__title">Organizations</h1>
          <p className="bp-landing__sub">Pick an organization to manage its operators, members, roles, and audit trail.</p>
        </div>
        <div className="bp-landing__actions">
          <div className="bp-view-toggle">
            <button className={`bp-view-btn${viewMode === "table" ? " bp-view-btn--active" : ""}`} onClick={() => setViewMode("table")}>Table</button>
            <button className={`bp-view-btn${viewMode === "grid"  ? " bp-view-btn--active" : ""}`} onClick={() => setViewMode("grid")}>Grid</button>
          </div>
          <button className="bp-export-btn" onClick={handleExport} title="Export as CSV">↓ Export</button>
          {can("ORG_CREATE") && (
            <button className="bp-new-org-btn" onClick={() => setShowCreate(true)}>
              + New organization
            </button>
          )}
        </div>
      </div>

      <hr className="bp-landing__divider" />

      {/* Stats */}
      <div className="bp-stats-row">
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Organizations</div>
          <div className="bp-stat-box__value">{orgs.length}</div>
          <div className="bp-stat-box__sub">{activeCount} active · {inactiveCount} suspended · {pendingCount} pending</div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Members across orgs</div>
          <div className="bp-stat-box__value">{totalMembers.toLocaleString()}</div>
          <div className="bp-stat-box__sub">across all organisations</div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Bulk runs in flight</div>
          <div className={`bp-stat-box__value${totalBulk > 0 ? " bp-stat-box__value--accent" : ""}`}>{totalBulk}</div>
          <div className="bp-stat-box__sub">active bulk operations</div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Open Issues</div>
          <div className="bp-stat-box__value">—</div>
          <div className="bp-stat-box__sub bp-stat-box__sub--accent" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bp-landing__toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="bp-search-wrap">
            <input
              className="bp-landing__search"
              placeholder="Filter by name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bp-filter-pills">
            {[["all","All"],["active","Active"],["pending","Pending"],["suspended","Suspended"]].map(([k,l]) => (
              <button
                key={k}
                className={`bp-filter-pill${statusFilter === k ? " bp-filter-pill--active" : ""}`}
                onClick={() => setStatusFilter(k)}
              >{l}</button>
            ))}
          </div>
        </div>
        <span className="bp-showing">Showing {filtered.length} of {orgs.length}</span>
      </div>

      {/* Table */}
      {loading && orgs.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af" }}>Loading organisations…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af" }}>No organisations match your search or filter.</div>
      ) : viewMode === "grid" ? (
        /* ── Grid view ── */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:14, marginTop:12 }}>
          {filtered.map((org) => {
            const bulkCount = org.bulkOperationsCount ?? 0;
            return (
              <div key={org.id}
                onClick={() => onEnterOrg(org)}
                style={{
                  background:"#fff", border:"1px solid #e0d9cc", borderRadius:12,
                  padding:"20px", cursor:"pointer", transition:"box-shadow 0.15s, border-color 0.15s",
                  display:"flex", flexDirection:"column", gap:12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor="#c0392b"; e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor="#e0d9cc"; e.currentTarget.style.boxShadow="none"; }}
              >
                {/* Card header */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                    background: orgAvatarColor(org.name), display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>
                    {orgInitials(org.name)}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#1a1a2e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {org.name}
                      {org.isDefault && <span className="bp-default-tag">Default</span>}
                    </div>
                    <div style={{ fontSize:11, fontFamily:"monospace", color:"#9ca3af", marginTop:2 }}>{org.slug}</div>
                  </div>
                  <span className={`bp-status ${statusClass(org.status)}`} style={{ marginLeft:"auto", flexShrink:0 }}>
                    {org.status ?? "active"}
                  </span>
                </div>
                {/* Stats row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, borderTop:"1px solid #f5f0e8", paddingTop:12 }}>
                  {[
                    { label:"Members",   value:(org.consumerUserCount ?? 0).toLocaleString() },
                    { label:"Operators", value: org.cmsUserCount ?? 0 },
                    { label:"Bulk",      value: bulkCount, accent: bulkCount > 0 },
                  ].map(({ label, value, accent }) => (
                    <div key={label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:16, fontWeight:800, color: accent ? "#c0392b" : "#1a1a2e" }}>{value}</div>
                      <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {/* Footer */}
                <div style={{ fontSize:11, color:"#9ca3af", borderTop:"1px solid #f5f0e8", paddingTop:10 }}>
                  Updated {timeAgo(org.updatedAt)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table view ── */
        <div className="bp-table-wrap">
          <table className="bp-org-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Slug</th>
                <th style={{ textAlign: "center" }}>Plan</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Members</th>
                <th style={{ textAlign: "center" }}>Operators</th>
                <th style={{ textAlign: "center" }}>Bulk in flight</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => {
                const bulkCount = org.bulkOperationsCount ?? 0;
                return (
                  <tr key={org.id} onClick={() => onEnterOrg(org)} style={{ cursor: "pointer" }}>
                    <td>
                      <div className="bp-org-cell">
                        <div className="bp-org-avatar" style={{ background: orgAvatarColor(org.name) }}>
                          {orgInitials(org.name)}
                        </div>
                        <div>
                          <div className="bp-org-name">
                            {org.name}
                            {org.isDefault && <span className="bp-default-tag">Default</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="bp-tbl-mono">{org.slug}</span></td>
                    <td style={{ textAlign: "center" }}><span className="bp-tbl-plan">—</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`bp-status ${statusClass(org.status)}`}>
                        {org.status ?? "active"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="bp-tbl-num">{(org.consumerUserCount ?? 0).toLocaleString()}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="bp-tbl-num">{org.cmsUserCount ?? 0}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={bulkCount > 0 ? "bp-tbl-num--accent" : "bp-tbl-num--zero"}>
                        {bulkCount > 0 ? bulkCount : "0"}
                      </span>
                    </td>
                    <td><span className="bp-tbl-time">{timeAgo(org.updatedAt)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create org modal */}
      {showCreate && (
        <div className="bp-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="bp-modal__title">New Organization</h3>
            <form onSubmit={handleCreate} noValidate>
              <div className="form__field" style={{ marginBottom: 14 }}>
                <label className="form__label" style={{ color: "#374151" }}>Organisation Name *</label>
                <input
                  className={`form__input${createErrors.name ? " form__input--err" : ""}`}
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateErrors((p) => ({ ...p, name: "" })); }}
                  placeholder="e.g. Acme Insurance"
                  autoFocus
                  style={{ background: "#fff", color: "#1a1a2e", borderColor: "#ddd6c8" }}
                />
                {createErrors.name && <span className="form__err">{createErrors.name}</span>}
              </div>
              <div className="form__field" style={{ marginBottom: 20 }}>
                <label className="form__label" style={{ color: "#374151" }}>
                  Slug * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(immutable, 2–50 chars)</span>
                </label>
                <input
                  className={`form__input${createErrors.slug ? " form__input--err" : ""}`}
                  value={newSlug}
                  onChange={(e) => { setNewSlug(e.target.value.toLowerCase()); setCreateErrors((p) => ({ ...p, slug: "" })); }}
                  placeholder="e.g. acme"
                  style={{ background: "#fff", color: "#1a1a2e", borderColor: "#ddd6c8" }}
                />
                {createErrors.slug && <span className="form__err">{createErrors.slug}</span>}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button type="submit" className="bp-new-org-btn" style={{ fontSize: 13 }} disabled={creating}>
                  {creating ? "Creating…" : "Create organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── OrgDashboardView ── */
function OrgDashboardView({ onNavigate }) {
  const { currentUser, activeOrg } = useApp();
  const usersTotal = useSelector((s) => s.users?.totalItems ?? 0);
  const rolesCount = useSelector((s) => s.roles?.roles?.length ?? 0);

  const [auditLogs, setAuditLogs]   = useState([]);
  const [lastActivity, setLastActivity] = useState(null);
  const [bulkIssues, setBulkIssues] = useState([]);

  useEffect(() => {
    auditService.listAuditLogs({ page: 0, size: 6 })
      .then((d) => {
        const items = d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
        setAuditLogs(items);
        if (items.length > 0) setLastActivity(items[0]);
      })
      .catch(() => {});

    bulkService.listJobs({ page: 0, size: 10 })
      .then((d) => {
        const jobs = d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
        const issues = [];
        const errored = jobs.filter((j) => j.status === "FAILED" || (j.invalidRows > 0));
        if (errored.length > 0) issues.push({ type: "bulk", color: "#c0392b", text: `BULK · ${errored.length} JOB${errored.length > 1 ? "S" : ""} WITH ERRORS`, sub: `${errored.length} job(s) have failed or invalid rows.` });
        issues.push({ type: "auth", color: "#16a085", text: "AUTH · ALL CLEAR", sub: "No failed login spikes in last 24 hours." });
        setBulkIssues(issues);
      })
      .catch(() => {
        setBulkIssues([{ type: "auth", color: "#16a085", text: "AUTH · ALL CLEAR", sub: "No failed login spikes in last 24 hours." }]);
      });
  }, [activeOrg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionLabel = (action) => {
    const colors = { CREATE:"#16a085", UPDATE:"#2980b9", DELETE:"#c0392b", LOGIN:"#8e44ad", ASSIGN:"#d35400", REVOKE:"#c0392b" };
    return (
      <span style={{
        display:"inline-block", padding:"1px 6px", borderRadius:4, border:`1px solid ${colors[action] ?? "#aaa"}`,
        color: colors[action] ?? "#555", fontSize:10, fontWeight:700, letterSpacing:"0.04em", marginRight:6
      }}>{action}</span>
    );
  };

  const totalMembers   = activeOrg?.consumerUserCount ?? 0;
  const bulkInFlight   = activeOrg?.bulkOperationsCount ?? 0;
  const lastActivityStr = lastActivity
    ? `${timeAgo(lastActivity.createdAt || lastActivity.timestamp)} · ${lastActivity.actorEmail || lastActivity.actorName || "System"}`
    : "—";

  return (
    <div className="bp-org-dash">
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <h1 className="bp-org-dash__title">Dashboard</h1>
          <p className="bp-org-dash__sub">
            Welcome back, {currentUser?.name || currentUser?.email?.split("@")[0] || "Admin"}.
            {" "}Here's what's happening in <strong style={{ color:"#1a1a2e" }}>{activeOrg?.name}</strong> right now.
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0, paddingTop:4 }}>
          <button className="bp-new-org-btn" style={{ fontSize:12 }} onClick={() => onNavigate("BULK")}>↑ New bulk upload</button>
        </div>
      </div>

      <hr className="bp-landing__divider" />

      {/* Stats row */}
      <div className="bp-stats-row" style={{ marginBottom:28 }}>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Total Members</div>
          <div className="bp-stat-box__value">{totalMembers.toLocaleString()}</div>
          <div className="bp-stat-box__sub">consumer members</div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Operators</div>
          <div className="bp-stat-box__value">{usersTotal || "—"}</div>
          <div className="bp-stat-box__sub">backoffice users</div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Bulk Runs in Flight</div>
          <div className={`bp-stat-box__value${bulkInFlight > 0 ? " bp-stat-box__value--accent" : ""}`}>{bulkInFlight}</div>
          <div className="bp-stat-box__sub" style={{ cursor: bulkInFlight > 0 ? "pointer" : "default", color: bulkInFlight > 0 ? "#c0392b" : undefined }}
            onClick={bulkInFlight > 0 ? () => onNavigate("BULK") : undefined}>
            {bulkInFlight > 0 ? "See bulk upload →" : "no active jobs"}
          </div>
        </div>
        <div className="bp-stat-box">
          <div className="bp-stat-box__label">Last Activity</div>
          <div className="bp-stat-box__value" style={{ fontSize: lastActivity ? 22 : 36 }}>
            {lastActivity ? timeAgo(lastActivity.createdAt || lastActivity.timestamp) : "—"}
          </div>
          <div className="bp-stat-box__sub">
            {lastActivity
              ? (lastActivity.actor?.fullName || lastActivity.actor?.email || "System")
              : "no recent events"}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 420px", gap:16 }}>

        {/* Live activity */}
        <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"20px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#1a1a2e" }}>Live activity</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>Last {auditLogs.length} events in this org</div>
            </div>
            <button className="bp-export-btn" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => onNavigate("AUDIT")}>
              Open audit log →
            </button>
          </div>
          <div>
            {auditLogs.length === 0 ? (
              <div style={{ color:"#9ca3af", fontSize:13, padding:"24px 0", textAlign:"center" }}>No recent activity</div>
            ) : auditLogs.map((log, i) => {
              const ts      = log.createdAt || "";
              const dt      = ts
                ? new Date(ts).toLocaleDateString("en-IN", { day:"numeric", month:"short" }) + ", " +
                  new Date(ts).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })
                : "—";
              const actor   = log.actor?.fullName || log.actor?.email || "System";
              const module  = log.module || "";
              const target  = log.target?.label || log.target?.id || "";
              const summary = log.summary || "";
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "130px 1fr",
                  gap: "0 16px",
                  padding: "12px 0",
                  borderBottom: "1px solid #ede8de",
                  alignItems: "start",
                }}>
                  {/* Timestamp */}
                  <div style={{ fontSize:11, color:"#9ca3af", paddingTop:2, whiteSpace:"nowrap" }}>{dt}</div>

                  {/* Event details */}
                  <div style={{ minWidth:0 }}>
                    {/* Actor + action badge */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{actor}</span>
                      {actionLabel(log.action)}
                    </div>
                    {/* Target */}
                    {(module || target) && (
                      <div style={{ fontSize:12, color:"#6b7280", marginBottom: summary ? 2 : 0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {module}{target ? ` · ${target}` : ""}
                      </div>
                    )}
                    {/* Summary */}
                    {summary && (
                      <div style={{ fontSize:11, color:"#b0a898", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {summary}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Needs attention */}
          <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"20px 24px" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#1a1a2e", marginBottom:4 }}>Needs your attention</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginBottom:14 }}>{bulkIssues.length} items</div>
            {bulkIssues.map((item, i) => (
              <div key={i} style={{ borderLeft:`3px solid ${item.color}`, paddingLeft:12, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:item.color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{item.text}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Member growth placeholder */}
          <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"20px 24px" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#1a1a2e", marginBottom:2 }}>Member growth</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginBottom:16 }}>Last 6 months · cumulative</div>
            {/* Simple SVG spark chart */}
            <svg width="100%" height="80" viewBox="0 0 300 80" style={{ overflow:"visible" }}>
              <defs>
                <linearGradient id="grd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c0392b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#c0392b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,70 C40,65 80,55 120,45 C160,35 200,20 240,15 C260,12 280,10 300,8"
                fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
              <path d="M0,70 C40,65 80,55 120,45 C160,35 200,20 240,15 C260,12 280,10 300,8 L300,80 L0,80 Z"
                fill="url(#grd)" />
              <circle cx="300" cy="8" r="4" fill="#c0392b" />
            </svg>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#9ca3af", marginTop:4 }}>
              {["Dec","Jan","Feb","Mar","Apr","May"].map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SystemSettingsView ── */
function SystemSettingsView() {
  const orgs       = useSelector((s) => s.orgs?.orgs ?? []);
  const usersTotal = useSelector((s) => s.users?.totalItems ?? 0);
  const rolesCount = useSelector((s) => s.roles?.roles?.length ?? 0);

  const activeOrgs   = orgs.filter((o) => (o.status ?? "active") === "active").length;
  const totalMembers = orgs.reduce((s, o) => s + (o.consumerUserCount ?? 0), 0);
  const totalBulk    = orgs.reduce((s, o) => s + (o.bulkOperationsCount ?? 0), 0);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

  const Section = ({ title, children }) => (
    <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"22px 26px", marginBottom:16 }}>
      <h3 style={{ fontSize:14, fontWeight:700, color:"#1a1a2e", margin:"0 0 18px", paddingBottom:12, borderBottom:"1px solid #f5f0e8" }}>{title}</h3>
      {children}
    </div>
  );

  const Row = ({ label, value, mono }) => (
    <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:8, marginBottom:12, alignItems:"center" }}>
      <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#9ca3af" }}>{label}</span>
      <span style={{ fontSize:13, color:"#1a1a2e", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ background:"#faf7f2", border:"1px solid #e0d9cc", borderRadius:8, padding:"14px 18px", borderLeft:`3px solid ${color ?? "#c0392b"}` }}>
      <div style={{ fontSize:22, fontWeight:800, color:"#1a1a2e", lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#9ca3af", marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{sub}</div>}
    </div>
  );

  const Badge = ({ children, color = "#374151", bg = "#f3f4f6", border = "#e5e7eb" }) => (
    <span style={{ display:"inline-block", padding:"2px 10px", background:bg, border:`1px solid ${border}`, borderRadius:4, fontSize:11, fontWeight:700, color }}>{children}</span>
  );

  return (
    <div style={{ padding:"28px 32px", maxWidth:900 }}>
      {/* Header */}
      <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#9ca3af", margin:"0 0 6px" }}>
        PLATFORM · SYSTEM SETTINGS
      </p>
      <h1 style={{ fontSize:28, fontWeight:800, color:"#1a1a2e", margin:"0 0 5px", letterSpacing:"-0.02em" }}>System Settings</h1>
      <p style={{ fontSize:13, color:"#6b7280", margin:"0 0 24px" }}>Platform configuration, API details, and system-wide statistics.</p>
      <hr style={{ border:"none", borderTop:"1px solid #e0d9cc", margin:"0 0 24px" }} />

      {/* Platform stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        <StatCard label="Organizations"     value={orgs.length}           sub={`${activeOrgs} active`}       color="#4f46e5" />
        <StatCard label="Total Members"     value={totalMembers.toLocaleString()} sub="across all orgs"       color="#059669" />
        <StatCard label="Bulk Jobs Active"  value={totalBulk}             sub="in flight"                     color="#c0392b" />
        <StatCard label="Operators"         value={usersTotal || "—"}     sub="CMS users"                     color="#b45309" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Platform info */}
        <Section title="Platform Information">
          <Row label="Environment"   value={<Badge>STAGING</Badge>} />
          <Row label="Region"        value="ap-south-1" />
          <Row label="API Version"   value={<Badge color="#1d4ed8" bg="#eff6ff" border="#bfdbfe">v1</Badge>} />
          <Row label="API Base URL"  value={apiBase} mono />
          <Row label="Build"         value="Backoffice v2.0" />
          <Row label="Auth Method"   value="HttpOnly Cookie (JWT + Refresh)" />
        </Section>

        {/* API configuration */}
        <Section title="API Configuration">
          <Row label="Access Token"   value="HttpOnly · 15 min TTL" />
          <Row label="Refresh Token"  value="HttpOnly · 7 day TTL" />
          <Row label="Token Refresh"  value={<span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>POST /auth/refresh</span>} />
          <Row label="Org Context"    value={<span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>X-ORG-ID header</span>} />
          <Row label="Permissions"    value={<span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>GET /me/permissions</span>} />
          <Row label="Credentials"    value="withCredentials: true" mono />
        </Section>

        {/* Organisation summary */}
        <Section title="Organisation Summary">
          <Row label="Total Orgs"    value={orgs.length} />
          <Row label="Active"        value={activeOrgs} />
          <Row label="Inactive"      value={orgs.filter((o) => o.status === "inactive").length} />
          <Row label="Default Org"   value={orgs.find((o) => o.isDefault)?.name ?? "—"} />
          <Row label="Roles Loaded"  value={rolesCount} />
          <Row label="Bulk Jobs"     value={totalBulk > 0 ? <span style={{ color:"#c0392b", fontWeight:700 }}>{totalBulk} in flight</span> : "0"} />
        </Section>

        {/* Permissions reference */}
        <Section title="Permission Modules">
          {[
            { module:"ORG",      label:"Organizations",  actions:["READ","CREATE","UPDATE","DELETE","MANAGE"] },
            { module:"CMS_USER", label:"Manage Users",   actions:["READ","CREATE","UPDATE","DELETE","MANAGE"] },
            { module:"ROLE",     label:"Roles & Perms",  actions:["READ","CREATE","UPDATE","DELETE","MANAGE","ASSIGN"] },
            { module:"BULK",     label:"Operations",     actions:["READ","UPLOAD"] },
            { module:"AUDIT",    label:"Audit Log",      actions:["READ","MANAGE"] },
            { module:"USER",     label:"Consumer Users", actions:["READ","UPDATE"] },
          ].map(({ module, label, actions }) => (
            <div key={module} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:11, fontFamily:"monospace", fontWeight:700, color:"#6b7280", width:80, flexShrink:0 }}>{module}</span>
              <span style={{ fontSize:11, color:"#9ca3af", flex:1 }}>{label}</span>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {actions.map((a) => (
                  <span key={a} style={{ fontSize:9, fontWeight:700, padding:"1px 5px",
                    background:"#f5f0e8", border:"1px solid #ddd6c8", borderRadius:3, color:"#6b7280" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

/* ── PlaceholderView ── */
function PlaceholderView({ title, icon }) {
  return (
    <div className="bp-placeholder">
      <div className="bp-placeholder__icon">{icon ?? "🚧"}</div>
      <div className="bp-placeholder__title">{title}</div>
      <div className="bp-placeholder__sub">This section is coming soon.</div>
    </div>
  );
}

/* ── OrgSettingsView ── */
function OrgSettingsView({ can }) {
  const { activeOrg, switchOrg } = useApp();
  const dispatch                 = useDispatch();
  const selectedOrg      = useSelector((s) => s.orgs?.selectedOrg);
  const selectedLoading  = useSelector((s) => s.orgs?.selectedOrgLoading ?? false);

  const [settingsTab, setSettingsTab] = useState("general");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null);
  const [saveErr, setSaveErr]         = useState(null);
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerMsg, setDangerMsg]         = useState(null);

  // Fetch full org details when mounted
  useEffect(() => {
    if (activeOrg?.id) {
      dispatch(clearSelectedOrg());
      dispatch(fetchOrg(activeOrg.id));
    }
  }, [activeOrg?.id, dispatch]);

  // Use selectedOrg if it matches, else fall back to activeOrg
  const org = (selectedOrg?.id === activeOrg?.id ? selectedOrg : null) ?? activeOrg ?? {};

  // Sync form when org data arrives
  useEffect(() => { setDisplayName(org?.name ?? ""); }, [org?.name]);

  const isDirty = displayName.trim() !== (org?.name ?? "");

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true); setSaveMsg(null); setSaveErr(null);
    const res = await dispatch(apiUpdateOrg({ id: org.id, name: displayName.trim() }));
    setSaving(false);
    if (apiUpdateOrg.fulfilled.match(res)) {
      setSaveMsg("Changes saved successfully.");
      // Sync the updated name into AppContext so the sidebar / breadcrumb reflect it immediately
      if (res.payload) switchOrg(res.payload);
    } else {
      setSaveErr(res.payload === "SUPER_ADMIN_REQUIRED"
        ? "Only super admins can rename organisations."
        : "Failed to save — please try again.");
    }
  };

  const handleSuspend = async () => {
    setDangerLoading(true); setDangerMsg(null);
    const fn = org.status === "active" ? apiSuspendOrg : apiActivateOrg;
    const res = await dispatch(fn(org.id));
    setDangerLoading(false);
    setDangerMsg(fn === apiSuspendOrg
      ? (apiSuspendOrg.fulfilled.match(res) ? "Organization suspended." : "Failed to suspend.")
      : (apiActivateOrg.fulfilled.match(res) ? "Organization activated." : "Failed to activate."));
    if (fn === apiSuspendOrg ? apiSuspendOrg.fulfilled.match(res) : apiActivateOrg.fulfilled.match(res)) {
      dispatch(fetchOrg(org.id));
    }
  };

  const SETTINGS_TABS = ["general", "billing", "authentication", "data retention", "danger zone"];

  const statusStyle = (s) => s === "active"
    ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", dot: "#16a34a" }
    : { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b", dot: "#dc2626" };

  const StatusBadge = ({ value }) => {
    const st = statusStyle(value ?? "active");
    return (
      <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 10px",
        background: st.bg, border:`1px solid ${st.border}`, borderRadius:4,
        fontSize:11, fontWeight:700, color: st.color }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background: st.dot, display:"inline-block" }} />
        {(value ?? "active").toUpperCase()}
      </span>
    );
  };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1100 }}>
      {/* Header */}
      <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#9ca3af", margin:"0 0 6px" }}>
        {org.slug ? `${org.slug.toUpperCase()}.KINKO.IN` : "—"} · Organization Settings
      </p>
      <h1 style={{ fontSize:28, fontWeight:800, color:"#1a1a2e", margin:"0 0 5px", letterSpacing:"-0.02em" }}>Settings</h1>
      <p style={{ fontSize:13, color:"#6b7280", margin:"0 0 16px" }}>
        Organization profile, billing, and integrations. Slug cannot be changed after creation.
      </p>
      <hr style={{ border:"none", borderTop:"1px solid #e0d9cc", margin:"0 0 0" }} />

      {/* Tab nav */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #e0d9cc", marginBottom:28 }}>
        {SETTINGS_TABS.map((tab) => (
          <button key={tab} onClick={() => { setSettingsTab(tab); setSaveMsg(null); setSaveErr(null); setDangerMsg(null); }}
            style={{
              padding:"10px 18px", background:"none", border:"none",
              borderBottom: settingsTab === tab ? "2px solid #1a1a2e" : "2px solid transparent",
              fontFamily:"inherit", fontSize:13, fontWeight: settingsTab === tab ? 600 : 400,
              color: settingsTab === tab ? "#1a1a2e" : "#6b7280",
              cursor:"pointer", transition:"color 0.15s", marginBottom:-1,
              textTransform:"capitalize",
            }}>{tab}</button>
        ))}
      </div>

      {/* ── General tab ── */}
      {settingsTab === "general" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20, alignItems:"start" }}>

          {/* Left: org profile form */}
          <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"24px 28px" }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:"#1a1a2e", margin:"0 0 3px" }}>Organization profile</h3>
            <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 24px" }}>Visible to operators and on the consumer verify portal.</p>

            {selectedLoading ? (
              <div className="empty-state"><p className="empty-state__text">Loading…</p></div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                {/* Display name */}
                <div>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.08em", color:"#9ca3af", marginBottom:6 }}>Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setSaveMsg(null); setSaveErr(null); }}
                    style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px",
                      background:"#fff", border:"1px solid #ddd6c8", borderRadius:6,
                      fontSize:13, color:"#1a1a2e", fontFamily:"inherit", outline:"none",
                      transition:"border-color 0.15s" }}
                    onFocus={(e) => e.target.style.borderColor = "#c0392b"}
                    onBlur={(e) => e.target.style.borderColor = "#ddd6c8"}
                  />
                </div>
                {/* Slug (read-only) */}
                <div>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.08em", color:"#9ca3af", marginBottom:6 }}>Slug (Read-only)</label>
                  <input
                    value={org.slug ?? ""}
                    readOnly
                    style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px",
                      background:"#f5f0e8", border:"1px solid #ddd6c8", borderRadius:6,
                      fontSize:13, color:"#9ca3af", fontFamily:"monospace",
                      cursor:"not-allowed", outline:"none" }}
                  />
                </div>

                {/* Success / error */}
                {saveMsg && <p style={{ margin:0, fontSize:12, color:"#059669", fontWeight:500 }}>✓ {saveMsg}</p>}
                {saveErr && <p style={{ margin:0, fontSize:12, color:"#c0392b" }}>⚠ {saveErr}</p>}

                {/* Actions */}
                <div style={{ display:"flex", gap:10 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    style={{
                      padding:"9px 20px", background:"#1a1a2e", border:"none", borderRadius:7,
                      color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
                      fontFamily:"inherit", opacity: (saving || !isDirty) ? 0.45 : 1,
                      transition:"background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!saving && isDirty) e.target.style.background="#111827"; }}
                    onMouseLeave={(e) => e.target.style.background="#1a1a2e"}
                  >{saving ? "Saving…" : "Save changes"}</button>
                  <button
                    onClick={() => { setDisplayName(org.name ?? ""); setSaveMsg(null); setSaveErr(null); }}
                    style={{ padding:"9px 16px", background:"none", border:"none", borderRadius:7,
                      color:"#6b7280", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: metadata */}
          <div style={{ background:"#fff", border:"1px solid #e0d9cc", borderRadius:10, padding:"24px 28px" }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:"#1a1a2e", margin:"0 0 20px" }}>Metadata</h3>
            {[
              { label:"Org ID",   value: <span style={{ fontFamily:"monospace", fontSize:11, color:"#6b7280", wordBreak:"break-all" }}>{org.id ?? "—"}</span> },
              { label:"Created",  value: org.createdAt ? new Date(org.createdAt).toLocaleDateString("en-GB", { year:"numeric", month:"2-digit", day:"2-digit" }) : "—" },
              { label:"KYC",      value: <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 10px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:4, fontSize:11, fontWeight:700, color:"#15803d" }}><span style={{ width:6, height:6, borderRadius:"50%", background:"#16a34a", display:"inline-block" }} />VERIFIED</span> },
              { label:"Status",   value: <StatusBadge value={org.status} /> },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"grid", gridTemplateColumns:"100px 1fr", gap:8, marginBottom:14, alignItems:"center" }}>
                <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#9ca3af" }}>{label}</span>
                <span style={{ fontSize:13, color:"#1a1a2e" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Danger Zone tab ── */}
      {settingsTab === "danger zone" && (
        <div style={{ background:"#fff", border:"1px solid #fca5a5", borderRadius:10, padding:"24px 28px" }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"#991b1b", margin:"0 0 4px" }}>Danger Zone</h3>
          <p style={{ fontSize:12, color:"#9ca3af", margin:"0 0 20px" }}>Irreversible actions — proceed with caution.</p>
          {dangerMsg && <p style={{ fontSize:12, color:"#6b7280", margin:"0 0 16px" }}>{dangerMsg}</p>}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Suspend / Activate */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"14px 16px", border:"1px solid #e0d9cc", borderRadius:8 }}>
              <div>
                <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#1a1a2e" }}>
                  {(org.status ?? "active") === "active" ? "Suspend organization" : "Activate organization"}
                </p>
                <p style={{ margin:"2px 0 0", fontSize:11, color:"#9ca3af" }}>
                  {(org.status ?? "active") === "active"
                    ? "Disable all access for this org's operators."
                    : "Re-enable access for this org's operators."}
                </p>
              </div>
              <button onClick={handleSuspend} disabled={dangerLoading}
                style={{
                  padding:"7px 16px", borderRadius:7, fontSize:12, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit", border:"1px solid",
                  ...(org.status ?? "active") === "active"
                    ? { background:"#fff7ed", borderColor:"#fed7aa", color:"#c2410c" }
                    : { background:"#f0fdf4", borderColor:"#bbf7d0", color:"#15803d" },
                  opacity: dangerLoading ? 0.5 : 1,
                }}>
                {dangerLoading ? "…" : (org.status ?? "active") === "active" ? "Suspend" : "Activate"}
              </button>
            </div>
            {/* Delete */}
            {!org.isDefault && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 16px", border:"1px solid #fca5a5", borderRadius:8 }}>
                <div>
                  <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#1a1a2e" }}>Delete organization</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, color:"#9ca3af" }}>
                    Permanently soft-delete this organization. This cannot be undone.
                  </p>
                </div>
                <button onClick={() => dispatch(apiDeleteOrg(org.id))} disabled={dangerLoading}
                  style={{ padding:"7px 16px", background:"#fee2e2", border:"1px solid #fca5a5",
                    borderRadius:7, color:"#991b1b", fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit", opacity: dangerLoading ? 0.5 : 1 }}>
                  Delete
                </button>
              </div>
            )}
            {org.isDefault && (
              <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>ℹ The default organization cannot be deleted.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Placeholder tabs ── */}
      {["billing","authentication","data retention"].includes(settingsTab) && (
        <div style={{ textAlign:"center", padding:"70px 0", color:"#9ca3af" }}>
          <div style={{ fontSize:36, marginBottom:14 }}>🚧</div>
          <div style={{ fontSize:15, fontWeight:700, color:"#6b7280", textTransform:"capitalize" }}>{settingsTab}</div>
          <div style={{ fontSize:12, marginTop:5 }}>Coming soon</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Dashboard shell                                            */
/* ─────────────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { currentUser, logoutSuperAdmin, activeOrg, switchOrg } = useApp();
  const {
    permissions: rawPerms,
    loading: meLoading,
    errorCode: meError,
  } = useSelector((s) => s.me ?? {});
  const myPermissions = Array.isArray(rawPerms) ? rawPerms : [];

  const [activeTab, setActiveTab]         = useState(null);
  const [bulkJobsCount, setBulkJobsCount] = useState(null);
  const [inOrgView, setInOrgView]         = useState(false);
  const [activeView, setActiveView]       = useState("orgs");

  const orgsCount  = useSelector((s) => s.orgs?.orgs?.length ?? 0);
  const usersTotal = useSelector((s) => s.users?.totalItems ?? 0);
  const rolesCount = useSelector((s) => s.roles?.roles?.length ?? 0);
  const orgs       = useSelector((s) => s.orgs?.orgs ?? []);

  const handleEnterOrg = (org) => {
    switchOrg(org);
    setInOrgView(true);
    setActiveView("org-dashboard");
  };

  const handleExitOrg = () => {
    setInOrgView(false);
    setActiveView("orgs");
  };

  const handleNavClick = (view) => {
    setActiveView(view);
    // Landing-level views always exit org context
    if (["orgs", "super-admins", "global-audit", "system-settings"].includes(view)) {
      setInOrgView(false);
    }
    dispatch(fetchMyPermissions());
  };

  // Auto-select default org for X-ORG-ID header (previously done by OrgDropdown)
  useEffect(() => {
    if (!activeOrg && orgs.length > 0) {
      const def = orgs.find((o) => o.isDefault) ?? orgs.find((o) => o.name === "Kinko") ?? orgs[0];
      if (def) switchOrg(def);
    }
  }, [orgs.length, !!activeOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch /me/permissions on mount
  useEffect(() => {
    dispatch(fetchMyPermissions());
  }, [dispatch]);

  // Re-fetch /me/permissions and reset tab whenever the org changes.
  // Also clear and reload users/roles so stale data from the previous org is replaced.
  useEffect(() => {
    if (!activeOrg?.id) return;
    dispatch(fetchMyPermissions());
    dispatch(resetUsers());
    dispatch(resetRoles());
    dispatch(fetchUsers());
    dispatch(fetchRoles());
    setBulkJobsCount(null);
    bulkService.listJobs()
      .then((d) => setBulkJobsCount(d.items?.length ?? 0))
      .catch(() => {});
    setActiveTab(null);
    if (inOrgView) setActiveView("org-dashboard");
  }, [activeOrg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fetch counts so tiles can show metrics immediately
  useEffect(() => {
    dispatch(fetchOrgs());
    dispatch(fetchUsers());
    dispatch(fetchRoles());
    bulkService.listJobs()
      .then((d) => setBulkJobsCount(d.items?.length ?? 0))
      .catch(() => {}); // silently ignore if endpoint not yet deployed
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build module → Set<action> from the normalised permissions
  const moduleActionMap = myPermissions.reduce((acc, { module, action } = {}) => {
    if (!module) return acc;
    if (!acc[module]) acc[module] = new Set();
    acc[module].add(action);
    return acc;
  }, {});

  const modules = Object.keys(moduleActionMap)
    .filter((m) => {
      if (EXCLUDED_MODULES.has(m)) return false;
      // Keep only the exact "AUDIT" key; drop "audit", "AUDIT_LOG", etc.
      if (m.toUpperCase().includes("AUDIT") && m !== "AUDIT") return false;
      return true;
    })
    .sort((a, b) => {
      const au = a.toUpperCase(), bu = b.toUpperCase();
      if (au === "AUDIT" && bu !== "AUDIT") return 1;
      if (au !== "AUDIT" && bu === "AUDIT") return -1;
      return a.localeCompare(b);
    });

  // can("ROLE_MANAGE") → true if user holds that permission code
  const can = (code) => myPermissions.some((p) => p.code === code);

  const handleLogout = () => {
    logoutSuperAdmin();
    navigate("/admin/login");
  };

  const renderContent = () => {
    if (meLoading) return <div style={{ padding: 40 }} className="status">Loading permissions…</div>;
    if (meError)   return <div style={{ padding: 40 }} className="status status--error">⚠ Failed to load permissions ({meError})</div>;

    if (!inOrgView) {
      switch (activeView) {
        case "orgs":           return <OrgLandingView onEnterOrg={handleEnterOrg} can={can} />;
        case "super-admins":   return <PlaceholderView title="Super Admins" icon="👤" />;
        case "global-audit":   return (
          <div style={{ padding: 4 }}>
            <ModuleTab key="global-audit" module="AUDIT" actions={moduleActionMap.AUDIT ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} isGlobal={true} />
          </div>
        );
        case "system-settings": return <SystemSettingsView />;
        default:               return <OrgLandingView onEnterOrg={handleEnterOrg} can={can} />;
      }
    }

    const tabKey = `${activeOrg?.id ?? "default"}-${activeView}`;
    switch (activeView) {
      case "org-dashboard": return <OrgDashboardView onNavigate={handleNavClick} />;
      case "CMS_USER":  return <ModuleTab key={tabKey} module="CMS_USER" actions={moduleActionMap.CMS_USER ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} />;
      case "ROLE":      return <ModuleTab key={tabKey} module="ROLE"     actions={moduleActionMap.ROLE    ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} />;
      case "BULK":      return <ModuleTab key={tabKey} module="BULK"     actions={moduleActionMap.BULK    ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} />;
      case "AUDIT":     return <ModuleTab key={tabKey} module="AUDIT"    actions={moduleActionMap.AUDIT   ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} />;
      case "USER":      return <ModuleTab key={tabKey} module="USER"     actions={moduleActionMap.USER    ?? new Set()} can={can} onJobsLoad={setBulkJobsCount} />;
      case "settings":  return <OrgSettingsView can={can} />;
      default:          return <OrgDashboardView onNavigate={handleNavClick} />;
    }
  };

  const orgAvatarLetters = (name) =>
    (name ?? "").split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "O";

  return (
    <div className="bp-shell">

      {/* ── Top navbar (dark) ── */}
      <header className="bp-navbar">
        <div className="bp-navbar__left">
          <div className="bp-navbar__brand">
            <div style={{ background: "#fff", borderRadius: 6, padding: "4px 12px", display: "inline-flex", alignItems: "center" }}>
              <img src={kinkoLogo} alt="Kinko" style={{ height: 24, width: "auto", display: "block" }} />
            </div>
          </div>
          <div className="bp-navbar__breadcrumb">
            <span style={{ fontSize:11, color:"#475569" }}>INTERNAL · {new Date().toLocaleDateString("en-US",{month:"short",year:"numeric"}).toUpperCase()}</span>
            <span className="bp-bc__sep">|</span>
            <span style={{ fontSize:11, color:"#059669", display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", display:"inline-block" }} />
              STAGING · ap-south-1 · all systems normal
            </span>
          </div>
        </div>
        <div className="bp-navbar__right">
          <div className="bp-user-badge">
            <div className="bp-user-badge__avatar">
              {(currentUser?.name || currentUser?.email || "A")[0].toUpperCase()}
            </div>
            <span className="bp-user-badge__name">
              {currentUser?.name || currentUser?.email?.split("@")[0] || "Admin"}
            </span>
          </div>
          <button className="bp-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* ── Sub-navbar (scope / breadcrumb bar) ── */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 20px 0 0", height:52, borderBottom:"1px solid #ddd6c8",
        background:"#f5f0e8", flexShrink:0, zIndex:9,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
          {/* Breadcrumb — aligns with sidebar width */}
          <div style={{ padding:"0 20px", minWidth:230, borderRight:"1px solid #ddd6c8", height:52, display:"flex", alignItems:"center", fontSize:11, fontWeight:600, color:"#9ca3af", letterSpacing:"0.05em", textTransform:"uppercase" }}>
            {inOrgView
              ? <>
                  <span style={{ cursor:"pointer" }} onClick={handleExitOrg}>Organizations</span>
                  {" / "}<span>{activeOrg?.name?.toUpperCase()}</span>
                  {" / "}<span style={{ color:"#1a1a2e" }}>{(VIEW_LABELS[activeView] ?? activeView).toUpperCase()}</span>
                </>
              : <span style={{ color:"#1a1a2e", fontWeight:700 }}>Organizations</span>
            }
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Search box */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", fontSize:14 }}>🔍</span>
            <input
              placeholder={inOrgView ? `Search users, roles, audit in ${activeOrg?.name ?? "org"}…` : "Search organizations, users, audit log…"}
              style={{
                padding:"6px 12px 6px 32px", background:"#fff", border:"1px solid #ddd6c8",
                borderRadius:8, fontSize:12, color:"#1a1a2e", width:280, outline:"none",
                fontFamily:"inherit",
              }}
            />
            <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:"#9ca3af", background:"#f5f0e8", padding:"1px 4px", borderRadius:4, border:"1px solid #ddd6c8" }}>⌘K</span>
          </div>
          {inOrgView && activeView === "org-dashboard" && (
            <button className="bp-exit-btn" onClick={handleExitOrg}>← Exit org</button>
          )}
          {inOrgView && activeView !== "org-dashboard" && (
            <button className="bp-exit-btn" onClick={() => handleNavClick("org-dashboard")}>← Dashboard</button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bp-body">

        {/* ── Sidebar ── */}
        <aside className="bp-sidebar">

          {/* Scope badge — clickable to go back to org list when inside an org */}
          <div
            onClick={inOrgView ? handleExitOrg : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px",
              borderBottom: "1px solid #ddd6c8",
              cursor: inOrgView ? "pointer" : "default",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (inOrgView) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {inOrgView ? (
              <>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: orgAvatarColor(activeOrg?.name ?? ""),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                }}>
                  {orgInitials(activeOrg?.name ?? "")}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 2 }}>
                    Organization
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeOrg?.name ?? "—"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "#e0d9cc",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>🌐</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 2 }}>Scope</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>All organizations</div>
                </div>
              </>
            )}
          </div>

          {/* Nav items */}
          <nav className="bp-nav">
            {!inOrgView ? (
              <>
                <div className="bp-nav__section">Tenants</div>
                <NavItem icon="🏢" label="Organizations" view="orgs"            activeView={activeView} onClick={handleNavClick} count={orgsCount > 0 ? orgsCount : null} />
                <div className="bp-nav__section">Platform</div>
                <NavItem icon="👤" label="Super Admins"  view="super-admins"    activeView={activeView} onClick={handleNavClick} />
                <NavItem icon="🔍" label="Global Audit"  view="global-audit"    activeView={activeView} onClick={handleNavClick} />
                <NavItem icon="⚙️" label="System Settings" view="system-settings" activeView={activeView} onClick={handleNavClick} />
              </>
            ) : (
              <>
                <div className="bp-nav__section">Overview</div>
                <NavItem icon="📊" label="Dashboard"    view="org-dashboard" activeView={activeView} onClick={handleNavClick} />
                <div className="bp-nav__section">Operators</div>
                {moduleActionMap.CMS_USER && <NavItem icon="👥" label="CMS Users"    view="CMS_USER" activeView={activeView} onClick={handleNavClick} count={usersTotal > 0 ? usersTotal : null} />}
                {moduleActionMap.ROLE     && <NavItem icon="🎭" label="Roles & Perms" view="ROLE"     activeView={activeView} onClick={handleNavClick} />}
                <div className="bp-nav__section">Membership</div>
                {moduleActionMap.USER && <NavItem icon="🙍" label="Members"     view="USER" activeView={activeView} onClick={handleNavClick} />}
                {moduleActionMap.BULK && <NavItem icon="📦" label="Bulk Upload"  view="BULK" activeView={activeView} onClick={handleNavClick} count={bulkJobsCount > 0 ? bulkJobsCount : null} />}
                <div className="bp-nav__section">Compliance</div>
                {moduleActionMap.AUDIT && <NavItem icon="📋" label="Audit Log" view="AUDIT"    activeView={activeView} onClick={handleNavClick} />}
                <NavItem icon="⚙️" label="Settings"  view="settings" activeView={activeView} onClick={handleNavClick} />
              </>
            )}
          </nav>

          <div className="bp-sidebar__footer">
            <div>Backoffice v2.0</div>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="bp-content">
          {renderContent()}
        </main>

      </div>
    </div>
  );
}
