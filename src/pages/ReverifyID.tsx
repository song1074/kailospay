import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authFetch } from "../lib/auth";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type EkycStatus = "verified" | "unverified" | "pending" | "rejected";

export default function ReverifyID() {
  const [sp] = useSearchParams();
  const nav = useNavigate();

  // 돌아갈 곳과 출처(from) 보존
  const returnTo = useMemo(() => sp.get("returnTo") || "/contracts/new", [sp]);
  const from = sp.get("from") || "";

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<EkycStatus>("unverified");
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImg(f);
  }

  // 현재 상태 조회(401은 authFetch가 알아서 처리)
  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API_BASE}/api/ekyc/status`);
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok && j?.status) setStatus(j.status as EkycStatus);
      } catch {
        /* handled in authFetch */
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!img) return alert("신분증 이미지를 선택하세요.");
    if (!/^image\/(jpe?g|png|webp)$/i.test(img.type || "")) {
      return alert("이미지(JPG/PNG/WEBP)만 업로드 가능합니다.");
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("idcard", img); // 서버: multer.single("image")

      const r = await authFetch(`${API_BASE}/api/ekyc/idcard`, {
        method: "POST",
        body: fd,
      });
      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) throw new Error(j?.message || "재인증 실패");

      setStatus(j.status || "verified");
      alert("인증되었습니다.");

      // 원래 페이지로 복귀
      const go = from
        ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`
        : returnTo;
      nav(go, { replace: true });
    } catch (e: any) {
      if (e?.message !== "AUTH") alert(e?.message || "재인증 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">신분증 재인증</h1>

      <div className="text-sm mb-4">
        현재 eKYC 상태: <b className={status === "verified" ? "text-green-600" : "text-red-600"}>{status}</b>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-600">신분증 이미지(JPG/PNG/WEBP)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="w-full"
            onChange={onPick}
          />
        </label>

        <button
          type="submit"
          disabled={busy || !img}
          className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
        >
          {busy ? "인증 중..." : "재인증 요청"}
        </button>
      </form>
    </div>
  );
}
