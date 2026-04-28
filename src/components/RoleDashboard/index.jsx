import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { PERMISSIONS, ROLE_LABELS, ROLE_COLORS, hasPermission } from "../../constants/roles";
import PermissionGate, { usePermission } from "../PermissionGate";
import "./styles.css";

/* ── Nav config ────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "overview",  label: "Overview",   icon: "📊", permission: null },
  { id: "policies",  label: "Policies",   icon: "📋", permission: PERMISSIONS.VIEW_POLICIES },
  { id: "claims",    label: "Claims",     icon: "🗂️", permission: PERMISSIONS.VIEW_CLAIMS },
  { id: "users",     label: "Users",      icon: "👥", permission: PERMISSIONS.VIEW_USERS },
  { id: "reports",   label: "Reports",    icon: "📈", permission: PERMISSIONS.VIEW_REPORTS },
  { id: "settings",  label: "Settings",   icon: "⚙️", permission: PERMISSIONS.MANAGE_SETTINGS },
];

/* ── Placeholder content panels ───────────────────────── */
function Overview({ user }) {
  const rc = ROLE_COLORS[user.role] ?? ROLE_COLORS.viewer;
  return (
    <div className="rd-content">
      <h1 className="rd-content__title">Welcome, {user.name}</h1>
      <p className="rd-content__sub">
        <span className="rd-role-badge" style={{ background: rc.bg, color: rc.color }}>
          {ROLE_LABELS[user.role]}
        </span>
        {user.orgName && user.orgName !== "—" ? ` · ${user.orgName}` : ""}
      </p>
      <div className="rd-overview-cards">
        {[
          { label: "Active Policies", value: "142", icon: "📋" },
          { label: "Pending Claims", value: "23", icon: "🗂️" },
          { label: "Resolved This Month", value: "89", icon: "✅" },
          { label: "Reports Available", value: "12", icon: "📈" },
        ].map((c) => (
          <div key={c.label} className="rd-ov-card">
            <div className="rd-ov-card__icon">{c.icon}</div>
            <div className="rd-ov-card__value">{c.value}</div>
            <div className="rd-ov-card__label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Policies() {
  const canManage = usePermission(PERMISSIONS.MANAGE_POLICIES);
  const rows = [
    { id: "POL-001", holder: "Ravi Kumar", type: "Health", premium: "₹12,000", status: "Active", expiry: "2025-03-10" },
    { id: "POL-002", holder: "Anita Shah", type: "Motor", premium: "₹8,500", status: "Active", expiry: "2025-06-22" },
    { id: "POL-003", holder: "Mohan Rao", type: "Life", premium: "₹24,000", status: "Pending", expiry: "2025-01-15" },
    { id: "POL-004", holder: "Priya Nair", type: "Travel", premium: "₹3,200", status: "Expired", expiry: "2024-12-01" },
  ];
  const statusColors = { Active: "#1c3a2e:#34d399", Pending: "#422006:#fdba74", Expired: "#450a0a:#f87171" };
  return (
    <div className="rd-content">
      <div className="rd-content__header">
        <h1 className="rd-content__title">Policies</h1>
        <PermissionGate permission={PERMISSIONS.MANAGE_POLICIES}>
          <button className="rd-action-btn">+ New Policy</button>
        </PermissionGate>
      </div>
      <div className="rd-table">
        <div className="rd-table__head rd-table__head--policy">
          <span>Policy ID</span><span>Holder</span><span>Type</span>
          <span>Premium</span><span>Status</span><span>Expiry</span>
        </div>
        {rows.map((r) => {
          const [bg, color] = (statusColors[r.status] || "#1e293b:#94a3b8").split(":");
          return (
            <div key={r.id} className="rd-table__row rd-table__row--policy">
              <span className="rd-table__mono">{r.id}</span>
              <span className="rd-table__bold">{r.holder}</span>
              <span className="rd-table__muted">{r.type}</span>
              <span className="rd-table__bold">{r.premium}</span>
              <span><span className="rd-badge" style={{ background: bg, color }}>{r.status}</span></span>
              <span className="rd-table__muted">{r.expiry}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Claims() {
  const canProcess = usePermission(PERMISSIONS.PROCESS_CLAIMS);
  const [claims, setClaims] = useState([
    { id: "CLM-001", policy: "POL-001", holder: "Ravi Kumar", amount: "₹45,000", status: "Pending", date: "2025-01-08" },
    { id: "CLM-002", policy: "POL-002", holder: "Anita Shah", amount: "₹18,500", status: "Under Review", date: "2025-01-10" },
    { id: "CLM-003", policy: "POL-003", holder: "Mohan Rao", amount: "₹1,20,000", status: "Approved", date: "2024-12-28" },
    { id: "CLM-004", policy: "POL-001", holder: "Priya Nair", amount: "₹6,200", status: "Rejected", date: "2024-12-15" },
  ]);

  const statusColors = {
    "Pending": "#422006:#fdba74",
    "Under Review": "#1e3a5f:#60a5fa",
    "Approved": "#1c3a2e:#34d399",
    "Rejected": "#450a0a:#f87171",
  };

  const process = (id, action) => {
    setClaims((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: action === "approve" ? "Approved" : "Rejected" } : c)
    );
  };

  return (
    <div className="rd-content">
      <h1 className="rd-content__title">Claims</h1>
      <div className="rd-table">
        <div className={`rd-table__head ${canProcess ? "rd-table__head--claim" : "rd-table__head--claim-noact"}`}>
          <span>Claim ID</span><span>Policy</span><span>Holder</span>
          <span>Amount</span><span>Status</span><span>Date</span>
          {canProcess && <span>Action</span>}
        </div>
        {claims.map((c) => {
          const [bg, color] = (statusColors[c.status] || "#1e293b:#94a3b8").split(":");
          return (
            <div key={c.id} className={`rd-table__row ${canProcess ? "rd-table__row--claim-action" : "rd-table__row--claim-noact"}`}>
              <span className="rd-table__mono">{c.id}</span>
              <span className="rd-table__mono">{c.policy}</span>
              <span className="rd-table__bold">{c.holder}</span>
              <span className="rd-table__bold">{c.amount}</span>
              <span><span className="rd-badge" style={{ background: bg, color }}>{c.status}</span></span>
              <span className="rd-table__muted">{c.date}</span>
              {canProcess && (
                <span className="rd-claim-actions">
                  {c.status === "Pending" || c.status === "Under Review" ? (
                    <>
                      <button className="rd-claim-btn rd-claim-btn--approve" onClick={() => process(c.id, "approve")}>✓</button>
                      <button className="rd-claim-btn rd-claim-btn--reject" onClick={() => process(c.id, "reject")}>✕</button>
                    </>
                  ) : <span className="rd-table__muted">—</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Users() {
  const { users } = useApp();
  return (
    <div className="rd-content">
      <h1 className="rd-content__title">Users</h1>
      {users.length === 0 ? (
        <div className="rd-empty">
          <div className="rd-empty__icon">👥</div>
          <p>No users in your organization</p>
        </div>
      ) : (
        <div className="rd-table">
          <div className="rd-table__head rd-table__head--user">
            <span>Name</span><span>Username</span><span>Role</span><span>Created</span>
          </div>
          {users.map((u) => {
            const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer;
            return (
              <div key={u.id} className="rd-table__row rd-table__row--user">
                <span className="rd-table__bold">{u.name}</span>
                <span className="rd-table__mono">{u.username}</span>
                <span><span className="rd-badge" style={{ background: rc.bg, color: rc.color }}>{ROLE_LABELS[u.role]}</span></span>
                <span className="rd-table__muted">{u.createdAt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Reports() {
  return (
    <div className="rd-content">
      <h1 className="rd-content__title">Reports</h1>
      <div className="rd-reports-grid">
        {[
          { title: "Claims Summary", period: "Jan 2025", type: "Monthly", icon: "🗂️" },
          { title: "Policy Renewals", period: "Q4 2024", type: "Quarterly", icon: "📋" },
          { title: "Premium Collection", period: "FY 2024-25", type: "Annual", icon: "💰" },
          { title: "Pending Approvals", period: "Jan 2025", type: "Weekly", icon: "⏳" },
          { title: "Agent Performance", period: "Jan 2025", type: "Monthly", icon: "👤" },
          { title: "Loss Ratio Analysis", period: "Q4 2024", type: "Quarterly", icon: "📊" },
        ].map((r) => (
          <div key={r.title} className="rd-report-card">
            <div className="rd-report-card__icon">{r.icon}</div>
            <div className="rd-report-card__title">{r.title}</div>
            <div className="rd-report-card__meta">{r.period} · {r.type}</div>
            <button className="rd-report-card__btn">Download</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="rd-content">
      <h1 className="rd-content__title">Settings</h1>
      <div className="rd-settings-list">
        {[
          { label: "Organization Name", value: "Acme Insurance Ltd.", editable: true },
          { label: "Notification Email", value: "admin@acme.com", editable: true },
          { label: "Timezone", value: "Asia/Kolkata (IST)", editable: true },
          { label: "Two-Factor Auth", value: "Disabled", editable: true },
        ].map((s) => (
          <div key={s.label} className="rd-setting-row">
            <div>
              <div className="rd-setting-row__label">{s.label}</div>
              <div className="rd-setting-row__value">{s.value}</div>
            </div>
            {s.editable && <button className="rd-setting-row__edit">Edit</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Org dropdown ──────────────────────────────────────── */
function OrgDropdown({ orgs, activeOrg, onSwitch }) {
  const [open, setOpen] = useState(false);

  if (!orgs || orgs.length === 0) return null;

  if (orgs.length === 1) {
    return (
      <div className="rd-org-single">
        <span className="rd-org-single__icon">🏢</span>
        <span className="rd-org-single__name">{orgs[0].name}</span>
      </div>
    );
  }

  return (
    <div className="rd-org-drop" onBlur={() => setOpen(false)} tabIndex={-1}>
      <button className="rd-org-drop__btn" onClick={() => setOpen((p) => !p)}>
        <span className="rd-org-drop__icon">🏢</span>
        <span className="rd-org-drop__name">{activeOrg?.name ?? "Select org"}</span>
        <span className="rd-org-drop__caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="rd-org-drop__menu">
          {orgs.map((org) => (
            <button
              key={org.id}
              className={`rd-org-drop__item ${activeOrg?.id === org.id ? "rd-org-drop__item--active" : ""}`}
              onMouseDown={() => { onSwitch(org); setOpen(false); }}
            >
              <span className="rd-org-drop__item-name">{org.name}</span>
              {org.slug && <span className="rd-org-drop__item-slug">{org.slug}</span>}
              {activeOrg?.id === org.id && <span className="rd-org-drop__item-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main dashboard ────────────────────────────────────── */
export default function RoleDashboard() {
  const navigate = useNavigate();
  const { currentUser, activeOrg, switchOrg, logout } = useApp();
  const [activeNav, setActiveNav] = useState("overview");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const visibleNav = NAV_ITEMS.filter(
    (n) => n.permission === null || hasPermission(currentUser.role, n.permission)
  );

  const rc = ROLE_COLORS[currentUser.role] ?? ROLE_COLORS.viewer;

  const renderContent = () => {
    switch (activeNav) {
      case "overview": return <Overview user={currentUser} />;
      case "policies": return <Policies />;
      case "claims":   return <Claims />;
      case "users":    return <Users />;
      case "reports":  return <Reports />;
      case "settings": return <Settings />;
      default:         return <Overview user={currentUser} />;
    }
  };

  return (
    <div className="rd-shell">
      {/* Sidebar */}
      <aside className="rd-sidebar">
        <div className="rd-sidebar__brand">
          <span className="rd-sidebar__brand-icon">🛡️</span>
          <span className="rd-sidebar__brand-name">InsureHub fff</span>
        </div>

        <nav className="rd-sidebar__nav">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              className={`rd-sidebar__item ${activeNav === n.id ? "rd-sidebar__item--active" : ""}`}
              onClick={() => setActiveNav(n.id)}
            >
              <span className="rd-sidebar__item-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="rd-sidebar__footer">
          <div className="rd-sidebar__user">
            <div className="rd-sidebar__user-name">{currentUser.fullName ?? currentUser.name ?? currentUser.email}</div>
            <span className="rd-sidebar__user-role" style={{ background: rc.bg, color: rc.color }}>
              {ROLE_LABELS[currentUser.role]}
            </span>
          </div>
          <button className="rd-sidebar__logout" onClick={handleLogout} title="Logout">⏻</button>
        </div>
      </aside>

      {/* Main */}
      <main className="rd-main">
        <header className="rd-topbar">
          <OrgDropdown
            orgs={currentUser?.orgs}
            activeOrg={activeOrg}
            onSwitch={switchOrg}
          />
          <div className="rd-topbar__right">
            <span className="rd-topbar__email">{currentUser?.email}</span>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}
