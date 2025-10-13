// src/pages/PayCategories.tsx
import { useNavigate } from "react-router-dom";

export default function PayCategories() {
  const nav = useNavigate();
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">어떤 결제가 필요하세요?</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => nav("/contract/add?type=rent")}
          className="p-6 rounded-2xl border hover:shadow"
        >
          <div className="font-semibold mb-2">임대료/월세</div>
          <div className="text-sm text-gray-600">계약 등록 후 진행</div>
        </button>

        <button
          onClick={() => alert("물품대금은 나중에 연결합니다.")}
          className="p-6 rounded-2xl border hover:shadow"
        >
          <div className="font-semibold mb-2">물품대금</div>
          <div className="text-sm text-gray-600">곧 제공 예정</div>
        </button>

        <button
          onClick={() => alert("급여는 나중에 연결합니다.")}
          className="p-6 rounded-2xl border hover:shadow"
        >
          <div className="font-semibold mb-2">급여</div>
          <div className="text-sm text-gray-600">곧 제공 예정</div>
        </button>
      </div>
    </div>
  );
}
