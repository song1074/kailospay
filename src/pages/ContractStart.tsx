// src/pages/ContractStart.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authFetch } from "../lib/auth";
import RegistryIssueBox from "../components/ui/RegistryIssueBox";
import AddressSearch from "../components/ui/AddressSearch";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type MeProfile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  // 보정용: /api/me 에서만 내려옴
  name?: string;
};

type EkycStatus = "verified" | "unverified" | "pending" | "rejected";

export default function ContractStart() {
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();

  const editingId = params.id ? Number(params.id) : null; // (미사용이지만 유지)
  const categoryFromQuery = sp.get("category") || "rent";

  // 폼 상태
  const [service, setService] = useState(categoryFromQuery);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // 주소
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [zonecode, setZonecode] = useState("");

  // 첨부(즉시 업로드)
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // eKYC
  const [ekyc, setEkyc] = useState<EkycStatus>("unverified");

  // 진입 시 프로필/ekyc 로드
  useEffect(() => {
    (async () => {
      try {
        // 1) 프로필
        const r1 = await authFetch(`${API_BASE}/api/me/profile`, { method: "GET" });
        const j1 = await r1.json().catch(() => null);

        let profile: MeProfile | null = null;
        if (r1.ok && j1?.ok && j1?.user) {
          profile = j1.user as MeProfile;
        }

        // full_name이 비어있으면 /api/me에서 가입 시 이름(name) 보정
        if (!profile?.full_name) {
          const rName = await authFetch(`${API_BASE}/api/me`, { method: "GET" });
          const jName = await rName.json().catch(() => null);
          if (rName.ok && jName?.ok && jName?.user) {
            profile = { ...(profile || j1.user), name: jName.user.name };
          }
        }

        if (profile) {
          setMe(profile);
          setFullName(profile.full_name || profile.name || "");
          setPhone(profile.phone || "");
        }

        // 2) eKYC 상태 (/api/ekyc/status 가 아니라 /api/verifications/me 사용)
        const r2 = await authFetch(`${API_BASE}/api/verifications/me`, { method: "GET" });
        const j2 = await r2.json().catch(() => null);
        if (r2.ok && j2?.ok && j2?.ekyc) {
          setEkyc(j2.ekyc as EkycStatus);
        }
      } catch {
        // authFetch가 401 처리하므로 무시
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 신청인 정보 저장
  async function onSaveApplicant() {
    const phoneNorm = phone ? String(phone).replace(/[-\s]/g, "") : "";
    if (phoneNorm && !/^\+?\d{9,15}$/.test(phoneNorm)) {
      alert("연락처 형식을 확인하세요.");
      return;
    }
    try {
      const r = await authFetch(`${API_BASE}/api/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName || null,
          phone: phoneNorm || null,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.message || "저장 실패");
      alert("신청인 정보가 저장되었습니다.");
    } catch (e: any) {
      if (e?.message !== "AUTH") alert(e?.message || "저장 실패");
    }
  }

  // 첨부 업로드(즉시)
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function onUpload() {
    if (!files.length) return alert("업로드할 파일을 선택하세요.");
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const r = await authFetch(`${API_BASE}/api/rent/docs`, {
        method: "POST",
        body: fd,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.message || "업로드 실패");

      const count =
        (Array.isArray(j?.items) && j.items.length) ||
        (Array.isArray(j?.files) && j.files.length) ||
        0;

      setFiles([]);
      alert(`첨부 ${count}건 업로드 완료`);
    } catch (e: any) {
      if (e?.message !== "AUTH") alert(e?.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  // 이동 경로 (2단계)
  const nextPath = useMemo(() => {
    return `/contracts/new/transfer?category=${encodeURIComponent(service)}`;
  }, [service]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold mb-6">계약등록 – 기본정보</h1>

      {/* 서비스 선택 */}
      <section className="mb-6">
        <label className="block text-sm text-gray-600 mb-2">결제하실 서비스를 선택해주세요 *</label>
        <div className="border rounded-lg p-3">
          <select
            className="w-full border rounded px-3 py-2"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="rent">임대료/월세</option>
            <option value="deposit">보증금</option>
            <option value="etc">기타</option>
          </select>
        </div>
      </section>

      {/* 신청인 */}
      <section className="mb-6">
        <div className="text-lg font-semibold mb-2">신청인 본인이 맞으신가요? *</div>
        <div className="text-xs text-gray-500 mb-2">신청인 본인이 아닐 경우 변경하여 입력하세요.</div>
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-gray-600 mb-1">성함</div>
              <input
                className="w-full border rounded px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="예) 홍길동"
                autoComplete="name"
              />
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">연락처</div>
              <input
                className="w-full border rounded px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                inputMode="tel"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onSaveApplicant}
            className="inline-flex px-3 py-2 rounded bg-gray-800 text-white"
          >
            신청인 정보 저장
          </button>
        </div>
      </section>

      {/* 첨부(즉시 업로드) */}
      <section className="mb-6">
        <div className="text-lg font-semibold mb-2">첨부 서류 (즉시 업로드 가능)</div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={onPickFiles}
              className="block"
            />
            <button
              onClick={onUpload}
              disabled={!files.length || uploading}
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {uploading ? "업로드 중..." : "첨부 업로드"}
            </button>
          </div>
          {!!files.length && (
            <div className="text-xs text-gray-600 mt-2">선택된 파일 {files.length}개</div>
          )}
        </div>
      </section>

      {/* 주소 */}
      <section className="mb-6">
        <div className="text-lg font-semibold mb-2">등기부등본 발급용 주소</div>
        <div className="text-xs text-gray-500 mb-3">아파트는 동/호수까지 입력해주세요.</div>
        <div className="border rounded-lg p-3 space-y-3">
          {/* AddressSearch 컴포넌트는 value 표시 + 선택 시 (주소, 우편번호) 반환 */}
          <AddressSearch
            value={addr1}
            onSelect={(a1: string, zc?: string) => {
              setAddr1(a1);
              setZonecode(zc || "");
            }}
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="상세주소(동/호수 등)"
            value={addr2}
            onChange={(e) => setAddr2(e.target.value)}
          />
          {!!zonecode && <div className="text-xs text-gray-500">우편번호: {zonecode}</div>}
        </div>
      </section>

      {/* 등기부등본 발급 */}
      <section className="mb-8">
        <div className="text-lg font-semibold mb-2">등기부등본 발급</div>
        <div className="text-xs text-gray-500 mb-3">
          <b>주소로 발급</b>되며, 완료 시 PDF가 자동 다운로드됩니다.
        </div>
        <div className="border rounded-lg p-3">
          <RegistryIssueBox address1={addr1} address2={addr2} showAddressFields={false} />
        </div>
      </section>

      {/* 신분증 안내 + 버튼 */}
      <section className="mb-8">
        <div className="text-sm mb-2">
          <span className="font-medium">진행하려면 신분증 재인증이 필요합니다.</span>
        </div>
        <div className="text-sm">
          현재 상태:{" "}
          <b className={ekyc === "verified" ? "text-green-600" : "text-red-600"}>
            {ekyc === "verified" ? "인증완료" : "인증필요"}
          </b>
          <button
            type="button"
            onClick={() =>
              nav(
                `/ekyc/reverify?returnTo=${encodeURIComponent(
                  location.pathname + location.search
                )}&from=start`
              )
            }
            className="ml-2 inline-block px-3 py-1 rounded bg-gray-800 text-white"
          >
            신분증 재인증
          </button>
        </div>
      </section>

      {/* 하단 버튼 */}
      <section className="flex items-center justify-between">
        <button onClick={() => nav("/")} className="px-4 py-3 rounded bg-gray-200 text-gray-900">
          취소
        </button>
        <button
          disabled={ekyc !== "verified"}
          onClick={() => nav(nextPath)}
          className="px-5 py-3 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          다음
        </button>
      </section>
    </div>
  );
}
