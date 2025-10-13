import { useEffect, useMemo, useState } from "react";

type Payment = {
  id: number;
  order_id: string;
  user_id: number;
  title: string | null;
  amount: number;
  status: string;      // pending/approved/rejected/complete ...
  method: string | null;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const statusOptions = [
  { v: "", t: "전체" },
  { v: "pending", t: "승인대기/결제대기" },
  { v: "approved", t: "승인됨" },
  { v: "rejected", t: "거절됨" },
  { v: "complete", t: "완료" },
];

const methodOptions = [
  { v: "", t: "카테고리" },
  { v: "card", t: "카드" },
  { v: "transfer", t: "계좌이체" },
  { v: "virtual", t: "가상계좌" },
];

function fmtAmount(n: number) {
  return n.toLocaleString("ko-KR");
}
function fmtDT(s: string) {
  try {
    const d = new Date(s);
    if (Number.isNaN(+d)) return s;
    return d.toLocaleString("ko-KR");
  } catch {
    return s;
  }
}

export default function AdminPaymentRequests() {
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const token = localStorage.getItem("token") || "";

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (method) sp.set("method", method);
      if (q.trim()) sp.set("q", q.trim());
      sp.set("page", String(page));
      sp.set("limit", String(limit));

      const res = await fetch(`${API_BASE}/api/admin/payments?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || `조회 실패 (${res.status})`);
      }
      setRows(data.payments || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setErr(e?.message || "조회 실패");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method, page]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function remove(id: number) {
    if (!confirm(`정말로 #${id} 항목을 삭제할까요?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.message || "삭제 실패");
      await load();
    } catch (e: any) {
      alert(e?.message || "삭제 실패");
    }
  }

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  return (
    <div className="max-w-[1400px] mx-auto py-6">
      <h1 className="text-xl font-bold mb-4">결제 요청서 리스트</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          className="select select-bordered select-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {statusOptions.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>

        <select
          className="select select-bordered select-sm"
          value={method}
          onChange={(e) => { setMethod(e.target.value); setPage(1); }}
        >
          {methodOptions.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>

        <form onSubmit={onSearchSubmit} className="flex items-center gap-2 ml-auto">
          <input
            className="input input-bordered input-sm w-64"
            placeholder="검색어 입력 (주문ID/제목/이름/이메일/연락처)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-sm" disabled={loading}>검색</button>
        </form>
      </div>

      {err && (
        <div className="mb-3 rounded bg-red-100 text-red-700 px-3 py-2 text-sm">{err}</div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th className="w-16">번호</th>
              <th className="w-44">등록일자</th>
              <th className="w-28">결제 승인 상태</th>
              <th className="w-24">관리</th>
              <th>결제정보</th>
              <th className="w-28">서비스</th>
              <th className="w-28">신청인 이름</th>
              <th className="w-32">신청인 연락처</th>
              <th className="w-40">거래 상대</th>
              <th className="w-40">이메일</th>
              <th className="w-20">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{fmtDT(r.created_at)}</td>
                <td>
                  {r.status === "approved" ? (
                    <span className="badge bg-green-500 text-white">승인됨</span>
                  ) : r.status === "rejected" ? (
                    <span className="badge bg-red-500 text-white">거절됨</span>
                  ) : r.status === "complete" ? (
                    <span className="badge bg-blue-500 text-white">완료</span>
                  ) : (
                    <span className="badge bg-gray-400 text-white">대기</span>
                  )}
                </td>
                <td className="space-x-2">
                  <button className="btn btn-xs">보기</button>
                  <button className="btn btn-xs">업데이트</button>
                </td>
                <td>
                  {/* 결제정보: 제목, 금액, 주문ID */}
                  <div className="text-sm">
                    <div className="font-medium">{r.title || "-"}</div>
                    <div>금액: {fmtAmount(r.amount)} 원</div>
                    <div>주문ID: {r.order_id}</div>
                  </div>
                </td>
                <td>{r.method || "-"}</td>
                <td>{r.customer_name || "-"}</td>
                <td>{r.phone || "-"}</td>
                <td>{/* 상대방/예금주 등은 현재 스키마에 없으므로 비움 */}-</td>
                <td>{r.email || "-"}</td>
                <td>
                  <button className="btn btn-xs btn-error" onClick={() => remove(r.id)}>삭제</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="text-center text-gray-500 py-12">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          총 {total.toLocaleString()}건 / {page}/{pageCount}페이지
        </div>
        <div className="space-x-2">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(1)}>처음</button>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>이전</button>
          <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>다음</button>
          <button className="btn btn-sm" disabled={page >= pageCount} onClick={() => setPage(pageCount)}>마지막</button>
        </div>
      </div>
    </div>
  );
}
