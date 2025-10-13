// src/components/AdminRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import React from "react";
import { useAuth } from "../context/AuthProvider";

type Props = { children: React.ReactElement };

function AdminRoute({ children }: Props) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null; // 로딩 중이면 렌더 X

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!user.is_admin) {
    return <Navigate to="/" replace />; // 관리자가 아니면 홈으로
  }
  return children;
}

export default AdminRoute;
export { AdminRoute };
