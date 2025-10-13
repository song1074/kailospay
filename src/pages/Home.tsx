// src/pages/Home.tsx
import { useNavigate } from "react-router-dom";
import Hero from "../components/Hero";

export default function Home() {
  const navigate = useNavigate();
  const goRentIntro = () => navigate("/registration?type=rent");
  const goGoodsIntro = () => navigate("/registration?type=goods");
  const goSalaryIntro = () => navigate("/registration?type=salary");

  return (
    <>
      <Hero />

      <section className="max-w-6xl mx-auto px-4 mt-10">
        <h3 className="text-lg font-bold mb-4">어떤 결제가 필요하세요?</h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {/* 임대료/월세 */}
          <button
            onClick={goRentIntro}
            className="group rounded-2xl border bg-white p-5 flex flex-col items-center hover:shadow-md transition cursor-pointer"
            aria-label="임대료/월세 안내 페이지로 이동"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-2xl">
              🏠
            </div>
            <div className="mt-3 font-semibold">임대료/월세</div>
            <div className="mt-1 text-xs text-gray-500 text-center">안내 페이지 → 계약 등록</div>
          </button>

          {/* 물품대금 */}
          <button
            onClick={goGoodsIntro}
            className="group rounded-2xl border bg-white p-5 flex flex-col items-center hover:shadow-md transition cursor-pointer"
            aria-label="물품대금 안내 페이지로 이동"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-2xl">
              📦
            </div>
            <div className="mt-3 font-semibold">물품대금</div>
            <div className="mt-1 text-xs text-gray-500 text-center">안내 페이지 → 계약 등록</div>
          </button>

          {/* ✅ 급여 */}
          <button
            onClick={goSalaryIntro}
            className="group rounded-2xl border bg-white p-5 flex flex-col items-center hover:shadow-md transition cursor-pointer"
            aria-label="급여 안내 페이지로 이동"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-2xl">
              💼
            </div>
            <div className="mt-3 font-semibold">급여</div>
            <div className="mt-1 text-xs text-gray-500 text-center">안내 페이지 → 계약 등록</div>
          </button>
        </div>
      </section>
    </>
  );
}
