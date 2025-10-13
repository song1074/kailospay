// src/pages/ContractCreate.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type EkycStatus = "verified" | "unverified" | "pending" | "rejected";

export default function ContractCreate() {
  const nav = useNavigate();
  const [title, setTitle] = useState("임대료/월세 계약");
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState<number>(0);

  // 임시저장 후 부여되는 contractId
  const [contractId, setContractId] = useState<number | null>(null);

  // 첨부서류
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // 본인인증(eKYC) 상태
  const [ekyc, setEkyc] = useState<EkycStatus>("unverified");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 로그인된 유저의 eKYC 상태 불러오기 (서버에 맞춰 엔드포인트 조정)
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/ekyc/status`, { credentials: "include" });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok && j?.status) setEkyc(j.status as EkycStatus);
      } catch {}
    })();
  }, []);

  async function onSaveDraft() {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, category, amount }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok || !j?.id) throw new Error(j?.message || "임시저장 실패");
      setContractId(j.id);
      alert("임시저장 완료! 첨부서류를 업로드하세요.");
    } catch (e: any) {
      alert(e?.message || "임시저장 실패");
    } finally {
      setBusy(false);
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...list]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onUploadFiles() {
    if (!contractId) return alert("먼저 임시저장을 해주세요.");
    if (!files.length) return alert("업로드할 파일을 선택하세요.");

    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f); // 멀티파일
      const r = await fetch(`${API_BASE}/api/contracts/${contractId}/files`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.message || "파일 업로드 실패");
      setFiles([]);
      alert(`첨부 ${j.count || 0}건 업로드 완료`);
    } catch (e: any) {
      alert(e?.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">계약 등록</h1>

      {/* 기본 정보 */}
      <div className="space-y-3 border rounded p-4 mb-6">
        <label className="block">
          <span className="text-sm text-gray-600">제목</span>
          <input className="w-full border rounded px-3 py-2"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">카테고리</span>
          <select className="w-full border rounded px-3 py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}>
            <option value="rent">rent</option>
            <option value="deposit">deposit</option>
            <option value="etc">etc</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">금액</span>
          <input type="number" className="w-full border rounded px-3 py-2"
                 value={amount}
                 onChange={(e) => setAmount(Number(e.target.value || 0))} />
        </label>

        <button
          onClick={onSaveDraft}
          disabled={busy}
          className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60">
          {busy ? "저장 중..." : "임시저장"}
        </button>

        {contractId && (
          <p className="text-sm text-gray-500">contractId: <b>{contractId}</b></p>
        )}
      </div>

      {/* 첨부 서류 */}
      <div className="border rounded p-4 mb-6">
        <div className="font-semibold mb-2">첨부 서류</div>
        <p className="text-sm text-gray-500 mb-3">계약을 임시저장한 후 업로드 가능합니다.</p>

        <input
          ref={fileRef}
          type="file"
          multiple
          className="block mb-3"
          onChange={onPickFiles}
          accept="image/*,.pdf"
        />

        {/* 선택 목록 */}
        {!!files.length && (
          <ul className="mb-3 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <span className="truncate">{f.name}</span>
                <button
                  className="text-red-600"
                  onClick={() => removeFile(i)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onUploadFiles}
          disabled={!contractId || !files.length || uploading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
          {uploading ? "업로드 중..." : "첨부 업로드"}
        </button>
      </div>

      {/* 본인 인증 블록 */}
      <div className="border rounded p-4">
        <div className="font-semibold mb-2">본인 인증</div>
        <div className="text-sm mb-3">
          신분증 인증 상태: <b>{ekyc}</b>
        </div>
        <button
          onClick={() => nav("/ekyc/reverify")}
          className="px-4 py-2 rounded bg-gray-800 text-white">
          신분증 재인증 페이지로 이동
        </button>
      </div>
    </div>
  );
}
