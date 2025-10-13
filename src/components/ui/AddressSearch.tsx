// src/components/ui/AddressSearch.tsx
import { useEffect, useRef, useState } from "react";

type Props = {
  /** 선택된 주소를 표시(읽기전용) */
  value?: string;
  /** 주소 선택 시 콜백 (도로명주소, 우편번호) */
  onSelect: (address1: string, zonecode?: string) => void;
  placeholder?: string;
  /** 검색 패널 높이(px) */
  height?: number;
};

declare global {
  interface Window {
    daum?: any;
  }
}

export default function AddressSearch({
  value = "",
  onSelect,
  placeholder = "주소를 검색하세요.",
  height = 360,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // daum 우편번호 스크립트 로드
  useEffect(() => {
    const id = "daum-postcode-script";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // 열릴 때 embed
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    if (!window.daum?.Postcode) return; // 스크립트 로딩 대기

    const pc = new window.daum.Postcode({
      width: "100%",
      height: "100%",
      oncomplete: (data: any) => {
        const addr = data.roadAddress || data.address || "";
        const zc = data.zonecode || "";
        onSelect(addr, zc);
        setOpen(false);
      },
      onresize: () => {
        // 필요 시 추가 조절 가능
      },
    });

    pc.embed(wrapRef.current, { q: "", autoClose: false });
    return () => {
      // 언마운트 시 내부 DOM 정리
      if (wrapRef.current) wrapRef.current.innerHTML = "";
    };
  }, [open, onSelect]);

  return (
    <div className="relative">
      {/* 표시용 입력 박스 (부모에서 value만 내려주므로 readOnly) */}
      <div className="flex gap-2">
        <input
          className="w-full border rounded px-3 py-2"
          value={value}
          readOnly
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-2 rounded bg-indigo-600 text-white"
        >
          검색
        </button>
      </div>

      {/* 검색 패널 */}
      {open && (
        <div className="mt-2 border rounded relative bg-white">
          <div
            ref={wrapRef}
            style={{ width: "100%", height }}
          />
          <div className="absolute top-2 right-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-2 py-1 text-sm border rounded bg-white"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
