import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function UserRoute({ children }) {
  const { currentUser } = useApp();
  return currentUser ? children : <Navigate to="/login" replace />;
}
