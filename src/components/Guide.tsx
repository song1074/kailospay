export default function Guide() {
  return (
    <section id="guide" className="section-y bg-slate-50">
      <div className="container-x">
        <div className="rounded-2xl border bg-white p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">이용 안내</h2>
          <p className="text-slate-600 mt-3">
            신청 방법, 결제 방식, 정산 프로세스 등 자세한 정보를 확인하세요.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="#cs" className="btn-primary">상담 문의</a>
            <a href="#benefit" className="btn-outline">혜택 보기</a>
          </div>
        </div>
      </div>
    </section>
  );
}
