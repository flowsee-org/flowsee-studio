import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { canAccessModule } from "@/lib/permissions";

export default function ModuleRoute({ module }) {
  const { user } = useAuth();
  if (!canAccessModule(user, module)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
