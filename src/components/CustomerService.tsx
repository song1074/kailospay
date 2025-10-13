// src/components/CustomerService.tsx
export default function CustomerService() {
  return (
    <section id="cs" className="section-y">
      <div className="container-x grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800">고객센터</h2>
          <p className="text-slate-600 mt-2">문의전화 1899-7179 / 연중무휴 09:00–24:00</p>
          <div className="mt-6 flex gap-3">
            <a className="btn-primary" href="tel:18997179">전화 문의</a>
            <a className="btn-outline" href="mailto:kailospay@gmail.com">이메일 문의</a>
          </div>
        </div>

        <div className="relative aspect-[4/3] rounded-2xl bg-slate-100 border overflow-hidden">
          <img
            src="/kailospay/phone-mock.png"
            alt="KailosPay 앱 미리보기"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.currentTarget.style.display = 'none'); }}
          />
        </div>
      </div>
    </section>
  );
}
