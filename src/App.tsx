// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

import Pay from "./pages/Pay";
import PaySuccess from "./pages/PaySuccess";
import PayFail from "./pages/PayFail";

import { AdminRoute } from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";

import MyPage from "./pages/MyPage";
import AdminUploads from "./pages/AdminUploads";

import RentIntro from "./pages/RentIntro";
import ReverifyID from "./pages/ReverifyID";

// 계약 등록 2단계
import ContractStart from "./pages/ContractStart";          // 1단계
import ContractTransfer from "./pages/ContractTransfer";    // 2단계

// 관리자 레이아웃 & 페이지
import AdminLayout from "./components/admin/AdminLayout";
import AdminUsers from "./pages/admin/Users";
import AdminCompany from "./pages/admin/Company";
import AdminPaymentRequests from "./pages/admin/PaymentRequests";

// 게시판 관리 실제 구현 페이지
import QnaCategories from "./pages/admin/QnaCategories";
import AdminFaq from "./pages/admin/Faq";
import AdminGuides from "./pages/admin/Guides";
import AdminNotices from "./pages/admin/Notices";
import ServiceCategories from "./pages/admin/ServiceCategories";

// --- 간단 플레이스홀더 (다른 준비중 메뉴용) ---
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-[40vh] flex flex-col items-start gap-2">
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="text-gray-500">이 페이지는 준비 중입니다.</p>
  </div>
);

export default function App() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <Routes>
          {/* 기본 */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* 임대료/월세 랜딩 (공개) */}
          <Route path="/registration" element={<RentIntro />} />

          {/* 보호 라우트 예시 */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />

          {/* 결제 */}
          <Route path="/pay" element={<Pay />} />
          <Route path="/pay/success" element={<PaySuccess />} />
          <Route path="/pay/fail" element={<PayFail />} />

          {/* 계약 등록 2단계 */}
          <Route
            path="/contracts/new"
            element={
              <ProtectedRoute>
                <ContractStart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:id/transfer"
            element={
              <ProtectedRoute>
                <ContractTransfer />
              </ProtectedRoute>
            }
          />
          {/* 과거 /contracts/:id 접근 → 2단계로 렌더 */}
          <Route
            path="/contracts/:id"
            element={
              <ProtectedRoute>
                <ContractTransfer />
              </ProtectedRoute>
            }
          />

          {/* 신분증 재인증 전용 */}
          <Route
            path="/ekyc/reverify"
            element={
              <ProtectedRoute>
                <ReverifyID />
              </ProtectedRoute>
            }
          />

          {/* 관리자 영역 */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="users" replace />} />

            {/* 구현된 페이지 */}
            <Route path="users" element={<AdminUsers />} />
            <Route path="uploads" element={<AdminUploads />} />
            <Route path="company" element={<AdminCompany />} />
            <Route path="payment-requests" element={<AdminPaymentRequests />} />

            {/* 게시판 관리 (실제 구현) */}
            <Route path="boards/qna-categories" element={<QnaCategories />} />
            <Route path="boards/faq" element={<AdminFaq />} />
            <Route path="boards/guides" element={<AdminGuides />} />
            <Route path="boards/notices" element={<AdminNotices />} />
            

            {/* 나머지 준비중 메뉴들 */}
            <Route path="merchants" element={<Placeholder title="가맹점" />} />
            <Route path="alerts" element={<Placeholder title="일반 알람" />} />
           <Route path="settings/service-categories" element={<ServiceCategories />} />
            <Route
              path="settings/payments"
              element={<Placeholder title="결제 관리" />}
            />
            <Route path="settings/main" element={<Placeholder title="메인 관리" />} />
            <Route
              path="settings/privacy"
              element={<Placeholder title="개인정보처리방침 관리" />}
            />
            <Route
              path="settings/terms"
              element={<Placeholder title="이용약관 관리" />}
            />
          </Route>

          {/* 레거시 경로 리다이렉트 */}
          <Route path="/docs" element={<Navigate to="/contracts/new" replace />} />
          <Route path="/docs/upload" element={<Navigate to="/contracts/new" replace />} />
          <Route path="/uploads" element={<Navigate to="/contracts/new" replace />} />
          <Route
            path="/pay/rent"
            element={<Navigate to="/registration?selected=임대료/월세" replace />}
          />
          <Route
            path="/contract/add-contract"
            element={<Navigate to="/contracts/new" replace />}
          />

          {/* 기타 → 홈 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
