import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";

type Item = { label: string; to: string; enabled?: boolean };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "회원 관리",
    items: [
      { label: "사용자", to: "/admin/users", enabled: true },
      { label: "가맹점", to: "/admin/merchants" }, // (준비중)
    ],
  },
  {
    label: "알람 관리",
    items: [{ label: "일반 알람", to: "/admin/alerts" }], // (준비중)
  },
  {
    label: "게시판 관리",
    items: [
      { label: "질문 카테고리 관리", to: "/admin/boards/qna-categories", enabled: true },
      { label: "자주 묻는 질문 관리", to: "/admin/boards/faq", enabled: true },
      { label: "가이드 관리", to: "/admin/boards/guides", enabled: true },
      { label: "공지사항 관리", to: "/admin/boards/notices", enabled: true },
    ],
  },
  {
    label: "환경 설정",
    items: [
      { label: "서비스 카테고리 관리", to: "/admin/settings/service-categories", enabled: true },
      { label: "결제 관리(업로드 파일)", to: "/admin/uploads", enabled: true },
      { label: "메인 관리", to: "/admin/settings/main" }, // (준비중)
      { label: "개인정보처리방침 관리", to: "/admin/settings/privacy" }, // (준비중)
      { label: "이용약관 관리", to: "/admin/settings/terms" }, // (준비중)
    ],
  },
];

const singles: Item[] = [
  { label: "회사 정보", to: "/admin/company", enabled: true },
  { label: "결제 요청서 리스트", to: "/admin/payment-requests", enabled: true },
];

function linkClass(isActive: boolean, enabled = true) {
  return [
    "block rounded px-3 py-2 text-sm transition-colors",
    isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100",
    enabled ? "" : "opacity-50 cursor-not-allowed pointer-events-none",
  ].join(" ");
}

export default function AdminLayout() {
  // 기본으로 '회원 관리'만 펼침
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, g.label === "회원 관리"]))
  );

  const toggle = (label: string) =>
    setOpen((p) => ({ ...p, [label]: !p[label] }));

  return (
    <div className="min-h-screen mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <div className="sticky top-20">
            <div className="mb-4 text-xl font-bold">관리자</div>

            <nav className="space-y-3">
              {groups.map((g) => (
                <section key={g.label}>
                  <button
                    type="button"
                    onClick={() => toggle(g.label)}
                    className="w-full flex items-center justify-between px-2 py-2 text-left text-sm font-medium rounded hover:bg-gray-100"
                    aria-expanded={open[g.label]}
                    aria-controls={`group-${g.label}`}
                  >
                    <span>{g.label}</span>
                    <span className="text-gray-500">{open[g.label] ? "▾" : "▸"}</span>
                  </button>

                  {open[g.label] && (
                    <div
                      id={`group-${g.label}`}
                      className="mt-1 ml-2 pl-2 border-l space-y-1"
                    >
                      {g.items.map((it) => (
                        <NavLink
                          key={it.to}
                          to={it.enabled ? it.to : "#"}
                          className={({ isActive }) => linkClass(isActive, it.enabled)}
                          end
                        >
                          {it.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </section>
              ))}

              {/* Single links */}
              <div className="pt-2 border-t space-y-1">
                {singles.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    className={({ isActive }) => linkClass(isActive, it.enabled ?? true)}
                    end
                  >
                    {it.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <section className="col-span-12 md:col-span-9 lg:col-span-10">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
