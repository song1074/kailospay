// src/components/PaymentButton.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://kailospay.cafe24.com"; // 필요 시 수정

type Props = {
  amount: number;
};

export default function PaymentButton({ amount }: Props) {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handlePay() {
    if (!amount || amount < 1000) {
      alert("결제 금액은 최소 1000원 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("로그인이 필요합니다.");
        nav("/login");
        return;
      }

      // 서버로 결제 요청 (payments 테이블에 기록)
      const res = await fetch(`${API_BASE}/api/payments/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, method: "card", title: "서비스 결제" }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "결제 요청 실패");
      }

      // 성공 → 결제 성공 페이지 이동
      nav("/pay/success", { state: { payment: data.payment } });
    } catch (e: any) {
      console.error("결제 오류:", e);
      nav("/pay/fail", { state: { error: e.message } });
    }
  }

  return (
    <button
      className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold disabled:opacity-50"
      onClick={handlePay}
      disabled={loading}
    >
      {loading ? "처리 중..." : `${amount.toLocaleString()}원 결제하기`}
    </button>
  );
}
