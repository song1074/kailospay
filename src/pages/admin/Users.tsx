// src/pages/admin/Users.tsx
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
};

const API_BASE = ""; // 배포에선 상대경로 권장

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return s;
  }
}

async function parseSafely(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return { ok: false, message: await res.text() };
}

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const token = localStorage.getItem("token") || "";

  async function fetchList(p = 1) {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE}/api/admin/users`, window.location.origin);
      if (term.trim()) url.searchParams.set("q", term.trim());
      url.searchParams.set("page", String(p));
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url.toString().replace(window.location.origin, ""), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "목록 조회 실패");

      setRows(data.users || []);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setSelected({});
    } catch (e: any) {
      alert(e?.message || "목록 조회 실패");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  async function removeOne(id: number) {
    if (!confirm("정말 이 사용자를 삭제할까요? (되돌릴 수 없습니다)")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseSafely(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "삭제 실패");
      await fetchList(page);
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  }

  async function removeSelected() {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (ids.length === 0) {
      alert("선택된 항목이 없습니다.");
      return;
    }
    if (!confirm(`선택된 ${ids.length}건을 삭제할까요? (되돌릴 수 없습니다)`)) return;

    try {
      // 병렬 삭제
      await Promise.all(
        ids.map((id) =>
          fetch(`${API_BASE}/api/admin/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (r) => {
            const d = await parseSafely(r);
            if (!r.ok || d?.ok === false) throw new Error(d?.message || `삭제 실패(${id})`);
          })
        )
      );
      await fetchList(page);
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected[r.id]);
  const toggleAll = (val: boolean) =>
    setSelected((prev) => {
      const next = { ...prev };
      rows.forEach((r) => (next[r.id] = val));
      return next;
    });

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">사용자 관리</h1>
      <p className="text-sm text-gray-500 mb-4">검색, 목록 조회, 개별 삭제를 지원합니다.</p>

      {/* 검색 바 */}
      <div className="flex gap-2 mb-3">
        <input
          className="input input-bordered w-80"
          placeholder="이름/이메일/연락처 검색"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchList(1)}
        />
        <button className="btn" onClick={() => fetchList(1)} disabled={loading}>
          검색
        </button>

        <div className="flex-1" />

        <button className="btn btn-error btn-outline" onClick={removeSelected} disabled={loading}>
          삭제
        </button>
      </div>

      {/* 표 */}
      <div className="overflow-x-auto rounded border">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="w-16">ID</th>
              <th className="w-40">이름</th>
              <th className="w-64">이메일</th>
              <th className="w-40">연락처</th>
              <th className="w-40">가입일</th>
              <th className="w-20 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={!!selected[r.id]}
                    onChange={(e) => setSelected((p) => ({ ...p, [r.id]: e.target.checked }))}
                  />
                </td>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td className="truncate max-w-[260px]" title={r.email}>
                  {r.email}
                </td>
                <td>{r.phone ?? "-"}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td className="text-center">
                  <button className="btn btn-xs btn-error" onClick={() => removeOne(r.id)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-10">
                  결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pages > 1 && (
        <div className="flex items-center gap-2 mt-4">
          <button className="btn btn-sm" onClick={() => fetchList(Math.max(1, page - 1))} disabled={page <= 1}>
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {pages} (총 {total.toLocaleString()}명)
          </span>
          <button className="btn btn-sm" onClick={() => fetchList(Math.min(pages, page + 1))} disabled={page >= pages}>
            다음
          </button>
        </div>
      )}
    </div>
  );
}
