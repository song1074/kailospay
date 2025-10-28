// src/pages/QRPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";

type PageData = {
    title: string;
    subtitle?: string;
    videoEmbed?: string | null;
    videos?: string[];
    images: string[];
    ctaText?: string;
    ctaLink?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// ── 로고 경로 보정 ────────────────────────────────────────────────
function normalizeLogo(src: string | undefined | null) {
    const raw = (src ?? "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return new URL(path, window.location.origin).toString();
}
const LOGO_SRC = normalizeLogo(import.meta.env.VITE_QR_LOGO as string);
const FALLBACK_LOGO = "/qr-logo-fallback.png";
// ────────────────────────────────────────────────────────────────

export default function QRPage() {
    // ✅ 모든 Hook은 최상단에서 고정 순서로 호출
    const { id } = useParams();
    const [sp] = useSearchParams();
    const nav = useNavigate();
    const loc = useLocation();

    const [data, setData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [logoError, setLogoError] = useState(false);

    // 뷰어 상태
    const [index, setIndex] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // 표시할 미디어 리스트(영상 → 이미지)
    const media = useMemo(() => {
        if (!data) return [] as { type: "video" | "image"; src: string }[];
        const vids = (data.videos?.length ? data.videos : (data.videoEmbed ? [data.videoEmbed] : []))
            .filter(Boolean)
            .map((v) => ({ type: "video" as const, src: v! }));
        const imgs = (data.images || []).map((i) => ({ type: "image" as const, src: i }));
        return [...vids, ...imgs];
    }, [data]);

    // 인덱스 이동
    const go = (next: number) => {
        if (media.length === 0) return;
        setIndex((prev) => (prev + next + media.length) % media.length);
    };
    const goPrev = () => go(-1);
    const goNext = () => go(1);

    // 데이터 로드
    useEffect(() => {
        let alive = true;
        async function run() {
            setLoading(true);
            setErr(null);
            try {
                // 1) /qr/:id  2) /qr?id=  3) 라우터 매칭 실패 시 pathname에서 추출
                const idFromPath = (() => {
                    const m = loc.pathname.match(/\/qr\/([^/?#]+)/);
                    return m?.[1] || "";
                })();

                const idOrKey =
                    (id ?? "") ||
                    idFromPath ||
                    sp.get("id") ||
                    sp.get("code") ||
                    sp.get("key") ||
                    sp.get("slug");

                if (!idOrKey) {
                    throw new Error("missing id");
                }

                // exp, t, lang을 모두 그대로 API에 전달 (서명 검증용)
                const params = new URLSearchParams();
                for (const k of ["exp", "t", "lang"] as const) {
                    const v = sp.get(k);
                    if (v) params.set(k, v);
                }
                const qs = params.toString() ? `?${params.toString()}` : "";
                const url = `${API_BASE}/api/qr/${encodeURIComponent(idOrKey)}${qs}`;

                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

                const json: PageData = await res.json();
                if (!alive) return;
                setData(json);
                setIndex(0);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message ?? "failed");
            } finally {
                alive && setLoading(false);
            }
        }
        run();
        return () => {
            alive = false;
        };
    }, [id, sp, loc.pathname]);

    // 키보드 ← →
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") goPrev();
            else if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [media.length]);

    // 터치 스와이프
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleStart = (e: TouchEvent) => {
            touchStartX.current = e.touches[0].clientX;
        };
        const handleEnd = (e: TouchEvent) => {
            if (touchStartX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            const THRESHOLD = 40;
            if (dx > THRESHOLD) goPrev();
            else if (dx < -THRESHOLD) goNext();
        };

        el.addEventListener("touchstart", handleStart, { passive: true });
        el.addEventListener("touchend", handleEnd);
        return () => {
            el.removeEventListener("touchstart", handleStart);
            el.removeEventListener("touchend", handleEnd);
        };
    }, [media.length]);

    // ======= 렌더 =======
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-600">
                로딩 중…
            </div>
        );
    }
    if (err) {
        const friendly =
            err === "missing id"
                ? "유효하지 않은 QR 주소입니다. /qr/:id 또는 /qr?id= 형태로 접속해 주세요."
                : err.startsWith?.("404")
                    ? "요청하신 QR 페이지를 찾을 수 없습니다. (404)"
                    : err;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-red-600">
                <div>페이지 로드 실패</div>
                <code>{friendly}</code>
                <button
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white"
                    onClick={() => nav(0)}
                >
                    새로고침
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                데이터가 없습니다.
            </div>
        );
    }

    const item = media[index];

    return (
        <div ref={containerRef} className="min-h-screen bg-white flex flex-col">
            {/* 헤더 (가운데 정렬 & 크게) */}
            <header className="relative p-6">
                {/* 우측 상단 페이지 번호 */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {media.length ? `${index + 1} / ${media.length}` : ""}
                </div>

                <div className="flex flex-col items-center gap-2">
                    {LOGO_SRC && !logoError ? (
                        <img
                            src={LOGO_SRC}
                            alt="Kailos"
                            className="h-12 md:h-16"
                            onError={() => setLogoError(true)}
                        />
                    ) : FALLBACK_LOGO ? (
                        <img src={FALLBACK_LOGO} alt="Kailos" className="h-12 md:h-16" />
                    ) : null}

                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                        {data.title}
                    </h1>

                    {data.subtitle && (
                        <p className="text-sm md:text-base text-gray-500">{data.subtitle}</p>
                    )}
                </div>
            </header>

            {/* 메인 뷰어 */}
            <main className="flex-1 flex items-center justify-center relative select-none">
                {/* Prev / Next 버튼 */}
                {media.length > 1 && (
                    <>
                        <button
                            aria-label="previous"
                            onClick={goPrev}
                            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 rounded-full px-4 py-3 bg-black/70 text-white"
                        >
                            ◀
                        </button>
                        <button
                            aria-label="next"
                            onClick={goNext}
                            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 rounded-full px-4 py-3 bg-black/70 text-white"
                        >
                            ▶
                        </button>
                    </>
                )}

                {/* 미디어 */}
                {item?.type === "video" ? (
                    <video
                        key={item.src}
                        className="max-h-[70vh] w-full max-w-5xl"
                        src={item.src}
                        controls
                        playsInline
                    />
                ) : (
                    <img
                        key={item?.src}
                        className="max-h-[70vh] w-full max-w-5xl object-contain"
                        src={item?.src}
                        alt=""
                        draggable={false}
                    />
                )}
            </main>

            {/* 썸네일 바 */}
            {media.length > 1 && (
                <div className="w-full overflow-x-auto border-t">
                    <div className="flex items-center gap-2 p-3">
                        {media.map((m, i) => (
                            <button
                                key={`${m.type}-${m.src}-${i}`}
                                className={`shrink-0 rounded-xl border p-1 ${i === index ? "ring-2 ring-black" : ""
                                    }`}
                                onClick={() => setIndex(i)}
                                aria-label={`go to item ${i + 1}`}
                            >
                                {m.type === "image" ? (
                                    <img
                                        src={m.src}
                                        alt=""
                                        className="h-14 w-24 object-cover rounded-lg"
                                    />
                                ) : (
                                    <div className="relative h-14 w-24 rounded-lg overflow-hidden">
                                        <video src={m.src} className="h-full w-full object-cover" muted />
                                        <div className="absolute inset-0 grid place-items-center">
                                            <span className="rounded-full px-2 py-1 text-xs bg-black/70 text-white">
                                                ▶
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA */}
            {data.ctaLink && data.ctaText && (
                <div className="p-4">
                    <a
                        className="block w-full text-center px-4 py-3 rounded-xl bg-black text-white"
                        href={data.ctaLink}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {data.ctaText}
                    </a>
                </div>
            )}
        </div>
    );
}
