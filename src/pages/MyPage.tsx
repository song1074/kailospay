// src/pages/MyPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

type Profile = {
  id: number;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  marketing_opt_in?: boolean;
  ekyc_status?: string | null;
  account_status?: string | null;
};

type Veris = {
  verified_for_payment: boolean;
  ekyc: string;
  account: string;
  document: boolean;
};

// 로컬(5174 등) 개발 시 원격 API 사용, 배포에선 동일 오리진
const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "https://kailospay.cafe24.com"
    : "";
const api = (p: string) => `${API_BASE}${p}`;

export default function MyPage() {
  const nav = useNavigate();

  const [me, setMe] = useState<Profile | null>(null);
  const [veri, setVeri] = useState<Veris | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem("token") || "";
  const authHeaders = useMemo((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  async function fetchAll() {
    const [pRes, vRes] = await Promise.all([
      fetch(api("/api/me/profile"), { headers: authHeaders }),
      fetch(api("/api/verifications/me"), { headers: authHeaders }),
    ]);
    if (pRes.status === 401 || vRes.status === 401) {
      nav("/login");
      return;
    }
    const p = await pRes.json();
    const v = await vRes.json();
    setMe(p?.user ?? null);
    setVeri({
      verified_for_payment: Boolean(v?.verified_for_payment),
      ekyc: String(v?.ekyc ?? "unverified"),
      account: String(v?.account ?? "unverified"),
      document: Boolean(v?.document),
    });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) {
          nav("/login");
          return;
        }
        await fetchAll();
      } catch (e) {
        console.error(e);
        alert("프로필 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, nav, token]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    try {
      const body = {
        full_name: me.full_name ?? null,
        phone: me.phone ?? null,
        marketing_opt_in: Boolean(me.marketing_opt_in),
      };
      const r = await fetch(api("/api/me/profile"), {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) return nav("/login");
      if (!r.ok) throw new Error("저장 실패");
      alert("저장되었습니다.");
    } catch (e: any) {
      alert(e?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(f: File) {
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", f);
      const r = await fetch(api("/api/me/avatar"), {
        method: "POST",
        headers: authHeaders, // FormData는 Content-Type 자동 설정
        body: fd,
      });
      if (r.status === 401) return nav("/login");
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "업로드 실패");
      const filename = (j.url as string).split("/").pop();
      setMe((m) => (m ? { ...m, avatar: filename ?? null } : m));
    } catch (e: any) {
      alert(e?.message || "프로필 사진 업로드 실패");
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const avatarUrl = me?.avatar
    ? `${API_BASE}/uploads/avatars/${me.avatar}`
    : "/default-avatar.png";
  const verified = Boolean(veri?.verified_for_payment);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="animate-pulse h-24 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <img
            src={avatarUrl}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
            }}
            className="w-16 h-16 rounded-full object-cover border"
            alt="avatar"
          />
          {!verified && (
            <span
              title="인증 필요"
              className="absolute -right-1 -bottom-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs"
            >
              !
            </span>
          )}
        </div>

        <div>
          <div className="text-xl font-bold">마이페이지</div>
          <div className="text-sm text-gray-600">{me?.email}</div>
        </div>

        <div className="ml-auto">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
            }}
          />
          <button
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 border disabled:opacity-60"
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
          >
            {avatarUploading ? "업로드 중..." : "프로필 사진 변경"}
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-sm text-gray-500 mb-1">신분증 인증</div>
          <div className="font-semibold">{veri?.ekyc ?? "-"}</div>
        </div>
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-sm text-gray-500 mb-1">1원 계좌 인증</div>
          <div className="font-semibold">{veri?.account ?? "-"}</div>
        </div>
        <div className="p-4 rounded-2xl border bg-white">
          <div className="text-sm text-gray-500 mb-1">서류 승인여부</div>
          <div className="font-semibold">{veri?.document ? "승인됨" : "미승인"}</div>
        </div>
      </section>

      {!verified && (
        <div className="p-4 rounded-2xl border bg-amber-50 text-amber-800">
          결제를 위해 인증이 필요합니다. 가입 시 제출한 자료가 검토 중일 수 있어요.
        </div>
      )}

      <form onSubmit={saveProfile} className="p-4 rounded-2xl border bg-white space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">이름</label>
            <input
              value={me?.full_name ?? ""}
              onChange={(e) =>
                setMe((m) => (m ? { ...m, full_name: e.target.value } : m))
              }
              className="w-full border rounded px-3 py-2"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">전화번호</label>
            <input
              value={me?.phone ?? ""}
              onChange={(e) =>
                setMe((m) => (m ? { ...m, phone: e.target.value } : m))
              }
              className="w-full border rounded px-3 py-2"
              placeholder="01012345678"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(me?.marketing_opt_in)}
            onChange={(e) =>
              setMe((m) => (m ? { ...m, marketing_opt_in: e.target.checked } : m))
            }
          />
          <span className="text-sm">마케팅/이벤트 정보 수신 동의</span>
        </label>

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-70"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <Link to="/docs/upload" className="px-4 py-2 rounded border">
            내 서류 보기
          </Link>
        </div>
      </form>
    </div>
  );
}
