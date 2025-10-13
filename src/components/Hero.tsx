import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="py-16 bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
          현금거래의 카드결제가 필요할 땐
          <br />
          <span className="text-indigo-600">합법적으로 카드결제 하세요!</span>
        </h1>

        <p className="mt-4 text-gray-600">
          현금서비스, 대출, 마통 대신 카드로 결제하세요!
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login" className="px-4 py-2 rounded bg-indigo-600 text-white">
            로그인
          </Link>

          {/* 안내 랜딩으로 이동 (쿼리: type=rent) */}
          <Link
            to={{ pathname: "/registration", search: "?type=rent" }}
            className="px-4 py-2 rounded border"
          >
            계약 등록
          </Link>

          <Link to="/pay" className="px-4 py-2 rounded bg-green-600 text-white">
            결제하러 가기
          </Link>
        </div>
      </div>
    </section>
  );
}
