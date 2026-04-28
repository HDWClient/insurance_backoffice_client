import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function AdminRoute({ children }) {
  const { isSuperAdmin, currentUser } = useApp();
  // isSuperAdmin: in-memory state (set by loginSuperAdmin)
  // sessionStorage: survives page reload in same tab
  // currentUser.isSuperAdmin: persisted in localStorage, survives new tabs and full reloads
  const allowed = isSuperAdmin
    || sessionStorage.getItem("ih_sa") === "1"
    || currentUser?.isSuperAdmin === true;
  return allowed ? children : <Navigate to="/admin/login" replace />;
}
