// src/pages/PaySuccess.tsx
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function PaySuccess() {
  const location = useLocation();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(location.state?.payment || null);

  useEffect(() => {
    if (!order) {
      // 만약 state가 없으면 홈으로 돌려보내기
      nav("/");
    }
  }, [order, nav]);

  return (
    <div className="mx-auto max-w-lg px-4">
      <h1 className="text-2xl font-bold mb-4">결제가 완료되었습니다 ✅</h1>

      {order && (
        <div className="rounded-xl border p-4 text-sm space-y-2">
          <div className="flex justify-between"><span>주문번호</span><span>{order.order_id}</span></div>
          <div className="flex justify-between"><span>금액</span><span>{order.amount.toLocaleString()} 원</span></div>
          <div className="flex justify-between"><span>결제수단</span><span>{order.method}</span></div>
          <div className="flex justify-between"><span>상태</span><span>{order.status}</span></div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link to="/dashboard" className="px-4 py-2 rounded-xl border">마이페이지</Link>
        <Link to="/" className="px-4 py-2 rounded-xl border">홈으로</Link>
      </div>
    </div>
  );
}
