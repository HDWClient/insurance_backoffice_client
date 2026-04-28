import { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_COLORS,
} from "../../constants/roles";
import "./styles.css";

/* ── Permission columns ordered by group ───────────────── */
const PERM_COLUMNS = [
  { key: PERMISSIONS.MANAGE_ORGS,     label: "Manage Orgs",      group: "Admin" },
  { key: PERMISSIONS.MANAGE_USERS,    label: "Manage Users",     group: "Admin" },
  { key: PERMISSIONS.VIEW_USERS,      label: "View Users",       group: "Admin" },
  { key: PERMISSIONS.VIEW_POLICIES,   label: "View Policies",    group: "Policies" },
  { key: PERMISSIONS.MANAGE_POLICIES, label: "Manage Policies",  group: "Policies" },
  { key: PERMISSIONS.VIEW_CLAIMS,     label: "View Claims",      group: "Claims" },
  { key: PERMISSIONS.PROCESS_CLAIMS,  label: "Process Claims",   group: "Claims" },
  { key: PERMISSIONS.VIEW_REPORTS,    label: "View Reports",     group: "Reports" },
  { key: PERMISSIONS.MANAGE_SETTINGS, label: "Settings",         group: "Settings" },
];

const GROUP_SPANS = PERM_COLUMNS.reduce((acc, col) => {
  acc[col.group] = (acc[col.group] || 0) + 1;
  return acc;
}, {});

const GROUPS_ORDER = [...new Set(PERM_COLUMNS.map((c) => c.group))];

const getEffective = (user) =>
  user.permissions ?? ROLE_PERMISSIONS[user.role] ?? [];

export default function RoleAccess() {
  const { users, updateUserPermissions } = useApp();

  // Draft state: userId -> Set of permissions
  const [drafts, setDrafts] = useState(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = new Set(getEffective(u)); });
    return map;
  });

  // Track which rows have unsaved changes
  const [saved, setSaved] = useState({});
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Sync new users that arrived after mount
  const allDrafts = useMemo(() => {
    const merged = { ...drafts };
    users.forEach((u) => {
      if (!merged[u.id]) merged[u.id] = new Set(getEffective(u));
    });
    return merged;
  }, [users, drafts]);

  const isDirty = (user) => {
    const current = new Set(getEffective(user));
    const draft = allDrafts[user.id] ?? current;
    if (current.size !== draft.size) return true;
    for (const p of draft) if (!current.has(p)) return true;
    return false;
  };

  const toggle = (userId, perm) => {
    setDrafts((prev) => {
      const set = new Set(prev[userId] ?? []);
      set.has(perm) ? set.delete(perm) : set.add(perm);
      return { ...prev, [userId]: set };
    });
    setSaved((prev) => ({ ...prev, [userId]: false }));
  };

  const saveUser = (user) => {
    updateUserPermissions(user.id, Array.from(allDrafts[user.id] ?? []));
    setSaved((prev) => ({ ...prev, [user.id]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [user.id]: false })), 2000);
  };

  const resetUser = (user) => {
    const defaults = new Set(ROLE_PERMISSIONS[user.role] ?? []);
    setDrafts((prev) => ({ ...prev, [user.id]: defaults }));
    setSaved((prev) => ({ ...prev, [user.id]: false }));
  };

  const saveAll = () => {
    users.forEach((u) => {
      if (isDirty(u)) {
        updateUserPermissions(u.id, Array.from(allDrafts[u.id] ?? []));
        setSaved((prev) => ({ ...prev, [u.id]: true }));
      }
    });
    setTimeout(() => setSaved({}), 2000);
  };

  const toggleAllForUser = (user, check) => {
    const next = check ? new Set(Object.values(PERMISSIONS)) : new Set();
    setDrafts((prev) => ({ ...prev, [user.id]: next }));
    setSaved((prev) => ({ ...prev, [user.id]: false }));
  };

  const toggleAllForPerm = (perm, check) => {
    setDrafts((prev) => {
      const next = { ...prev };
      users.forEach((u) => {
        const set = new Set(next[u.id] ?? []);
        check ? set.add(perm) : set.delete(perm);
        next[u.id] = set;
      });
      return next;
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const dirtyCount = users.filter(isDirty).length;

  return (
    <div className="ra-page">
      {/* ── Header ── */}
      <div className="ra-header">
        <div>
          <h1 className="ra-header__title">Role Based Access Control</h1>
          <p className="ra-header__sub">
            {users.length} users · {dirtyCount > 0 && (
              <span className="ra-header__dirty">{dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="ra-header__actions">
          <input
            className="ra-search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="ra-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            {Object.entries(ROLE_LABELS)
              .filter(([k]) => k !== "super_admin")
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </select>
          {dirtyCount > 0 && (
            <button className="ra-save-all-btn" onClick={saveAll}>
              Save All ({dirtyCount})
            </button>
          )}
        </div>
      </div>

      {users.length === 0 ? (
        <div className="ra-empty">
          <div className="ra-empty__icon">👥</div>
          <p className="ra-empty__text">No users yet</p>
          <p className="ra-empty__sub">Create users from the Users tab first</p>
        </div>
      ) : (
        <div className="ra-table-wrap">
          <table className="ra-table">
            <thead>
              {/* Group header row */}
              <tr className="ra-table__group-row">
                <th className="ra-table__user-th" rowSpan={2}>User</th>
                {GROUPS_ORDER.map((group) => (
                  <th
                    key={group}
                    colSpan={GROUP_SPANS[group]}
                    className="ra-table__group-th"
                  >
                    {group}
                  </th>
                ))}
                <th className="ra-table__actions-th" rowSpan={2}>Actions</th>
              </tr>
              {/* Permission column headers */}
              <tr className="ra-table__perm-row">
                {PERM_COLUMNS.map((col) => (
                  <th key={col.key} className="ra-table__perm-th">
                    <div className="ra-table__perm-th-inner">
                      <span className="ra-table__perm-label">{col.label}</span>
                      <input
                        type="checkbox"
                        className="ra-col-check"
                        title={`Toggle ${col.label} for all users`}
                        checked={filteredUsers.length > 0 && filteredUsers.every((u) => allDrafts[u.id]?.has(col.key))}
                        onChange={(e) => toggleAllForPerm(col.key, e.target.checked)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={PERM_COLUMNS.length + 2} className="ra-table__no-results">
                    No users match your search
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const rc = ROLE_COLORS[user.role] || ROLE_COLORS.viewer;
                  const draft = allDrafts[user.id] ?? new Set();
                  const dirty = isDirty(user);
                  const savedOk = saved[user.id];
                  const allChecked = PERM_COLUMNS.every((c) => draft.has(c.key));
                  const someChecked = PERM_COLUMNS.some((c) => draft.has(c.key));

                  return (
                    <tr
                      key={user.id}
                      className={`ra-table__row ${dirty ? "ra-table__row--dirty" : ""} ${savedOk ? "ra-table__row--saved" : ""}`}
                    >
                      {/* User cell */}
                      <td className="ra-table__user-cell">
                        <div className="ra-user-info">
                          <div className="ra-user-info__select">
                            <input
                              type="checkbox"
                              className="ra-row-check"
                              title="Toggle all permissions"
                              checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                              onChange={(e) => toggleAllForUser(user, e.target.checked)}
                            />
                          </div>
                          <div>
                            <div className="ra-user-info__name">{user.name}</div>
                            <div className="ra-user-info__meta">
                              <span className="ra-user-info__username">@{user.username}</span>
                              <span
                                className="ra-user-info__role"
                                style={{ background: rc.bg, color: rc.color }}
                              >
                                {ROLE_LABELS[user.role]}
                              </span>
                            </div>
                            {user.orgName && user.orgName !== "—" && (
                              <div className="ra-user-info__org">{user.orgName}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Permission checkboxes */}
                      {PERM_COLUMNS.map((col) => {
                        const isDefault = (ROLE_PERMISSIONS[user.role] ?? []).includes(col.key);
                        const checked = draft.has(col.key);
                        return (
                          <td
                            key={col.key}
                            className={`ra-table__perm-cell ${checked ? "ra-table__perm-cell--on" : ""}`}
                          >
                            <label className="ra-check-wrap" title={col.label}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(user.id, col.key)}
                                className="ra-perm-check"
                              />
                              {isDefault && <span className="ra-default-dot" title="Role default" />}
                            </label>
                          </td>
                        );
                      })}

                      {/* Row actions */}
                      <td className="ra-table__row-actions">
                        {savedOk ? (
                          <span className="ra-saved-tick">✓ Saved</span>
                        ) : (
                          <div className="ra-row-btns">
                            <button
                              className="ra-row-btn ra-row-btn--save"
                              onClick={() => saveUser(user)}
                              disabled={!dirty}
                              title="Save changes"
                            >
                              Save
                            </button>
                            <button
                              className="ra-row-btn ra-row-btn--reset"
                              onClick={() => resetUser(user)}
                              title="Reset to role defaults"
                            >
                              ↺
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="ra-legend">
        <span className="ra-legend__item">
          <span className="ra-default-dot ra-default-dot--lg" /> Role default permission
        </span>
        <span className="ra-legend__item">
          <span className="ra-legend__dirty-line" /> Unsaved changes
        </span>
      </div>
    </div>
  );
}
