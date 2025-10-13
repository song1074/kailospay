// src/pages/admin/ServiceCategories.tsx
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../lib/auth";

type Category = {
  slug: "rent" | "goods" | "salary";
  name: string;
  banner_url?: string | null;
  recurring: boolean;
  docs_note?: string | null;
  sort_order: number;
  updated_at: string;
};

const LABEL: Record<Category["slug"], string> = {
  rent: "임대료/월세",
  goods: "물품대금",
  salary: "급여",
};

export default function ServiceCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 로컬 편집 버퍼
  const [edit, setEdit] = useState<Record<string, Partial<Category>>>({});

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const r = await authFetch("/api/admin/service-categories");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.message || `목록 조회 실패 (HTTP ${r.status})`);

      const list: Category[] = j.categories || [];
      setRows(list);

      // 편집 버퍼 초기화
      const buf: Record<string, Partial<Category>> = {};
      list.forEach((c) => {
        buf[c.slug] = {
          name: c.name,
          banner_url: c.banner_url ?? "",
          recurring: !!c.recurring,
          docs_note: c.docs_note ?? "",
        };
      });
      setEdit(buf);
    } catch (e: any) {
      setErr(e?.message || "목록 조회 실패");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(slug: Category["slug"]) {
    const payload = edit[slug] || {};
    setBusy(true);
    try {
      const r = await authFetch(`/api/admin/service-categories/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.message || `저장 실패 (HTTP ${r.status})`);

      await load();
      alert("저장되었습니다.");
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  // 정렬 시 원본 변형 방지
  const list = useMemo(
    () => rows.slice().sort((a, b) => a.sort_order - b.sort_order),
    [rows]
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">서비스 카테고리 관리</h1>
        <button className="btn btn-sm" onClick={load} disabled={busy}>
          {busy ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded bg-red-100 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded border">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-28">카테고리</th>
              <th className="w-60">표시명</th>
              <th className="w-72">(옵션) 배너 이미지 URL</th>
              <th className="w-24">정기결제</th>
              <th>확인서류 안내</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const buf = edit[c.slug] || {};
              const disabled = busy;
              return (
                <tr key={c.slug}>
                  <td className="font-medium">{LABEL[c.slug]}</td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-full"
                      value={buf.name ?? ""}
                      onChange={(e) =>
                        setEdit((p) => ({
                          ...p,
                          [c.slug]: { ...p[c.slug], name: e.target.value },
                        }))
                      }
                      disabled={disabled}
                    />
                  </td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="https://..."
                      value={(buf.banner_url as string) ?? ""}
                      onChange={(e) =>
                        setEdit((p) => ({
                          ...p,
                          [c.slug]: { ...p[c.slug], banner_url: e.target.value },
                        }))
                      }
                      disabled={disabled}
                    />
                  </td>

                  <td className="text-center">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={!!buf.recurring}
                      onChange={(e) =>
                        setEdit((p) => ({
                          ...p,
                          [c.slug]: { ...p[c.slug], recurring: e.target.checked },
                        }))
                      }
                      disabled={disabled}
                      aria-label={`${LABEL[c.slug]} 정기결제`}
                    />
                  </td>

                  <td>
                    <textarea
                      className="textarea textarea-bordered textarea-sm w-full"
                      rows={3}
                      placeholder="필수/선택 서류를 안내하세요."
                      value={(buf.docs_note as string) ?? ""}
                      onChange={(e) =>
                        setEdit((p) => ({
                          ...p,
                          [c.slug]: { ...p[c.slug], docs_note: e.target.value },
                        }))
                      }
                      disabled={disabled}
                    />
                  </td>

                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => save(c.slug)}
                      disabled={disabled}
                    >
                      저장
                    </button>
                  </td>
                </tr>
              );
            })}

            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-10">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        * 이 화면은 임대료/월세, 물품대금, 급여 3개 카테고리만 관리합니다.
      </p>
    </div>
  );
}
