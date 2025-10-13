// src/context/AuthProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import api from "../lib/api";

export type User = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
};

type SignupInput =
  | { name: string; email: string; password: string }
  | { name: string; email: string; password: string; idcard: File };

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  signup: (p: SignupInput) => Promise<void>;
  refresh: () => Promise<User | null>;
};

const AuthCtx = createContext<Ctx | null>(null);

export const useAuth = () => {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
};

// axios 기본값: 쿠키 동반
api.defaults.withCredentials = true;

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // 토큰 헤더 세팅 헬퍼
  const setAuthHeader = (token: string | null) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage.setItem("token", token);
    } else {
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem("token");
    }
  };

  const refresh = async (): Promise<User | null> => {
    try {
      const { data } = await api.get("/api/me"); // 서버가 세션 쿠키/토큰 중 유효한 걸로 인증
      const u: User | null = data?.user ?? null;
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    // 1) 저장된 토큰 있으면 헤더 세팅
    const token = localStorage.getItem("token");
    setAuthHeader(token || null);
    // 2) 토큰이 있든 없든, 세션 쿠키가 있을 수도 있으므로 항상 refresh 시도
    refresh();
    // ready는 refresh 내부에서 true로 전환
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    // 서버가 토큰을 줄 수도 / 쿠키만 줄 수도 있음 → 둘 다 대응
    const { data } = await api.post("/api/login", { email, password });
    const token: string | undefined = data?.token;
    setAuthHeader(token ?? null);

    const me = await refresh();
    if (!me) throw new Error("로그인 후 사용자 정보 로드 실패");
    return me;
  };

  const signup = async (p: SignupInput) => {
    if ("idcard" in p && p.idcard instanceof File) {
      const fd = new FormData();
      fd.append("name", p.name);
      fd.append("email", p.email);
      fd.append("password", p.password);
      fd.append("idcard", p.idcard);
      await api.post("/api/signup", fd);
    } else {
      await api.post("/api/signup", p as { name: string; email: string; password: string });
    }
  };

  const logout = async () => {
    try {
      // 서버 세션 종료(있다면)
      await api.post("/api/logout").catch(() => {});
    } finally {
      setAuthHeader(null);
      setUser(null);
      setReady(true);
    }
  };

  const value = useMemo(
    () => ({ user, ready, login, logout, signup, refresh }),
    [user, ready]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
