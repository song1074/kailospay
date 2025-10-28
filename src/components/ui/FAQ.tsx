import React, { useState } from "react";

type Item = { q: string; a: string };

const F: React.FC<Item> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? "open" : ""}`}>
      <button className="faq-q" onClick={() => setOpen(!open)}>
        {q} <span>{open ? "−" : "+"}</span>
      </button>
      <div className="faq-a">{a}</div>
    </div>
  );
};

const FAQ: React.FC = () => {
  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="section-head">
          <div className="h1">자주 묻는 질문</div>
          <p className="lead">궁금하신 점을 빠르게 확인해보세요</p>
        </div>

        <div className="faq">
          <F q="카이로스페이는 어떤 서비스인가요?" a="계약·송금·정산을 하나의 워크플로우로 묶어 자동화해주는 B2B 정산 플랫폼입니다." />
          <F q="수수료는 어떻게 되나요?" a="테스트 모드는 무료이며, 실운영 전환 시 거래 단가/규모에 따라 맞춤 요금제를 적용합니다." />
          <F q="정산 주기 설정이 가능한가요?" a="네, 매일/주별/월별 등 주기를 지정할 수 있으며 부분 정산도 지원합니다." />
        </div>
      </div>
    </section>
  );
};

export default FAQ;
