"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/types";
import { logout } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { href: "/quotations", label: "Bao gia", icon: "\u{1F4CB}" },
  { href: "/finance", label: "Thu chi", icon: "\u{1F4B0}" },
  { href: "/settings", label: "Cai dat", icon: "\u2699\uFE0F", roles: ["admin"] as string[] },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Ban hang",
  accountant: "Ke toan",
};

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-800 text-slate-300 flex flex-col min-h-screen">
      <div className="p-5 text-white font-bold text-lg border-b border-slate-700">
        QitekShop
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.filter(
          (item) => !item.roles || item.roles.includes(user.role)
        ).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                active
                  ? "bg-slate-700 text-white border-l-3 border-blue-500"
                  : "hover:bg-slate-700/50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-4">
        <div className="text-sm text-white">{user.full_name}</div>
        <div className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</div>
        <button
          onClick={logout}
          className="mt-2 text-xs text-slate-400 hover:text-white"
        >
          Dang xuat
        </button>
      </div>
    </aside>
  );
}
