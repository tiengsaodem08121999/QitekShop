"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/types";
import { logout } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useLocale } from "@/components/I18nProvider";

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const t = useT();
  const { locale, toggle } = useLocale();

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.nav_dashboard, icon: "\u{1F4CA}" },
    { href: "/quotations", label: t.nav_quotations, icon: "\u{1F4CB}" },
    { href: "/customers", label: t.nav_customers, icon: "\u{1F465}" },
    { href: "/finance", label: t.nav_finance, icon: "\u{1F4B0}" },
    { href: "/settings", label: t.nav_settings, icon: "\u2699\uFE0F", roles: ["admin"] as string[] },
  ];

  const ROLE_LABELS: Record<string, string> = {
    admin: t.role_admin,
    sales: t.role_sales,
    accountant: t.role_accountant,
  };

  return (
    <aside className="w-56 bg-slate-800 text-slate-300 flex flex-col min-h-screen">
      <div className="p-5 text-white font-bold text-lg border-b border-slate-700">
        QitekComputer
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
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-white"
          >
            {t.logout}
          </button>
          <button
            onClick={toggle}
            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
          >
            {locale === "en" ? "VN" : "EN"}
          </button>
        </div>
      </div>
    </aside>
  );
}
