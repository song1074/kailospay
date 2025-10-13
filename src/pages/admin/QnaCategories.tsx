import { useEffect, useState } from "react";
import { API_BASE, getToken } from "../../lib/auth";

type Cat = { id:number; kind:string; name:string; sort:number; created_at:string };

export default function QnaCategories() {
  const [list, setList] = useState<Cat[]>([]);
  const [kind, setKind] = useState<"faq"|"guide"|"notice">("faq");
  const [editing, setEditing] = useState<Partial<Cat>>({ kind:"faq" });

  async function load() {
    const r = await fetch(`${API_BASE}/api/admin/board/categories?kind=${kind}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const j = await r.json(); if (j?.ok) setList(j.categories || []);
  }
  useEffect(() => { load(); }, [kind]);

  async function save(e:React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`${API_BASE}/api/admin/board/categories`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: JSON.stringify(editing),
    });
    const j = await r.json(); if (!j?.ok) return alert(j?.message||"실패");
    setEditing({ kind });
    await load();
  }

  async function remove(id:number) {
    if (!confirm("삭제할까요?")) return;
    const r = await fetch(`${API_BASE}/api/admin/board/categories/${id}`, {
      method:"DELETE",
      headers:{ Authorization:`Bearer ${getToken()}` }
    });
    const j = await r.json(); if (!j?.ok) return alert(j?.message||"실패");
    await load();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">질문 카테고리 관리</h2>

      <div className="flex gap-2 mb-4">
        <select className="border px-3 py-2 rounded" value={kind} onChange={e=>setKind(e.target.value as any)}>
          <option value="faq">FAQ</option>
          <option value="guide">가이드</option>
          <option value="notice">공지사항</option>
        </select>
      </div>

      <form onSubmit={save} className="flex gap-2 mb-6">
        <input className="border px-3 py-2 rounded w-40" placeholder="정렬(sort)"
               value={editing.sort ?? ""} onChange={e=>setEditing(p=>({...p, sort:Number(e.target.value||0)}))} />
        <input className="border px-3 py-2 rounded w-80" placeholder="카테고리명"
               value={editing.name ?? ""} onChange={e=>setEditing(p=>({...p, name:e.target.value}))} />
        <button className="px-4 py-2 bg-black text-white rounded">저장</button>
        {editing.id ? (
          <button type="button" className="px-4 py-2 border rounded"
                  onClick={()=>setEditing({ kind })}>취소</button>
        ):null}
      </form>

      <table className="w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border p-2 w-20">번호</th>
            <th className="border p-2 w-24">정렬</th>
            <th className="border p-2">카테고리</th>
            <th className="border p-2 w-40">등록일자</th>
            <th className="border p-2 w-32">관리</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it)=>(
            <tr key={it.id}>
              <td className="border p-2 text-center">{it.id}</td>
              <td className="border p-2 text-center">{it.sort ?? 0}</td>
              <td className="border p-2">{it.name}</td>
              <td className="border p-2 text-center">{new Date(it.created_at).toLocaleString()}</td>
              <td className="border p-2 text-center">
                <button className="px-2 py-1 border mr-1 rounded" onClick={()=>setEditing(it)}>수정</button>
                <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={()=>remove(it.id)}>삭제</button>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td className="border p-4 text-center text-gray-500" colSpan={5}>등록된 항목이 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
