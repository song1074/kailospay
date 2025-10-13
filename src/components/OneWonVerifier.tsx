import React, { useState } from "react";

/**
 * 1원 인증 UI 컴포넌트 (가장 쉬운 흐름)
 * - 계좌/예금주 입력 → /api/onewon/start → 2초 후 /api/onewon/confirm 자동 호출
 * - JWT 토큰은 localStorage.token 에서 읽음
 * - 같은 도메인에서 프록시된다면 API_BASE는 빈 문자열 유지
 */
export default function OneWonVerifier() {
  const [bankCode, setBankCode] = useState("004");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    | "idle"
    | "starting"
    | "start_ok"
    | "confirming"
    | "confirmed"
    | "failed"
  >("idle");
  const [message, setMessage] = useState("");
  const [providerRaw, setProviderRaw] = useState<any>(null);

  // API 서버 Base. 같은 도메인이면 ""(빈 문자열) 유지
  const API_BASE = ""; // 예: "http://kailospay.cafe24.com:4000"

  function getToken() {
    return localStorage.getItem("token") || ""; // 로그인 후 저장했다고 가정
  }

  async function callStart() {
    setLoading(true);
    setStatus("starting");
    setMessage("");
    setRequestId(null);
    setProviderRaw(null);

    try {
      const res = await fetch(`${API_BASE}/api/onewon/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          bankCode,
          accountNo,
          accountName,
          verifyType: "TEXT",
          text: "KP",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `start 실패 (HTTP ${res.status})`);
      }

      setRequestId(data.requestId);
      setProviderRaw(data.provider);
      setStatus("start_ok");
      setMessage("요청 완료. 잠시 후 자동 확인합니다…");

      // 2초 후 자동 confirm
      setTimeout(() => {
        callConfirm(data.requestId);
      }, 2000);
    } catch (e: any) {
      setStatus("failed");
      setMessage(e?.message || "요청 실패");
    } finally {
      setLoading(false);
    }
  }

  async function callConfirm(id?: string) {
    const rid = id || requestId;
    if (!rid) return;

    setLoading(true);
    setStatus("confirming");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/onewon/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ requestId: rid }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `confirm 실패 (HTTP ${res.status})`);
      }

      setProviderRaw(data.provider);
      setStatus("confirmed");
      setMessage("인증 완료! (DB 업데이트 반영)");
    } catch (e: any) {
      setStatus("failed");
      setMessage(e?.message || "확인 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 grid gap-4">
      <h1 className="text-2xl font-bold">1원 인증 (TEXT 방식)</h1>

      <div className="grid gap-2">
        <label className="text-sm">은행 코드</label>
        <input
          className="border rounded-xl p-3"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          placeholder="004"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm">계좌번호</label>
        <input
          className="border rounded-xl p-3"
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
          placeholder="하이픈 없이"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm">예금주</label>
        <input
          className="border rounded-xl p-3"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="홍길동"
        />
      </div>

      <div className="flex gap-3">
        <button
          className="px-5 py-3 rounded-2xl shadow disabled:opacity-50 border"
          onClick={callStart}
          disabled={loading || !bankCode || !accountNo || !accountName}
        >
          {loading && status !== "confirming" ? "요청 중…" : "1원 인증 요청"}
        </button>

        <button
          className="px-5 py-3 rounded-2xl shadow disabled:opacity-50 border"
          onClick={() => callConfirm()}
          disabled={loading || !requestId}
        >
          {loading && status === "confirming" ? "확인 중…" : "수동 확인"}
        </button>
      </div>

      <div className="text-sm">
        <div>상태: <b>{status}</b></div>
        {requestId && (
          <div className="break-all">requestId: {requestId}</div>
        )}
        {message && <div className="text-gray-600">{message}</div>}
      </div>

      {providerRaw && (
        <pre className="bg-gray-50 border rounded-xl p-3 text-xs overflow-auto max-h-64">
{JSON.stringify(providerRaw, null, 2)}
        </pre>
      )}
    </div>
  );
}
