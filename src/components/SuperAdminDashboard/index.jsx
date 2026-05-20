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
const AUDIT_MODULES = ["", "ORG", "CMS_USER", "ROLE", "BULK", "USER"];
const AUDIT_ACTIONS = ["", "CREATE", "UPDATE", "DELETE", "READ", "UPLOAD", "ASSIGN", "REVOKE", "LOGIN", "LOGOUT"];
const AUDIT_MODULE_LABELS = { ORG: "Organisation", CMS_USER: "CMS User", ROLE: "Role", BULK: "Bulk Ops", USER: "Consumer User" };
const AUDIT_MODULE_COLORS = {
  ORG:      { bg: "rgba(99,102,241,0.08)",  color: "#4f46e5",  border: "rgba(99,102,241,0.2)"  },
  CMS_USER: { bg: "rgba(16,185,129,0.08)",  color: "#059669",  border: "rgba(16,185,129,0.2)"  },
  ROLE:     { bg: "rgba(124,58,237,0.08)",  color: "#7c3aed",  border: "rgba(124,58,237,0.2)"  },
  BULK:     { bg: "rgba(245,158,11,0.08)",  color: "#b45309",  border: "rgba(245,158,11,0.2)"  },
  USER:     { bg: "rgba(20,184,166,0.08)",  color: "#0d9488",  border: "rgba(20,184,166,0.2)"  },
};


function AuditModuleTab({ actions }) {
  const canRead = actions.has("READ") || actions.has("MANAGE");

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
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");

  const loadLogs = useCallback(async (pg, mod, act, from, to) => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      // API expects ISO datetime strings; date inputs give YYYY-MM-DD
      const fromIso = from ? `${from}T00:00:00.000Z` : undefined;
      const toIso   = to   ? `${to}T23:59:59.999Z`   : undefined;
      const data = await auditService.listAuditLogs({
        page: pg,
        size: 20,
        module: mod || undefined,
        action: act || undefined,
        from:   fromIso,
        to:     toIso,
      });
      setReady(true);
      setLogs(data?.items ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotalItems(data?.totalItems ?? 0);
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
  useEffect(() => { loadLogs(0, "", "", "", ""); }, [loadLogs]);

  const handleApplyFilters = () => {
    setPage(0);
    loadLogs(0, moduleFilter, actionFilter, fromDate, toDate);
  };

  const handleClearFilters = () => {
    setModuleFilter(""); setActionFilter(""); setFromDate(""); setToDate("");
    setPage(0);
    loadLogs(0, "", "", "", "");
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    loadLogs(pg, moduleFilter, actionFilter, fromDate, toDate);
  };

  const handleRefresh = () => loadLogs(page, moduleFilter, actionFilter, fromDate, toDate);

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
            <button className="btn btn--ghost btn--sm" onClick={() => loadLogs(0, "", "", "", "")}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = moduleFilter || actionFilter || fromDate || toDate;

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
          <div className="form__field" style={{ minWidth: 140, flex: 1 }}>
            <label className="form__label">Module</label>
            <select className="form__input form__select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              {AUDIT_MODULES.map((m) => (
                <option key={m} value={m}>{m ? (AUDIT_MODULE_LABELS[m] ?? m) : "All Modules"}</option>
              ))}
            </select>
          </div>
          <div className="form__field" style={{ minWidth: 140, flex: 1 }}>
            <label className="form__label">Action</label>
            <select className="form__input form__select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{a || "All Actions"}</option>
              ))}
            </select>
          </div>
          <div className="form__field" style={{ minWidth: 140, flex: 1 }}>
            <label className="form__label">From</label>
            <input type="date" className="form__input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="form__field" style={{ minWidth: 140, flex: 1 }}>
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
        {hasActiveFilters && (
          <div style={{
            display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center",
            padding: "5px 16px",
            borderBottom: "1px solid rgba(99,102,241,0.07)",
            background: "rgba(99,102,241,0.02)",
          }}>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Filters:</span>
            {moduleFilter && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: "rgba(99,102,241,0.1)", color: "#4f46e5", border: "1px solid rgba(99,102,241,0.2)" }}>
                {AUDIT_MODULE_LABELS[moduleFilter] ?? moduleFilter}
              </span>
            )}
            {actionFilter && (
              <span className={`action-badge action-badge--${actionFilter.toLowerCase()}`} style={{ fontSize: 10 }}>
                {actionFilter}
              </span>
            )}
            {fromDate && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                background: "rgba(100,116,139,0.1)", color: "#475569", border: "1px solid #dde6f2" }}>
                From {fromDate}
              </span>
            )}
            {toDate && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                background: "rgba(100,116,139,0.1)", color: "#475569", border: "1px solid #dde6f2" }}>
                To {toDate}
              </span>
            )}
          </div>
        )}

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
                  <th style={{ width: 118 }}>Timestamp</th>
                  <th style={{ width: 180 }}>Actor</th>
                  <th style={{ width: 108 }}>Module</th>
                  <th style={{ width: 120 }}>Action</th>
                  <th style={{ width: 210 }}>Target</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actorInitial = ((log.actor?.fullName ?? log.actor?.email) || "?")[0].toUpperCase();
                  const modStyle = log.module ? AUDIT_MODULE_COLORS[log.module] : null;
                  const ts = log.createdAt ? new Date(log.createdAt) : null;
                  const targetText = log.target?.label ?? log.target?.id ?? "—";
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

                      {/* Module */}
                      <td style={{ verticalAlign: "top" }}>
                        <div style={clip}>
                          {log.module ? (
                            <span style={{
                              display: "inline-block", fontSize: 10, fontWeight: 700,
                              padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap",
                              background: modStyle?.bg ?? "rgba(100,116,139,0.08)",
                              color: modStyle?.color ?? "#64748b",
                              border: `1px solid ${modStyle?.border ?? "#dde6f2"}`,
                            }}>
                              {AUDIT_MODULE_LABELS[log.module] ?? log.module}
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
function ModuleTab({ module, actions, can, onJobsLoad }) {
  if (module === "ORG")      return <OrgModuleTab      actions={actions} can={can} />;
  if (module === "ROLE")     return <RoleModuleTab     actions={actions} can={can} />;
  if (module === "BULK")     return <BulkModuleTab     actions={actions} onJobsLoad={onJobsLoad} />;
  if (module === "CMS_USER") return <UserModuleTab     actions={actions} can={can} />;
  if (module === "USER")     return <ConsumerUserModuleTab actions={actions} />;
  if (module === "AUDIT")    return <AuditModuleTab    actions={actions} />;
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

  const [activeTab, setActiveTab]         = useState(null);
  const [bulkJobsCount, setBulkJobsCount] = useState(null);

  const orgsCount  = useSelector((s) => s.orgs?.orgs?.length ?? 0);
  const usersTotal = useSelector((s) => s.users?.totalItems ?? 0);
  const rolesCount = useSelector((s) => s.roles?.roles?.length ?? 0);

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

  return (
    <div className="sa-dashboard-page">

      {/* Navbar */}
      <header className="sa-navbar">
        <div className="sa-navbar__brand">
          <img src={kinkoLogo} alt="Kinko" className="sa-navbar__logo" />
          <span className="sa-navbar__divider" />
          <span className="sa-navbar__app">Admin Portal</span>
        </div>
        <div className="sa-navbar__right">
          <OrgDropdown />
          <button className="sa-navbar__logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* Main content — tile overview or module detail */}
      <div style={{ padding: "20px 28px", maxWidth: 1440, margin: "0 auto" }}>
        {meLoading ? (
          <p className="status">Loading permissions…</p>
        ) : meError ? (
          <p className="status status--error">⚠ Failed to load permissions ({meError})</p>
        ) : modules.length === 0 ? (
          <p className="status">No permissions assigned to your account.</p>
        ) : !activeTab ? (

          /* ── Tile overview ── */
          <div className="sa-overview">

            {/* Page header */}
            <div className="sa-overview__header">
              <div>
                <h1 className="sa-overview__title">Admin Dashboard</h1>
                <p className="sa-overview__sub">
                  {activeOrg?.name || "All Organizations"} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="sa-admin-badge">
                <div className="sa-admin-badge__avatar">
                  {(currentUser?.name || currentUser?.email || "A")[0].toUpperCase()}
                </div>
                <div className="sa-admin-badge__info">
                  <span className="sa-admin-badge__name">{currentUser?.name || currentUser?.email?.split("@")[0] || "Admin"}</span>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="sa-summary-strip">
              {[
                { label: "Organizations", value: orgsCount,            accent: "#3b82f6" },
                { label: "Users",         value: usersTotal,           accent: "#8b5cf6" },
                { label: "Roles",         value: rolesCount,           accent: "#10b981" },
                { label: "Jobs",          value: bulkJobsCount ?? "—", accent: "#f59e0b" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="sa-sum-card" style={{ "--sum-accent": accent }}>
                  <div className="sa-sum-value">{value ?? "—"}</div>
                  <div className="sa-sum-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Modules section label */}
            <div className="sa-section-divider">
              <span className="sa-section-divider__label">Modules</span>
            </div>

            {/* Tiles grid */}
            <div className="sa-tiles-grid">
              {modules.map((m, idx) => {
                const icon  = MODULE_ICONS[m] ?? "🧩";
                const label = MODULE_LABELS[m] ?? m;
                const desc  = MODULE_DESCRIPTIONS[m];
                let metricValue, metricLabel;
                if (m === "ORG")           { metricValue = orgsCount;      metricLabel = "organizations"; }
                else if (m === "CMS_USER") { metricValue = usersTotal;     metricLabel = "users"; }
                else if (m === "ROLE")     { metricValue = rolesCount;     metricLabel = "roles"; }
                else if (m === "BULK")     { metricValue = bulkJobsCount;  metricLabel = "jobs"; }
                const hasMetric = metricValue !== null && metricValue !== undefined;
                return (
                  <div key={m} className="sa-tile-wrapper" style={{ "--tile-index": idx }}>
                    <div
                      className="sa-tile"
                      onClick={() => { setActiveTab(m); dispatch(fetchMyPermissions()); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { setActiveTab(m); dispatch(fetchMyPermissions()); }
                      }}
                    >
                      <div className="sa-tile__top">
                        <div className="sa-tile__icon">{icon}</div>
                        <span className="sa-tile__arrow">→</span>
                      </div>
                      <div className="sa-tile__title">{label}</div>
                      {desc && <div className="sa-tile__desc">{desc}</div>}
                      {hasMetric && (
                        <div className="sa-tile__metric">
                          <span className="sa-tile__metric-value">{metricValue}</span>
                          <span className="sa-tile__metric-label">{metricLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        ) : (

          /* ── Module detail view ── */
          <div>
            <div className="sa-detail-header">
              <button className="sa-back-btn" onClick={() => setActiveTab(null)}>
                ← Dashboard
              </button>
              <div className="sa-detail-nav">
                {modules.map((m) => (
                  <button
                    key={m}
                    className={`sa-nav-pill${activeTab === m ? " sa-nav-pill--active" : ""}`}
                    onClick={() => { setActiveTab(m); dispatch(fetchMyPermissions()); }}
                  >
                    {MODULE_ICONS[m] ? `${MODULE_ICONS[m]} ` : ""}{MODULE_LABELS[m] ?? m}
                  </button>
                ))}
              </div>
            </div>
            <ModuleTab
              key={`${activeOrg?.id ?? "default"}-${activeTab}`}
              module={activeTab}
              actions={moduleActionMap[activeTab] ?? new Set()}
              can={can}
              onJobsLoad={setBulkJobsCount}
            />
          </div>

        )}
      </div>
    </div>
  );
}
