import React from "react";

const Features: React.FC = () => {
  return (
    <section id="features" className="section">
      <div className="container">
        <div className="section-head">
          <div className="h1">카이로스페이, 이렇게 다릅니다</div>
          <p className="lead">정산 자동화 · 간편 송금 · 계약 관리까지 한 번에</p>
        </div>

        <div className="grid-3">
          <div className="card">
            <div className="icon">💸</div>
            <h3>정산 자동화</h3>
            <p>반복되는 계산·정산 업무를 자동화하여 인력/시간을 절감합니다.</p>
          </div>
          <div className="card">
            <div className="icon">🔐</div>
            <h3>안전한 송금</h3>
            <p>은행권 연동과 이중 검증으로 안전하게 자금을 이체해요.</p>
          </div>
          <div className="card">
            <div className="icon">📑</div>
            <h3>계약/서류 관리</h3>
            <p>계약서, 영수증, 세금 관련 서류를 한 곳에서 깔끔하게.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
