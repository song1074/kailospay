import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

// 파일 위치: src/assets/kailospay/logo-blue.png
import logoBlue from "../assets/kailospay/logo-blue.png";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* 브랜드 */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="KailosPay 홈">
          <img
            src={logoBlue}
            alt="KailosPay"
            className="h-8 sm:h-9 md:h-10 w-auto select-none pointer-events-none"
            draggable={false}
          />
          <span className="sr-only">KailosPay</span>
        </Link>

        {/* 네비게이션 */}
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/contracts/new" className="hover:underline">
            계약 등록
          </Link>
          <Link to="/pay" className="hover:underline">
            결제하러 가기
          </Link>

          {user?.is_admin && (
            <Link className="px-3 py-2 hover:underline" to="/admin/uploads">
              관리자
            </Link>
          )}

          {user ? (
            <>
              <Link
                to="/my"
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                title="마이페이지로 이동"
                aria-label="마이페이지로 이동"
              >
                {user.name}님
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded bg-gray-900 text-white hover:opacity-90"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link className="px-3 py-2 rounded border" to="/login">
                로그인
              </Link>
              <Link className="px-3 py-2 rounded bg-blue-600 text-white" to="/signup">
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
