export default function Benefits() {
  const items = [
    { title: "낮은 수수료",  desc: "업계 최저 3.7%대 수수료", icon: "💸" },
    { title: "간편 결제",    desc: "월세/관리비 카드 결제 지원", icon: "💳" },
    { title: "자동 납부",    desc: "납부일 자동 송금으로 연체 방지", icon: "⏱️" },
    { title: "포인트/무이자", desc: "무이자 할부, 포인트 적립", icon: "🎁" },
  ];

  return (
    <section id="benefit" className="section-y bg-gray-50">
      <div className="container-x">
        <h2 className="text-2xl md:text-3xl font-bold">카이로스페이 혜택</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mt-8">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border bg-white p-6 hover:shadow-md transition">
              <div className="h-12 w-12 rounded-xl bg-brand.soft flex items-center justify-center text-xl">{it.icon}</div>
              <h3 className="font-semibold mt-4">{it.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
