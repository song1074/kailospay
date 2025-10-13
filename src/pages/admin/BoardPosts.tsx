import { useEffect, useMemo, useState } from "react";
import { API_BASE, getToken } from "../../lib/auth";

type Cat = { id:number; name:string };
type Post = {
  id:number; kind:string; category_id:number|null; category_name?:string|null;
  title:string; body?:string|null; created_at:string;
};

export default function BoardPosts({ kind }:{ kind:"faq"|"guide"|"notice" }) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [list, setList] = useState<Post[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number|0>(0);
  const [editing, setEditing] = useState<Partial<Post>>({ kind });

  async function loadCats() {
    const r = await fetch(`${API_BASE}/api/admin/board/categories?kind=${kind}`, {
      headers:{ Authorization:`Bearer ${getToken()}` }
    });
    const j = await r.json(); if (j?.ok) setCats(j.categories || []);
  }
  async function load() {
    const u = new URL(`${API_BASE}/api/admin/board/posts`);
    u.searchParams.set("kind", kind);
    if (categoryId) u.searchParams.set("category_id", String(categoryId));
    if (q) u.searchParams.set("q", q);
    const r = await fetch(u.toString(), { headers:{ Authorization:`Bearer ${getToken()}` } });
    const j = await r.json(); if (j?.ok) setList(j.posts || []);
  }
  useEffect(()=>{ loadCats(); }, [kind]);
  useEffect(()=>{ load(); }, [kind, categoryId]); // 검색은 버튼으로

  async function save(e:React.FormEvent) {
    e.preventDefault();
    const body = {
      ...editing,
      kind,
      category_id: editing.category_id ? Number(editing.category_id) : null,
    };
    const r = await fetch(`${API_BASE}/api/admin/board/posts`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    const j = await r.json(); if (!j?.ok) return alert(j?.message||"실패");
    setEditing({ kind });
    await load();
  }
  async function remove(id:number) {
    if (!confirm("삭제할까요?")) return;
    const r = await fetch(`${API_BASE}/api/admin/board/posts/${id}`, {
      method:"DELETE",
      headers:{ Authorization:`Bearer ${getToken()}` }
    });
    const j = await r.json(); if (!j?.ok) return alert(j?.message||"실패");
    await load();
  }

  const kindTitle = useMemo(()=>({
    faq: "자주 묻는 질문 관리",
    guide: "가이드 관리",
    notice: "공지사항 관리",
  }[kind]), [kind]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{kindTitle}</h2>

      <div className="flex gap-2 mb-3">
        <select className="border px-3 py-2 rounded w-48"
                value={categoryId||0}
                onChange={e=>setCategoryId(Number(e.target.value))}>
          <option value={0}>카테고리</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="border px-3 py-2 rounded w-72" placeholder="검색어 입력"
               value={q} onChange={e=>setQ(e.target.value)} />
        <button className="px-4 py-2 border rounded" onClick={load}>검색</button>
      </div>

      <form onSubmit={save} className="mb-6 space-y-2">
        <div className="flex gap-2">
          <select className="border px-3 py-2 rounded w-48"
                  value={editing.category_id ?? 0}
                  onChange={e=>setEditing(p=>({...p, category_id:Number(e.target.value)||null}))}>
            <option value={0}>카테고리 선택</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="border px-3 py-2 rounded flex-1" placeholder="제목"
                 value={editing.title ?? ""}
                 onChange={e=>setEditing(p=>({...p, title:e.target.value}))} />
          <button className="px-4 py-2 bg-black text-white rounded">저장</button>
          {editing.id ? (
            <button type="button" className="px-4 py-2 border rounded"
                    onClick={()=>setEditing({ kind })}>취소</button>
          ): null}
        </div>
        <textarea className="border px-3 py-2 rounded w-full h-28"
                  placeholder="본문(선택)"
                  value={editing.body ?? ""}
                  onChange={e=>setEditing(p=>({...p, body:e.target.value}))} />
      </form>

      <table className="w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border p-2 w-20">번호</th>
            <th className="border p-2 w-48">카테고리</th>
            <th className="border p-2">제목</th>
            <th className="border p-2 w-48">등록일자</th>
            <th className="border p-2 w-32">관리</th>
          </tr>
        </thead>
        <tbody>
          {list.map(it=>(
            <tr key={it.id}>
              <td className="border p-2 text-center">{it.id}</td>
              <td className="border p-2 text-center">{it.category_name || "-"}</td>
              <td className="border p-2">{it.title}</td>
              <td className="border p-2 text-center">{new Date(it.created_at).toLocaleString()}</td>
              <td className="border p-2 text-center">
                <button className="px-2 py-1 border mr-1 rounded" onClick={()=>setEditing(it)}>수정</button>
                <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>remove(it.id)}>삭제</button>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td className="border p-4 text-center text-gray-500" colSpan={5}>등록된 글이 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
