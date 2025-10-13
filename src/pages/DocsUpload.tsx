// src/pages/DocsUpload.tsx
import { useEffect, useRef, useState } from "react";

type UploadRow = {
  id: number;
  original_name: string;
  mime: string | null;
  size: number;
  created_at: string;
  saved_name: string;
};

// 같은 오리진 사용: Nginx가 /api를 Node(4000)으로 프록시
const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
const api = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocsUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
    if (!token) throw new Error("먼저 로그인하세요.");
    const res = await fetch(api(path), {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    // 응답이 JSON이 아닐 때도 친절한 메시지
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        res.status === 404 ? "엔드포인트가 없습니다(404)." : "JSON 응답이 아닙니다."
      );
    }
    if (!res.ok) throw new Error(json?.message || `요청 실패 (HTTP ${res.status})`);
    return json as T;
  }

  async function fetchList() {
    try {
      setLoading(true);
      const list = await getJSON<UploadRow[]>("/uploads/my");
      setRows(list);
    } catch (e: any) {
      alert(e?.message || "업로드 목록 불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  async function upload() {
    if (!token) return alert("먼저 로그인하세요.");
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return alert("파일을 선택하세요.");

    try {
      setLoading(true);
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));

      const res = await fetch(api("/uploads"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // FormData는 Content-Type 수동 지정 금지
        body: form,
      });

      // 서버 에러 시에도 메시지를 깔끔히
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok || !json?.ok) throw new Error(json?.message || "업로드 실패");

      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchList();
      alert(`업로드 성공 (${json.items?.length ?? 0}개)`);
    } catch (e: any) {
      alert(e?.message || "업로드 실패");
    } finally {
      setLoading(false);
    }
  }

  async function preview(filename: string) {
    if (!token) return alert("먼저 로그인하세요.");
    try {
      setLoading(true);
      const res = await fetch(api(`/uploads/preview/${filename}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("미리보기 로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) alert("팝업이 차단되었습니다. 팝업 허용을 켜주세요.");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      alert(e?.message || "미리보기 실패");
    } finally {
      setLoading(false);
    }
  }

  async function downloadFile(filename: string, name: string) {
    if (!token) return alert("먼저 로그인하세요.");
    try {
      setLoading(true);
      const res = await fetch(api(`/uploads/download/${filename}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "다운로드 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">서류 첨부</h1>

      <div className="flex items-center gap-2">
        <input type="file" multiple ref={fileInputRef} />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          onClick={upload}
          disabled={loading}
        >
          업로드
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          onClick={fetchList}
          disabled={loading}
        >
          내 업로드 목록
        </button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">파일명</th>
              <th className="text-left p-2">MIME</th>
              <th className="text-right p-2">크기</th>
              <th className="text-left p-2">업로드</th>
              <th className="text-center p-2">미리보기</th>
              <th className="text-center p-2">다운로드</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.original_name}</td>
                  <td className="p-2">{r.mime || "-"}</td>
                  <td className="p-2 text-right">{fmtBytes(r.size)}</td>
                  <td className="p-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="px-3 py-1 border rounded"
                      onClick={() => preview(r.saved_name)}
                      disabled={loading}
                    >
                      미리보기
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="px-3 py-1 border rounded"
                      onClick={() => downloadFile(r.saved_name, r.original_name)}
                      disabled={loading}
                    >
                      받기
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-3 text-center" colSpan={7}>
                  업로드 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
