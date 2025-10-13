// src/components/ProtectedRoute.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null; // 로딩 컴포넌트로 대체 가능

  if (!user) {
    const returnTo = location.pathname + location.search;
    return (
      <Navigate
        to={{ pathname: "/login", search: `?returnTo=${encodeURIComponent(returnTo)}` }}
        replace
        state={{ returnTo }}
      />
    );
  }

  return <>{children}</>;
}
