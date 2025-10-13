// src/pages/Login.tsx
import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await login(email, password);

      const params = new URLSearchParams(location.search);
      const stateNext = (location.state as { next?: string } | null)?.next;
      const qsNext = params.get("next") ?? undefined;
      const next = stateNext || qsNext || "/";

      navigate(next, { replace: true });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x max-w-md mx-auto py-16">
      <h2 className="text-2xl font-bold mb-6">로그인</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
        >
          {busy ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        계정이 없으신가요?{" "}
        <Link to="/signup" className="text-indigo-600 underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
