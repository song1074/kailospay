import { NavLink } from "react-router-dom";
import {
  Users, Store, Bell, MessageSquare, HelpCircle, BookOpen, Megaphone,
  Settings, Layers, CreditCard, Home, Shield, FileText, Building2, ReceiptText,
  ChevronDown, ChevronRight
} from "lucide-react";
import { useState } from "react";

type Item = { label: string; to: string; icon?: React.ReactNode };
type Group = { label: string; icon: React.ReactNode; items: Item[] };

const groups: Group[] = [
  {
    label: "회원 관리",
    icon: <Users className="w-4 h-4" />,
    items: [
      { label: "사용자", to: "/admin/users" },
      { label: "가맹점", to: "/admin/merchants" },
    ],
  },
  {
    label: "알람 관리",
    icon: <Bell className="w-4 h-4" />,
    items: [{ label: "일반 알람", to: "/admin/alerts" }],
  },
  {
    label: "게시판 관리",
    icon: <MessageSquare className="w-4 h-4" />,
    items: [
      { label: "질문 카테고리 관리", to: "/admin/boards/qna-categories" },
      { label: "자주 묻는 질문 관리", to: "/admin/boards/faq" },
      { label: "가이드 관리", to: "/admin/boards/guides" },
      { label: "공지사항 관리", to: "/admin/boards/notices" },
    ],
  },
  {
    label: "환경 설정",
    icon: <Settings className="w-4 h-4" />,
    items: [
      { label: "서비스 카테고리 관리", to: "/admin/settings/service-categories" },
      { label: "결제 관리", to: "/admin/settings/payments" },
      { label: "메인 관리", to: "/admin/settings/main" },
      { label: "개인정보처리방침 관리", to: "/admin/settings/privacy" },
      { label: "이용약관 관리", to: "/admin/settings/terms" },
    ],
  },
];

const singles: Item[] = [
  { label: "회사 정보", to: "/admin/company", icon: <Building2 className="w-4 h-4" /> },
  { label: "결제 요청서 리스트", to: "/admin/payment-requests", icon: <ReceiptText className="w-4 h-4" /> },
];

function LinkItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
          isActive ? "bg-blue-600 text-white" : "hover:bg-gray-200/70 dark:hover:bg-gray-800",
        ].join(" ")
      }
      end
    >
      {children}
    </NavLink>
  );
}

export default function Sidebar() {
  // 기본으로 첫 그룹 펼칩니다
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map(g => [g.label, g.label === "회원 관리"]))
  );

  const toggle = (label: string) => setOpen(p => ({ ...p, [label]: !p[label] }));

  return (
    <aside className="h-full w-72 border-r bg-white/90 backdrop-blur dark:bg-gray-900/40">
      {/* 로고/홈 */}
      <div className="px-4 py-4 border-b">
        <LinkItem to="/">
          <Home className="w-4 h-4" />
          <span className="font-semibold">KAILOS</span>
        </LinkItem>
      </div>

      {/* 그룹 */}
      <nav className="p-3 space-y-2">
        {groups.map(g => (
          <div key={g.label} className="space-y-1">
            <button
              onClick={() => toggle(g.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {g.icon}
                {g.label}
              </span>
              {open[g.label] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {open[g.label] && (
              <div className="ml-2 pl-2 border-l space-y-1">
                {g.items.map(it => (
                  <LinkItem to={it.to} key={it.to}>
                    <span className="w-4 h-4" /> {/* 들여쓰기용 빈 아이콘 */}
                    {it.label}
                  </LinkItem>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 단일 */}
        <div className="pt-2 space-y-1">
          {singles.map(it => (
            <LinkItem to={it.to} key={it.to}>
              {it.icon}
              {it.label}
            </LinkItem>
          ))}
        </div>

        {/* 하단 섹션(옵션): 정책 링크 등 */}
        <div className="mt-6 border-t pt-3 text-xs text-gray-500">
          <div className="flex items-center gap-2 px-3 py-2">
            <Shield className="w-4 h-4" />
            관리자 전용 영역
          </div>
        </div>
      </nav>
    </aside>
  );
}
