// src/pages/Pay.tsx
import { useEffect, useState } from "react";
import PaymentButton from "../components/PaymentButton";

const API_BASE = "https://kailospay.cafe24.com"; // 필요시 수정

export default function Pay() {
  const [amount, setAmount] = useState<number | "">("");
  const [canPay, setCanPay] = useState<boolean | null>(null); // null = 로딩중
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function checkCanPay() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("로그인이 필요합니다.");
          setCanPay(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/can-pay`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.message ?? "결제 가능 여부 확인 실패");
          setCanPay(false);
          return;
        }

        setCanPay(data.canPay);
      } catch (e: any) {
        setError(e.message ?? "서버 오류");
        setCanPay(false);
      }
    }

    checkCanPay();
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">결제하러가기</h1>

      {/* 승인 안된 경우 메시지 */}
      {canPay === false && (
        <div className="mb-4 rounded-lg bg-red-100 text-red-700 p-3 text-sm">
          관리자의 승인이 필요합니다. <br />
          자료 첨부 후 승인을 받아야 결제를 진행할 수 있습니다.
        </div>
      )}

      {/* 승인 여부 로딩 중 */}
      {canPay === null && (
        <p className="mb-4 text-gray-500 text-sm">승인 여부 확인 중...</p>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 rounded-lg bg-yellow-100 text-yellow-700 p-3 text-sm">
          {error}
        </div>
      )}

      {/* 승인된 경우만 결제 가능 */}
      {canPay && (
        <>
          <label className="block mb-4">
            <span className="text-sm">결제 금액(원)</span>
            <input
              type="number"
              min={1000}
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="예) 100000"
            />
          </label>

          <PaymentButton amount={typeof amount === "number" ? amount : 0} />
          <p className="text-xs text-gray-500 mt-3">
            결제 완료 시 자동 검증 후 성공 페이지로 이동합니다.
          </p>
        </>
      )}
    </div>
  );
}
