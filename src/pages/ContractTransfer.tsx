import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const BANKS = [
  { code: "004", name: "KB국민" },
  { code: "088", name: "신한" },
  { code: "003", name: "기업" },
  { code: "020", name: "우리" },
  { code: "011", name: "NH농협" },
  { code: "081", name: "하나" },
  { code: "027", name: "한국씨티" },
  { code: "089", name: "케이뱅크" },
  { code: "090", name: "카카오뱅크" },
];

type VerifyResp = {
  ok: boolean;
  matched?: boolean;
  reason?: string;
  holderNameInput?: string;
  vendorHolderName?: string | null;
  vendorInfo?: any;
  error?: string;
};

export default function ContractTransfer() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [bankCode, setBankCode] = useState("004");
  const [accountNo, setAccountNo] = useState("");
  const [holderName, setHolderName] = useState("");

  const [amount, setAmount] = useState<number | "">("");

  // 검증 결과 표시
  const [verify, setVerify] = useState<VerifyResp | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onVerifyAccount() {
    setVerify(null);

    const acc = accountNo.replace(/[^\d]/g, "");
    const name = holderName.trim();

    if (!name) {
      alert("예금주명을 입력하세요.");
      return;
    }
    if (!acc) {
      alert("계좌번호를 입력하세요.");
      return;
    }

    setVerifying(true);
    try {
      const r = await fetch(`${API_BASE}/api/apick/account/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bank_code: bankCode,
          account: acc,
          holderName: name,
        }),
      });
      const j: VerifyResp = await r.json().catch(() => ({ ok: false, error: "bad_json" }));
      setVerify(j);
    } catch (e: any) {
      setVerify({ ok: false, error: String(e?.message || e) });
    } finally {
      setVerifying(false);
    }
  }

  const category = sp.get("category") || "rent";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold mb-6">계약등록 – 이체 정보</h1>

      {/* 수취 계좌 */}
      <section className="mb-6">
        <div className="text-lg font-semibold mb-2">누구에게 이체하시겠습니까? *</div>
        <div className="border rounded-lg p-3 space-y-3">
          {/* 예금주 입력 */}
          <div>
            <div className="text-sm text-gray-600 mb-1">거래상대방(받는분) 예금주</div>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="예금주명"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <div className="text-sm text-gray-600 mb-1">은행 선택</div>
              <select
                className="w-full border rounded px-3 py-2"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              >
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <div className="text-sm text-gray-600 mb-1">거래상대방(받는분) 계좌번호</div>
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="계좌번호"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                inputMode="numeric"
              />
            </div>

            <div className="md:col-span-1">
              <button
                onClick={onVerifyAccount}
                disabled={verifying}
                className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                {verifying ? "확인 중..." : "계좌인증"}
              </button>
            </div>
          </div>

          {/* 검증 결과 표시(실제 값 출력) */}
          {verify && (
            <div className="text-sm mt-2">
              {verify.ok && verify.matched ? (
                <div className="text-green-700">
                  예금주 일치 확인됨 ✅
                  {verify.vendorHolderName && (
                    <span className="ml-2 text-gray-700">
                      (은행측 예금주명: <b>{verify.vendorHolderName}</b>)
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  예금주 불일치. 입력하신 이름과 다릅니다.
                  <div className="mt-1 text-xs text-red-700">
                    <div>이유(reason): <b>{verify?.reason || "-"}</b></div>
                    <div>입력한 예금주명: <b>{verify?.holderNameInput || holderName || "-"}</b></div>
                    <div>은행측 예금주명: <b>{verify?.vendorHolderName ?? "-"}</b></div>
                    {verify?.error && <div>오류: {verify.error}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 금액 */}
      <section className="mb-8">
        <div className="text-lg font-semibold mb-2">이체금액을 입력하세요 *</div>
        <div className="border rounded-lg p-3 space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="이체금액 (원)"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              setAmount(v === "" ? "" : Number(v));
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded bg-indigo-600 text-white"
              onClick={() => alert("바로송금(추후 연결)")}
            >
              바로송금
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-slate-700 text-white"
              onClick={() => alert("예약송금(추후 연결)")}
            >
              예약송금
            </button>
          </div>
        </div>
      </section>

      {/* 하단 */}
      <section className="flex items-center justify-between">
        <button
          onClick={() => nav(`/contracts/new?category=${encodeURIComponent(category)}`)}
          className="px-4 py-3 rounded bg-gray-200 text-gray-900"
        >
          이전
        </button>
        <button
          onClick={() => alert("승인요청(다음 단계)")}
          className="px-5 py-3 rounded bg-emerald-600 text-white"
        >
          승인요청(다음)
        </button>
      </section>
    </div>
  );
}
