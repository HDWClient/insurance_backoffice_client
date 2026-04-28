import { Routes, Route, Navigate } from "react-router-dom";
import SuperAdminLogin from "./components/SuperAdminLogin";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/"                element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login"     element={<SuperAdminLogin />} />
      <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
      <Route path="*"                element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}
