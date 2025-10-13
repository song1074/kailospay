export default function Process() {
  const steps = [
    { title: "가맹/문의",  desc: "가맹 신청 또는 상담 문의" },
    { title: "계약/심사",  desc: "필요 서류 접수 및 검토" },
    { title: "결제 세팅",  desc: "월세/관리비 카드 결제 설정" },
    { title: "정산/보고",  desc: "정산 내역 제공 및 관리" },
  ];

  return (
    <section id="process" className="section-y">
      <div className="container-x">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800">이용 절차</h2>

        {/* 모바일: 세로 타임라인 / 데스크톱: 가로 타임라인 */}
        <div className="mt-10">
          {/* Desktop (가로) */}
          <div className="hidden md:grid grid-cols-4 gap-6 relative">
            {/* 가로 선 */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-200" />
            {steps.map((s, i) => (
              <div key={i} className="relative z-10">
                {/* 원형 번호 */}
                <div className="mx-auto h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold">
                  {i + 1}
                </div>
                <div className="mt-4 text-center">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile (세로) */}
          <div className="md:hidden relative">
            {/* 세로 선 */}
            <div className="absolute left-5 top-0 bottom-0 w-[2px] bg-slate-200" />
            <div className="space-y-6">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="mt-1 h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-slate-600 mt-1">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
