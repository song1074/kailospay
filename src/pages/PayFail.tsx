// src/pages/PayFail.tsx
import { Link, useLocation } from "react-router-dom";

export default function PayFail() {
  const location = useLocation();
  const errorMsg = location.state?.error ?? "결제에 실패했습니다. 다시 시도해주세요.";

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-4 text-red-600">결제 실패</h1>
      <p className="mb-6 text-gray-700">{errorMsg}</p>
      <div className="flex justify-center gap-4">
        <Link
          to="/pay"
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          다시 결제하기
        </Link>
        <Link
          to="/docs/upload"
          className="px-6 py-3 bg-gray-100 border rounded-xl hover:bg-gray-200"
        >
          서류 다시 첨부
        </Link>
      </div>
    </div>
  );
}
