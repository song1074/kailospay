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

      {/* 안내 섹션 헤드 */}
      <section className="relative py-10" style={{ background: "#0b1220" }}>
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-lg md:text-xl font-bold text-white">어떤 결제가 필요하세요?</h3>
          <p className="mt-2 text-slate-300/85 text-sm">
            상황에 맞는 유형을 선택하면 안내 페이지로 이동한 뒤, 바로 계약 등록까지 이어집니다.
          </p>

          {/* 카테고리 카드 (RT RentalPay 느낌: 명확한 아이콘/라운드 카드/호버 엘리베이션) */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* 임대료/월세 */}
            <button
              onClick={goRentIntro}
              className="group rounded-2xl border border-white/10 bg-[#121a2b] hover:bg-[#131f35] hover:border-[#F5C542]/40 transition p-5 flex flex-col items-center text-white focus:outline-none focus:ring-2 focus:ring-[#F5C542]/50"
              aria-label="임대료/월세 안내 페이지로 이동"
            >
              <div className="w-14 h-14 rounded-full bg-[#142038] group-hover:bg-[#182643] flex items-center justify-center text-2xl">
                🏠
              </div>
              <div className="mt-3 font-semibold">임대료/월세</div>
              <div className="mt-1 text-xs text-slate-300/80 text-center">안내 페이지 → 계약 등록</div>
            </button>

            {/* 물품대금 */}
            <button
              onClick={goGoodsIntro}
              className="group rounded-2xl border border-white/10 bg-[#121a2b] hover:bg-[#131f35] hover:border-[#F5C542]/40 transition p-5 flex flex-col items-center text-white focus:outline-none focus:ring-2 focus:ring-[#F5C542]/50"
              aria-label="물품대금 안내 페이지로 이동"
            >
              <div className="w-14 h-14 rounded-full bg-[#142038] group-hover:bg-[#182643] flex items-center justify-center text-2xl">
                📦
              </div>
              <div className="mt-3 font-semibold">물품대금</div>
              <div className="mt-1 text-xs text-slate-300/80 text-center">안내 페이지 → 계약 등록</div>
            </button>

            {/* 급여 */}
            <button
              onClick={goSalaryIntro}
              className="group rounded-2xl border border-white/10 bg-[#121a2b] hover:bg-[#131f35] hover:border-[#F5C542]/40 transition p-5 flex flex-col items-center text-white focus:outline-none focus:ring-2 focus:ring-[#F5C542]/50"
              aria-label="급여 안내 페이지로 이동"
            >
              <div className="w-14 h-14 rounded-full bg-[#142038] group-hover:bg-[#182643] flex items-center justify-center text-2xl">
                💼
              </div>
              <div className="mt-3 font-semibold">급여</div>
              <div className="mt-1 text-xs text-slate-300/80 text-center">안내 페이지 → 계약 등록</div>
            </button>

            {/* 여유 슬롯 – 필요 시 다른 유형 추가 */}
            <div className="rounded-2xl border border-dashed border-white/10 p-5 flex items-center justify-center text-slate-400 text-sm">
              곧 더 많은 유형이 추가됩니다
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 3열 – kailospay.com 톤(골드 포인트) */}
      <section className="py-14" style={{ background: "#0b1220" }}>
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-xl md:text-2xl font-bold text-white">핵심 기능</h3>
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              {
                title: "전자계약 & 본인인증",
                desc: "신분증 촬영/검증, 휴대폰 인증, 전자서명까지 한 번에.",
                icon: "🪪",
              },
              {
                title: "청구/수납 자동화",
                desc: "정기/일회 청구, 카드·계좌이체·가상계좌 등 결제 연동.",
                icon: "⚙️",
              },
              {
                title: "카카오 알림톡 고지",
                desc: "승인/요청/연체 알림 자동 전송, 발송 로그 관리.",
                icon: "💬",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 border border-white/10 bg-[#121a2b] text-white hover:border-[#F5C542]/40 hover:-translate-y-0.5 transition"
              >
                <div className="text-2xl">{f.icon}</div>
                <div className="mt-2 font-semibold">{f.title}</div>
                <div className="mt-1 text-sm text-slate-300/85">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격/CTA – 골드 강조 */}
      <section className="py-14" style={{ background: "#0b1220" }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="rounded-3xl p-8 md:p-10 border border-white/10 bg-[#121a2b] text-center">
            <p className="text-slate-300/85 text-sm">간단히 시작</p>
            <h4 className="text-2xl md:text-3xl font-bold text-white mt-1">
              월 기본료 0원, 사용한 만큼만
            </h4>
            <p className="mt-2 text-sm text-slate-300/85">
              전자계약 · 본인인증 · 알림톡/문자 · 결제 연동 옵션 제공
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/signup")}
                className="px-6 py-3 rounded-xl font-semibold text-sm bg-[#F5C542] text-[#121212]"
              >
                무료 가입
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="px-6 py-3 rounded-xl text-sm border border-white/15 text-white hover:bg-white/5 transition"
              >
                도입 상담
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
