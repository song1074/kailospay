import { Link } from "react-router-dom";
// 파일 위치: src/assets/kailospay/hero-coin.png
import heroCoin from "../assets/kailospay/hero-coin.png";

export default function Hero() {
  return (
    <section className="relative pt-24 pb-20 overflow-hidden">
      {/* BG */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(72,184,255,0.14), transparent 60%), radial-gradient(900px 420px at 80% 10%, rgba(245,197,66,0.12), transparent 60%), #0b1220",
        }}
      />
      {/* subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4">
        {/* 상단 아이콘/이미지 */}
        <div className="w-full flex justify-center mb-6">
          <img
            src={heroCoin}
            alt=""
            aria-hidden
            className="h-12 sm:h-14 md:h-16 w-auto select-none pointer-events-none drop-shadow"
            draggable={false}
          />
        </div>

        <div className="text-center">
          <h1 className="text-[28px] sm:text-5xl md:text-[52px] font-extrabold leading-tight tracking-tight text-white">
            현금거래의 카드결제가 필요할 땐
            <br />
            <span className="text-[#F5C542]">합법적으로 카드결제 하세요!</span>
          </h1>

          <p className="mt-4 text-slate-300/90 text-base sm:text-lg">
            현금서비스 · 대출 · 마이너스통장 대신 <span className="text-white font-semibold">카드로 결제</span>하세요.
            본인인증·전자서명·자동청구까지 한 번에.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login"
              className="px-5 py-3 rounded-xl bg-[#F5C542] text-[#121212] font-semibold w-full sm:w-auto text-center"
              aria-label="로그인"
            >
              로그인
            </Link>

            {/* 안내 랜딩으로 이동 (쿼리: type=rent) */}
            <Link
              to={{ pathname: "/registration", search: "?type=rent" }}
              className="px-5 py-3 rounded-xl border border-white/15 text-white/95 hover:bg-white/5 transition w-full sm:w-auto text-center"
              aria-label="계약 등록"
            >
              계약 등록
            </Link>

            <Link
              to="/pay"
              className="px-5 py-3 rounded-xl bg-[#2ecc71] text-white font-semibold w-full sm:w-auto text-center"
              aria-label="결제하러 가기"
            >
              결제하러 가기
            </Link>
          </div>

          {/* 하단 신뢰 배지/라벨 */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300/80">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
              전자계약 · 본인인증 · 자동청구
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
              카카오 알림톡 고지
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
              결제 연동(가상계좌/계좌이체/카드)
            </span>
          </div>
        </div>
      </div>

      {/* hero 장식 이미지 (우측) */}
      <div className="pointer-events-none absolute -right-10 bottom-[-36px] hidden md:block">
        <img
          src={heroCoin}
          alt=""
          aria-hidden
          className="w-[180px] opacity-80 blur-[0.2px] rotate-12"
          draggable={false}
        />
      </div>
    </section>
  );
}
