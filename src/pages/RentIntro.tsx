// src/pages/RentIntro.tsx
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

type PayType = "rent" | "goods" | "salary";

const LABEL_BY_TYPE: Record<PayType, string> = {
  rent: "임대료/월세",
  goods: "물품대금",
  salary: "급여",
};

const DESC_BY_TYPE: Record<PayType, string> = {
  rent:
    "보유하신 신용카드로 임대료/월세를 결제하면 현금으로 건물주에 송금됩니다. 무이자/분할 납부 및 포인트 적립까지 한 번에 해결하세요.",
  goods:
    "보유하신 신용카드로 물품대금을 결제하고 현금은 공급처에 송금됩니다. 세금계산서/거래명세 등 증빙도 안전하게 처리하세요.",
  salary:
    "보유하신 신용카드로 급여를 결제하고 현금은 직원에게 송금됩니다. 급여명세/원천징수 등 증빙도 안전하게 처리하세요.",
};

function resolveTypeAndLabel(params: URLSearchParams): { type: PayType; label: string; desc: string } {
  const raw = (params.get("type") || "").toLowerCase();
  if (raw === "goods" || raw === "salary" || raw === "rent") {
    const t = raw as PayType;
    return { type: t, label: LABEL_BY_TYPE[t], desc: DESC_BY_TYPE[t] };
  }
  // 하위호환(selected=…)
  const selected = decodeURIComponent(params.get("selected") || "").toLowerCase();
  if (selected.includes("물품")) return { type: "goods", label: LABEL_BY_TYPE.goods, desc: DESC_BY_TYPE.goods };
  if (selected.includes("급여")) return { type: "salary", label: LABEL_BY_TYPE.salary, desc: DESC_BY_TYPE.salary };
  return { type: "rent", label: LABEL_BY_TYPE.rent, desc: DESC_BY_TYPE.rent };
}

export default function RentIntro() {
  const [params] = useSearchParams();
  const { type, label, desc } = resolveTypeAndLabel(params);
  const { user } = useAuth();

  const nextUrl = `/contracts/new?category=${type}`; // rent | goods | salary

  return (
    <div className="min-h-[70vh]">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold">{label} 카드 결제</h1>
          <p className="mt-4 text-gray-500">{desc}</p>
        </header>

        <div className="flex justify-center my-10">
          <div className="relative w-[320px] h-[200px] -rotate-6 shadow-xl rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-white p-5">
            <div className="text-xl font-extrabold">카이로스페이</div>
            <div className="text-xs opacity-80 mt-1">KAILOS pay</div>
            <div className="absolute bottom-5 left-5 space-y-1">
              <div className="tracking-widest text-lg font-bold">1899 7179</div>
              <div className="text-[10px] opacity-80">Card Holder Name</div>
              <div className="text-[10px] opacity-80">Expired 77/77</div>
            </div>
          </div>
        </div>

        <div className="text-center">
          {user ? (
            <Link
              to={nextUrl}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-md hover:shadow-lg bg-indigo-600 text-white"
            >
              3.7% 최저수수료로 지금 시작하기
            </Link>
          ) : (
            <Link
              to={{ pathname: "/login", search: `?next=${encodeURIComponent(nextUrl)}` }}
              state={{ next: nextUrl }}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-md hover:shadow-lg bg-indigo-600 text-white"
            >
              로그인하고 시작하기
            </Link>
          )}

          <div className="mt-3">
            <Link
              to="/guide/required-docs"
              className="text-xs text-gray-500 underline hover:text-gray-700"
            >
              {label} 카드결제 시 필요한 첨부서류 안내
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
