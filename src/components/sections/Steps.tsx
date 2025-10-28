import React from "react";

const Steps: React.FC = () => {
  return (
    <section id="steps" className="section bg">
      <div className="container">
        <div className="section-head">
          <div className="h1">3분이면 시작</div>
          <p className="lead">아래 순서대로 진행하면 바로 사용 가능합니다</p>
        </div>

        <div className="steps" style={{ display: "grid", gap: 16 }}>
          <div className="step">
            <div>
              <strong>회원가입</strong>
              <div className="lead">이메일/휴대폰 인증으로 간단하게 가입</div>
            </div>
          </div>
          <div className="step">
            <div>
              <strong>신원인증 · 계좌연결</strong>
              <div className="lead">eKYC와 계좌 연결로 송금 준비 완료</div>
            </div>
          </div>
          <div className="step">
            <div>
              <strong>정산시작</strong>
              <div className="lead">계약/청구서를 생성하고 자동정산을 켜세요</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Steps;
