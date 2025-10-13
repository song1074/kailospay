// src/pages/admin/Company.tsx
import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type Company = {
  id?: number;
  name?: string;
  ceo?: string;
  biz_no?: string;
  address?: string;
  phone?: string;
  email?: string;
  mail_order_no?: string;
  updated_at?: string;
};

function adminHeaders() {
  const jwt = localStorage.getItem("token") || "";
  const xAdmin = localStorage.getItem("xAdminToken") || "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  if (xAdmin) h["x-admin-token"] = xAdmin;
  return h;
}

export default function Company() {
  const [data, setData] = useState<Company>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/company`, {
        headers: adminHeaders(),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.message || "로딩 실패");
      setData(j.company ?? {});
    } catch (e: any) {
      alert(e?.message || "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/company`, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.message || "저장 실패");
      alert("저장되었습니다.");
      load();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">회사 정보</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-600">상호명</span>
          <input
            className="input input-bordered w-full"
            value={data.name ?? ""}
            onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">대표</span>
          <input
            className="input input-bordered w-full"
            value={data.ceo ?? ""}
            onChange={(e) => setData((p) => ({ ...p, ceo: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">사업자등록번호</span>
          <input
            className="input input-bordered w-full"
            value={data.biz_no ?? ""}
            onChange={(e) =>
              setData((p) => ({ ...p, biz_no: e.target.value }))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">주소</span>
          <input
            className="input input-bordered w-full"
            value={data.address ?? ""}
            onChange={(e) =>
              setData((p) => ({ ...p, address: e.target.value }))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">전화번호</span>
          <input
            className="input input-bordered w-full"
            value={data.phone ?? ""}
            onChange={(e) => setData((p) => ({ ...p, phone: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">이메일</span>
          <input
            className="input input-bordered w-full"
            value={data.email ?? ""}
            onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-sm text-gray-600">통신판매업신고번호</span>
          <input
            className="input input-bordered w-full"
            value={data.mail_order_no ?? ""}
            onChange={(e) =>
              setData((p) => ({ ...p, mail_order_no: e.target.value }))
            }
          />
        </label>
      </div>

      <div className="mt-6 flex gap-2">
        <button className="btn" onClick={load} disabled={loading}>
          새로고침
        </button>
        <button className="btn btn-primary" onClick={save} disabled={loading}>
          {loading ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
