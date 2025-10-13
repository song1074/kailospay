// src/pages/AdminUploads.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 서버에서 내려오는 업로드 행 타입 */
type UploadRow = {
  id: number;
  user_id: number;
  original_name: string;
  mime: string | null;
  size: number;
  saved_name: string;
  created_at: string;
  admin_note: string | null;
  reviewed: boolean; // 서버에서 파생 컬럼
  status: "approved" | "rejected" | "done" | null;
  user_name?: string | null;
  user_email?: string | null;
  reviewer_name?: string | null;
};

/** API 베이스 — 같은 도메인 프록시라면 빈 문자열 유지 */
const API_BASE = "";

/* --------------------------------- 유틸 --------------------------------- */
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function qs(obj: Record<string, string>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => p.set(k, v));
  return p.toString();
}
function buildHeaders(adminToken: string, jwt: string) {
  const h: Record<string, string> = {};
  if (adminToken) h["x-admin-token"] = adminToken;
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  return h;
}
async function parseSafely(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  return { ok: false, message: text || `HTTP ${res.status}` };
}

/* --------------------------------- 컴포넌트 --------------------------------- */
export default function AdminUploads() {
  const [adminToken, setAdminToken] = useState(
    localStorage.getItem("xAdminToken") ?? ""
  );
  const [jwt, setJwt] = useState(localStorage.getItem("token") ?? "");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // 로컬 편집 버퍼
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [checks, setChecks] = useState<Record<number, boolean>>({});

  // 디바운스용
  const termRef = useRef(term);
  termRef.current = term;

  const previewUrl = (savedName: string) =>
    `${API_BASE}/api/uploads/preview/${encodeURIComponent(savedName)}?${qs({
      admin_token: adminToken,
      token: jwt,
    })}`;
  const downloadUrl = (savedName: string) =>
    `${API_BASE}/api/uploads/download/${encodeURIComponent(savedName)}?${qs({
      admin_token: adminToken,
      token: jwt,
    })}`;

  const fetchList = useCallback(async () => {
    if (!adminToken) {
      setErrMsg("x-admin-token을 먼저 입력/저장하세요.");
      setRows([]);
      return;
    }
    setLoading(true);
    setErrMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/uploads`, {
        headers: buildHeaders(adminToken, jwt),
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || `목록 조회 실패 (${res.status})`);
      }
      const list: UploadRow[] = data.uploads ?? [];
      setRows(list);

      // 편집 버퍼 초기화
      const initNotes: Record<number, string> = {};
      const initChecks: Record<number, boolean> = {};
      list.forEach((r) => {
        initNotes[r.id] = r.admin_note ?? "";
        initChecks[r.id] = !!r.reviewed;
      });
      setNotes(initNotes);
      setChecks(initChecks);
    } catch (e: any) {
      setRows([]);
      setErrMsg(e?.message ?? "목록 불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [adminToken, jwt]);

  // 검토/메모 저장
  async function saveRow(r: UploadRow) {
    try {
      const body = { reviewed: checks[r.id], note: notes[r.id] ?? null };
      const res = await fetch(`${API_BASE}/api/admin/uploads/${r.id}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders(adminToken, jwt),
        },
        body: JSON.stringify(body),
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "저장 실패");
      await fetchList();
    } catch (e: any) {
      alert(e.message ?? "저장 실패");
    }
  }

  // 승인
  async function approve(r: UploadRow) {
    if (!confirm(`[승인] ${r.original_name} 처리할까요?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/uploads/${r.id}/approve`, {
        method: "POST",
        headers: buildHeaders(adminToken, jwt),
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "승인 실패");
      await fetchList();
    } catch (e: any) {
      alert(e.message ?? "승인 실패");
    }
  }

  // 거절
  async function reject(r: UploadRow) {
    if (!confirm(`[거절] ${r.original_name} 처리할까요?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/uploads/${r.id}/reject`, {
        method: "POST",
        headers: buildHeaders(adminToken, jwt),
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "거절 실패");
      await fetchList();
    } catch (e: any) {
      alert(e.message ?? "거절 실패");
    }
  }

  // 초기 진입 시 자동 로드
  useEffect(() => {
    if (adminToken) fetchList();
  }, [adminToken, fetchList]);

  // 토큰 저장/불러오기
  const saveAdminToken = () => {
    localStorage.setItem("xAdminToken", adminToken);
    fetchList();
  };
  const loadAdminToken = () =>
    setAdminToken(localStorage.getItem("xAdminToken") ?? "");

  const saveJwt = () => {
    localStorage.setItem("token", jwt);
    alert("JWT 저장됨");
  };
  const loadJwt = () => setJwt(localStorage.getItem("token") ?? "");

  // 검색 디바운스
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(termRef.current), 200);
    return () => clearTimeout(t);
  }, [term]);

  const filtered = useMemo(() => {
    const t = debounced.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const hay = [
        String(r.id),
        r.original_name,
        r.mime ?? "",
        r.user_name ?? "",
        r.user_email ?? "",
        r.status ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    });
  }, [rows, debounced]);

  return (
    <div className="container-x max-w-6xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">관리자 · 업로드 파일 관리</h1>

      {/* 토큰 입력 */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-28 text-sm text-gray-600">x-admin-token</div>
          <input
            className="input input-bordered w-[420px]"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="예: superadmin123"
          />
          <button className="btn btn-sm" onClick={saveAdminToken} disabled={loading}>
            토큰 저장 & 불러오기
          </button>
          <button className="btn btn-sm" onClick={loadAdminToken} disabled={loading}>
            불러오기
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={fetchList}
            disabled={loading}
          >
            {loading ? "불러오는 중…" : "목록 불러오기"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-28 text-sm text-gray-600">JWT 토큰</div>
          <input
            className="input input-bordered w-[420px]"
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
            placeholder="(선택) 관리자 JWT 필요 시"
          />
          <button className="btn btn-sm" onClick={saveJwt} disabled={loading}>
            JWT 저장
          </button>
          <button className="btn btn-sm" onClick={loadJwt} disabled={loading}>
            불러오기
          </button>
        </div>
      </div>

      {errMsg && (
        <div className="mb-4 rounded bg-red-100 text-red-700 px-3 py-2 text-sm">
          {errMsg}
        </div>
      )}

      {/* 검색 */}
      <input
        className="input input-bordered w-full mb-4"
        placeholder="검색어 입력… (파일명, MIME, 상태, ID 등)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-14">ID</th>
              <th>파일명</th>
              <th className="w-24">크기</th>
              <th className="w-28">MIME</th>
              <th className="w-16">user_id</th>
              <th className="w-16">검토</th>
              <th className="w-64">메모</th>
              <th className="w-16">미리보기</th>
              <th className="w-16">다운로드</th>
              <th className="w-16">저장</th>
              <th className="w-24">상태</th>
              <th className="w-28">승인/거절</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td
                  className="truncate max-w-[360px]"
                  title={r.original_name}
                >
                  {r.original_name}
                </td>
                <td>{fmtBytes(r.size)}</td>
                <td>{r.mime ?? "-"}</td>
                <td>{r.user_id}</td>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={!!checks[r.id]}
                    onChange={(e) =>
                      setChecks((p) => ({ ...p, [r.id]: e.target.checked }))
                    }
                  />
                </td>
                <td>
                  <input
                    className="input input-bordered input-sm w-full"
                    placeholder="메모"
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((p) => ({ ...p, [r.id]: e.target.value }))
                    }
                  />
                </td>

                {/* 미리보기/다운로드: 새창 */}
                <td>
                  <a
                    href={previewUrl(r.saved_name)}
                    target="_blank"
                    rel="noopener"
                    className="btn btn-sm"
                  >
                    보기
                  </a>
                </td>
                <td>
                  <a
                    href={downloadUrl(r.saved_name)}
                    className="btn btn-sm"
                  >
                    받기
                  </a>
                </td>

                {/* 저장 */}
                <td>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => saveRow(r)}
                    disabled={loading}
                  >
                    저장
                  </button>
                </td>

                {/* 상태 */}
                <td>
                  {r.status === "approved" ? (
                    <span className="badge bg-green-500 text-white px-3 py-1 rounded-full">
                      승인됨
                    </span>
                  ) : r.status === "rejected" ? (
                    <span className="badge bg-red-500 text-white px-3 py-1 rounded-full">
                      거절됨
                    </span>
                  ) : (
                    <span className="badge bg-gray-400 text-white px-3 py-1 rounded-full">
                      대기
                    </span>
                  )}
                </td>

                {/* 승인/거절 */}
                <td className="flex gap-2">
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => approve(r)}
                    disabled={loading}
                  >
                    승인
                  </button>
                  <button
                    className="btn btn-sm btn-error"
                    onClick={() => reject(r)}
                    disabled={loading}
                  >
                    거절
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-gray-500 py-12">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
