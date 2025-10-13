export default function Footer() {
  return (
    <footer className="section-y border-t">
      <div className="container-x text-xs leading-6 text-slate-500">
        <div className="flex items-center gap-2">
          <img src="/kailospay/logo.svg" className="h-5" alt="KailosPay" />
          <span className="font-semibold text-slate-700">KailosPay</span>
        </div>

        <p className="mt-4">
          회사명 <strong>카이로스페이</strong> | 대표자 <strong>강대부</strong> |
          사업자등록번호 <strong>518-88-03068</strong> | 통신판매업신고번호 <strong>2024-전북익산-0474</strong>
        </p>
        <p>
          주소 <strong>전북특별자치도 익산시 동천로7길 72, 카이로스빌딩 3층</strong>
        </p>
        <p>
          고객센터 <a className="underline" href="tel:18997179">1899-7179</a> (연중무휴 09:00–24:00) |
          이메일 <a className="underline" href="mailto:kailospay@gmail.com">kailospay@gmail.com</a>
        </p>

        <div className="mt-2 flex gap-4">
          <a href="/terms" className="underline">서비스 이용약관</a>
          <a href="/information" className="underline">개인정보처리방침</a>
        </div>

        <p className="mt-6 text-[10px] text-slate-400">© KailosPay. All rights reserved.</p>
      </div>
    </footer>
  );
}
