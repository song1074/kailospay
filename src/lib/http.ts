// src/lib/http.ts
const API_BASE =
  import.meta.env.VITE_API_BASE?.trim() ??
  "";

function toUrl(path: string) {
  // path가 이미 http로 시작하면 그대로 사용 (예외적으로 절대 URL 쓸 때)
  if (/^https?:\/\//i.test(path)) return path;
  // 상대 경로 보장
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE === undefined || API_BASE === null ? "" : API_BASE;
  return `${base}${p}`;
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = toUrl(path);
  const res = await fetch(url, {
    // JSON 기본 헤더
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    credentials: "include", // 토큰 헤더만 쓰면 지워도 됨
    ...init,
  });

  if (!res.ok) {
    // 에러 바디도 JSON으로 내려오므로 최대한 보여준다
    let detail: any;
    try { detail = await res.json(); } catch { /* ignore */ }
    const msg = detail?.message || detail?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  // 빈 응답이 아니면 JSON
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export function apiUrl(path: string) {
  return toUrl(path);
}
