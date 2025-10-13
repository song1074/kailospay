// src/components/ui/RegistryIssueBox.tsx
import { useCallback, useEffect, useRef, useState } from "react";
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type Props = {
  address1?: string;   // 선택: 기록용
  address2?: string;   // 선택: 기록용
  compact?: boolean;
  showAddressFields?: boolean; // 기본 false (법인등기는 주소 불필요)
};

export default function RegistryIssueBox({
  address1 = "",
  address2 = "",
  compact = false,
  showAddressFields = false,
}: Props) {
  const [addr1, setAddr1] = useState(address1);
  const [addr2, setAddr2] = useState(address2);
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState<"idle"|"issuing"|"pending"|"ready"|"error">("idle");
  const [msg, setMsg] = useState("");
  const [reqId, setReqId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const acRef = useRef<AbortController | null>(null);

  const normBiz = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 10);
  const fmtBiz = (v: string) => {
    const n = normBiz(v);
    if (n.length <= 3) return n;
    if (n.length <= 5) return `${n.slice(0,3)}-${n.slice(3)}`;
    return `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}`;
  };

  const jfetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = { ...(init.headers as any) };
    if (!headers["Content-Type"] && init.body) headers["Content-Type"] = "application/json";
    const ac = new AbortController(); acRef.current = ac;
    const r = await fetch(url, { ...init, signal: ac.signal, headers, credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text().catch(()=> "")) || r.statusText}`);
    return r.json();
  }, []);

  const onIssue = useCallback(async () => {
    try {
      setMsg(""); setDownloadUrl(""); setReqId(null);
      const bizNum = normBiz(biz);
      if (bizNum.length !== 10) { setStatus("error"); setMsg("사업자등록번호 10자리를 입력하세요."); return; }

      const a1 = showAddressFields ? addr1 : address1;
      const a2 = showAddressFields ? addr2 : address2;

      setStatus("issuing");
      const uniqueKey = `apick-${bizNum}-${Date.now()}`;
      const body = { biz_num: bizNum, uniqueKey, address: [a1, a2].filter(Boolean).join(" ").trim() || null };

      const issue = await jfetch(`${API_BASE}/api/registry/apick/issue`, { method: "POST", body: JSON.stringify(body) });
      if (!issue?.ok || !issue?.requestId) throw new Error(issue?.error || "발급 요청 실패");
      setReqId(String(issue.requestId));

      setStatus("pending");
      for (let i = 0; i < 30; i++) {
        const st = await jfetch(`${API_BASE}/api/registry/apick/status/${issue.requestId}`);
        if (st?.ok && st?.status === "ready" && st?.download) {
          setStatus("ready"); setDownloadUrl(st.download);
          setMsg("발급 완료! 곧 다운로드가 시작됩니다.");
          setTimeout(() => {
            try { const a = document.createElement("a"); a.href = st.download; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); } catch {}
          }, 200);
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      setStatus("error"); setMsg("처리 대기시간 초과(약 1분). 잠시 후 다시 시도하세요.");
    } catch (e: any) {
      setStatus("error"); setMsg(String(e?.message || e));
    } finally { acRef.current = null; }
  }, [biz, addr1, addr2, address1, address2, showAddressFields, jfetch]);

  useEffect(() => () => acRef.current?.abort(), []);

  const disabled = status === "issuing" || status === "pending";
  const btnCls = compact
    ? `px-3 py-1.5 rounded-md text-white ${disabled ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`
    : `px-4 py-2 rounded-md text-white ${disabled ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`;

  return (
    <div className="space-y-3">
      {showAddressFields && (
        <>
          <input className="w-full border rounded px-3 py-2" placeholder="주소(선택)" value={addr1} onChange={e=>setAddr1(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="상세주소(선택)" value={addr2} onChange={e=>setAddr2(e.target.value)} />
        </>
      )}
      <div>
        <label className="block text-sm text-gray-600 mb-1">사업자등록번호 (필수)</label>
        <div className="flex gap-2">
          <input className="flex-1 border rounded px-3 py-2 tracking-widest" placeholder="000-00-00000"
                 inputMode="numeric" maxLength={12} value={fmtBiz(biz)} onChange={(e)=>setBiz(e.target.value)} />
          <button type="button" onClick={onIssue} disabled={disabled} className={btnCls}>
            {status === "issuing" ? "요청 중…" : status === "pending" ? "처리 중…" : "등기부 발급"}
          </button>
        </div>
      </div>

      {status !== "idle" && (
        <div className="text-sm">
          {status === "ready"   && <div className="text-green-700">✅ {msg} {downloadUrl && <a className="underline ml-1" href={downloadUrl}>직접 다운로드</a>}</div>}
          {status === "issuing" && <div className="text-blue-700">발급 요청을 보내는 중…</div>}
          {status === "pending" && <div className="text-blue-700">처리 중입니다(최대 1분)…</div>}
          {status === "error"   && <div className="text-red-700">오류: {msg}</div>}
        </div>
      )}
      {reqId && <div className="text-xs text-gray-500">요청 ID: {reqId}</div>}
    </div>
  );
}
