// src/lib/auth.ts

/** 같은 도메인이면 "", 별도 백엔드면 VITE_API_BASE에 넣어주세요 */
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function getToken(): string {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

export function withAuthHeaders(init?: RequestInit): RequestInit {
  const t = getToken();
  return {
    credentials: "include",
    ...(init || {}),
    headers: {
      ...(init?.headers || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  };
}

/** 401이면 로그인으로 보냄(복귀용 returnTo 부착) */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const r = await fetch(input, withAuthHeaders(init));
  if (r.status === 401) {
    const here = `${location.pathname}${location.search}`;
    alert("로그인이 필요합니다. 다시 로그인해 주세요.");
    location.href = `/login?returnTo=${encodeURIComponent(here)}`;
    throw new Error("AUTH");
  }
  return r;
}
