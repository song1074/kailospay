// src/pages/Signup.tsx
import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

/** 같은 도메인이면 "" 유지. 다른 도메인이면 VITE_API_BASE 세팅 */
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function normalizePhone(v: string) {
  return v.replace(/[-\s]/g, "");
}
function isValidPhone(v: string) {
  const p = normalizePhone(v);
  return /^\+?\d{9,15}$/.test(p);
}

export default function Signup() {
  const nav = useNavigate();
  const { login } = useAuth();

  // Step1: 기본정보 + 신분증 이미지
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);
  const idFileRef = useRef<HTMLInputElement | null>(null);

  // Step2: 1원 인증
  const [userId, setUserId] = useState<number | null>(null);
  const [bankCode, setBankCode] = useState("004");
  const [accountNo, setAccountNo] = useState("");
  const [holderName, setHolderName] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [authCode, setAuthCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step1: 신분증 인증 + 회원 생성 (/api/signup)
  async function onSubmitId(e: FormEvent) {
    e.preventDefault();

    if (!agree) return alert("회원가입 정책에 동의해 주세요.");
    if (password.length < 6) return alert("비밀번호는 6자 이상이어야 합니다.");
    if (password !== password2) return alert("비밀번호가 일치하지 않습니다.");

    if (!isValidPhone(phone)) {
      return alert("연락처 형식이 올바르지 않습니다. 예) 01012345678 또는 +821012345678");
    }

    const file = idFileRef.current?.files?.[0];
    if (!file) return alert("신분증 이미지를 첨부해 주세요.");
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type || "")) {
      return alert("이미지(JPG/PNG/WEBP)만 업로드 가능합니다.");
    }
    if (file.size > 20 * 1024 * 1024) {
      return alert("파일 용량은 최대 20MB입니다.");
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("email", email.trim().toLowerCase());
      fd.append("password", password);
      fd.append("phone", normalizePhone(phone));
      fd.append("idcard", file); // 서버: multer.single("idcard")

      const resp = await fetch(`${API_BASE}/api/signup`, { method: "POST", body: fd });
      const j = await resp.json().catch(() => null);
      console.log("[signup(idcard)] resp:", resp.status, j);

      if (!resp.ok || !j?.ok || !j?.user?.id) {
        throw new Error(j?.message || `회원가입(신분증 인증) 실패 (${resp.status})`);
      }

      setUserId(j.user.id);
      // 예금주명 기본값을 이름으로 프리필
      setHolderName((v) => v || name.trim());
      localStorage.setItem("signupEmail", email.trim().toLowerCase());
      localStorage.setItem("signupPassword", password);

      setStep(2);
      alert("신분증 인증 성공! 1원 인증을 진행하세요.");
    } catch (err: any) {
      console.error("signup(idcard) 오류:", err);
      alert(err?.message || "회원가입 실패");
    } finally {
      setBusy(false);
    }
  }

  // Step2-1: 1원 인증 시작  ✅ /api/onboarding/start 사용
  async function onStartOneWon(e: FormEvent) {
    e.preventDefault();
    if (!userId) return alert("userId가 없습니다. 다시 시도해 주세요.");

    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/api/onboarding/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, bankCode, accountNo, holderName }),
      });
      const j = await resp.json().catch(() => null);
      console.log("[onboarding/start] resp:", resp.status, j);

      if (!resp.ok || !j?.ok) {
        const detail = j?.detail?.message || j?.message;
        throw new Error(detail || `1원 인증 시작 실패 (${resp.status})`);
      }

      setRequestId(j.requestId ?? j?.provider?.requestId ?? null);
      setStarted(true);
      alert("1원이 입금되었습니다. 입금 메모의 인증코드를 입력하세요.");
    } catch (err: any) {
      console.error("onboarding/start 오류:", err);
      alert(err?.message || "시작 실패");
    } finally {
      setBusy(false);
    }
  }

  // Step2-2: 인증 코드 확인  ✅ /api/onboarding/confirm 사용
  async function onConfirmOneWon(e: FormEvent) {
    e.preventDefault();
    if (!userId) return alert("userId가 없습니다.");

    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/api/onboarding/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, authCode: authCode.trim(), requestId }),
      });
      const j = await resp.json().catch(() => null);
      console.log("[onboarding/confirm] resp:", resp.status, j);

      if (!resp.ok || !j?.ok) {
        const detail = j?.detail?.message || j?.message;
        throw new Error(detail || `1원 인증 실패 (${resp.status})`);
      }

      // 자동 로그인
      const em = localStorage.getItem("signupEmail") || email.trim().toLowerCase();
      const pw = localStorage.getItem("signupPassword") || password;
      await login(String(em), String(pw));
      localStorage.removeItem("signupEmail");
      localStorage.removeItem("signupPassword");

      alert("회원가입 및 1원 인증 완료!");
      nav("/", { replace: true });
    } catch (err: any) {
      console.error("onboarding/confirm 오류:", err);
      alert(err?.message || "인증 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold">회원가입</h1>

      {step === 1 && (
        <form onSubmit={onSubmitId} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-gray-600">사용자 이름</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">이메일 주소(아이디)</span>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <span className="text-sm text-gray-600">비밀번호</span>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">비밀번호 확인</span>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                minLength={6}
                required
              />
              {password && password2 && password !== password2 && (
                <span className="text-xs text-red-600">비밀번호가 일치하지 않습니다.</span>
              )}
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-gray-600">연락처</span>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="예) 01012345678 또는 +821012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {phone && !isValidPhone(phone) && (
              <span className="text-xs text-red-600">형식을 확인해 주세요.</span>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">신분증 이미지(JPG/PNG/WEBP)</span>
            <input
              ref={idFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              반사/흔들림 없이 테두리가 모두 보이게 촬영해 주세요.
            </p>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              카이로스페이 <a className="underline" href="/tos" onClick={(e)=>e.preventDefault()}>이용약관</a> 및{" "}
              <a className="underline" href="/privacy" onClick={(e)=>e.preventDefault()}>개인 정보 보호 정책</a>에 동의합니다.
            </span>
          </label>

          <button
            type="submit"
            disabled={
              busy ||
              !agree ||
              !name.trim() ||
              !email.trim() ||
              !isValidPhone(phone) ||
              password.length < 6 ||
              password !== password2
            }
            className="w-full px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
          >
            {busy ? "처리 중..." : "신분증 인증 및 회원가입"}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-6">
          <div className="text-sm text-gray-700">
            userId: <b>{userId}</b>
            {requestId ? (
              <span className="ml-2 text-gray-500">requestId: {requestId}</span>
            ) : null}
          </div>

          <form onSubmit={onStartOneWon} className="space-y-4">
            <label className="block">
              <span className="text-sm text-gray-600">은행 코드</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">계좌번호</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">예금주명</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                required
              />
            </label>

            <button
              type="submit"
              disabled={busy || started}
              className="w-full px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
            >
              {busy ? "전송 중..." : started ? "전송 완료" : "1원 인증 시작"}
            </button>
          </form>

          <form onSubmit={onConfirmOneWon} className="space-y-4">
            <label className="block">
              <span className="text-sm text-gray-600">인증 코드</span>
              <input
                className="w-full border rounded px-3 py-2"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                required
              />
            </label>

            <button
              type="submit"
              disabled={busy || !started}
              className="w-full px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
            >
              {busy ? "확인 중..." : "인증 완료"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
