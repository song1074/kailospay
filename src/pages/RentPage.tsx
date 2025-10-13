// src/pages/RentPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type RentStatus = {
  ok: boolean;
  docs: { total: number; approved: number };
  ekyc: string;
};

const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "https://kailospay.cafe24.com"
    : "";

const api = (p: string) => `${API_BASE}${p}`;

export default function RentPage() {
  const nav = useNavigate();
  const token = localStorage.getItem("token") || "";

  // 항상 동일 형태의 헤더(타입 안정)
  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [docs, setDocs] = useState({ total: 0, approved: 0 });
  const [ekyc, setEkyc] = useState<string>("unverified");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const r = await fetch(api("/api/rent/status"), { headers: authHeaders });
    if (r.status === 401) return nav("/login");
    const j: RentStatus = await r.json();
    if (j?.ok) {
      setDocs(j.docs);
      setEkyc(j.ekyc ?? "unverified");
    }
  }

  useEffect(() => {
    (async () => {
      if (!token) return nav("/login");
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function uploadDocs(files: FileList | null, docType?: string) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      if (docType) fd.append("doc_type", docType);

      const r = await fetch(api("/api/rent/docs"), {
        method: "POST",
        headers: authHeaders,
        body: fd,
      });
      if (r.status === 401) return nav("/login");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "업로드 실패");
      await refresh();
      alert("서류 업로드 완료 (검토 대기)");
    } catch (e: any) {
      alert(e?.message || "서류 업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  async function reEkyc(file: File | null) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("idcard", file);

      const r = await fetch(api("/api/rent/ekyc"), {
        method: "POST",
        headers: authHeaders,
        body: fd,
      });
      if (r.status === 401) return nav("/login");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "eKYC 실패");
      setEkyc(j.ekyc);
      alert(`eKYC 결과: ${j.ekyc}`);
    } catch (e: any) {
      alert(e?.message || "eKYC 실패");
    } finally {
      setBusy(false);
    }
  }

  const ready =
    docs.approved > 0 &&
    ["verified", "done", "approved"].includes((ekyc || "").toLowerCase());

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="animate-pulse h-24 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">임대료/월세 결제 준비</h1>

      {/* 1) 서류 업로드 */}
      <section className="rounded-2xl border p-4 bg-white">
        <div className="font-semibold mb-2">1) 관련 서류 업로드</div>
        <p className="text-sm text-gray-600 mb-3">
          임대차계약서, 통장사본, 영수증 등 — 여러 파일 업로드 가능 (승인 후 결제 가능)
        </p>
        <input
          type="file"
          multiple
          onChange={(e) => uploadDocs(e.target.files, "rent-doc")}
          disabled={busy}
          className="block"
        />
        <div className="mt-3 text-sm">
          현재 업로드: <b>{docs.total}</b>개 (승인 <b>{docs.approved}</b>개)
        </div>
        <button
          className="mt-3 text-sm underline text-gray-600 disabled:opacity-60"
          onClick={refresh}
          disabled={busy}
          type="button"
        >
          새로고침
        </button>
      </section>

      {/* 2) eKYC 재인증 */}
      <section className="rounded-2xl border p-4 bg-white">
        <div className="font-semibold mb-2">2) 신분증 재인증 (CLOVA eKYC)</div>
        <p className="text-sm text-gray-600 mb-3">규정에 따라 재확인이 필요합니다.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => reEkyc(e.target.files?.[0] || null)}
          disabled={busy}
          className="block"
        />
        <div className="mt-3 text-sm">
          현재 상태: <b>{ekyc}</b>
        </div>
      </section>

      {ready ? (
        <div className="flex items-center justify-between rounded-2xl border p-4 bg-green-50 text-green-900">
          <span>서류 승인 및 신분증 인증이 완료되었습니다.</span>
          <Link
            to="/pay?type=rent"
            className="px-4 py-2 rounded bg-indigo-600 text-white"
          >
            결제 단계로
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border p-4 bg-amber-50 text-amber-900">
          서류가 승인되고 신분증 인증이 완료되면 결제 단계로 진행할 수 있어요.
        </div>
      )}
    </div>
  );
}
