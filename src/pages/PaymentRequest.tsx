import { useNavigate, Link } from "react-router-dom";

type Card = {
  key: "rent" | "goods" | "salary";
  title: string;
  emoji: string;
  desc: string;
  to: string; // 이동 경로
};

const CARDS: Card[] = [
  {
    key: "rent",
    title: "임대료/월세",
    emoji: "🏠",
    desc: "월세/보증금 등 임대 관련 결제",
    to: "/registration?type=rent",
  },
  {
    key: "goods",
    title: "물품대금",
    emoji: "📦",
    desc: "전자세금계산서 기반 물품 대금 결제",
    to: "/registration?type=goods",
  },
  {
    key: "salary",
    title: "급여",
    emoji: "💼",
    desc: "급여/인건비 카드 결제",
    to: "/registration?type=salary",
  },
];

export default function PaymentRequest() {
  const nav = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <header className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold">무료로 시작하기</h1>
        <p className="mt-3 text-gray-600">
          어떤 결제를 진행하시겠어요? 유형을 선택하면 안내 페이지로 이동합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => nav(c.to)}
            className="group rounded-2xl border bg-white p-6 text-left hover:shadow-md transition"
            aria-label={`${c.title} 시작`}
          >
            <div className="w-16 h-16 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-3xl">
              {c.emoji}
            </div>
            <div className="mt-4">
              <div className="font-semibold text-lg">{c.title}</div>
              <div className="mt-1 text-sm text-gray-500">{c.desc}</div>
            </div>
            <div className="mt-6">
              <span className="inline-flex px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
                바로 시작하기
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 text-center text-sm text-gray-500">
        이미 진행 중인 계약이 있나요?{" "}
        <Link to="/contracts" className="text-indigo-600 underline">
          내 계약 보기
        </Link>
      </div>
    </div>
  );
}
