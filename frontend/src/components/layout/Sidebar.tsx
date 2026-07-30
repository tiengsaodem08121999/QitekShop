"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@/types";
import { logout } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useLocale } from "@/components/I18nProvider";

const COLLAPSE_KEY = "sidebar_collapsed";

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const t = useT();
  const { locale, toggle } = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.nav_dashboard, icon: "\u{1F4CA}" },
    { href: "/quotations", label: t.nav_quotations, icon: "\u{1F4CB}" },
    { href: "/customers", label: t.nav_customers, icon: "\u{1F465}" },
    { href: "/schedule", label: t.nav_schedule, icon: "\u{1F4C5}" },
    { href: "/finance", label: t.nav_finance, icon: "\u{1F4B0}" },
    { href: "/inventory", label: t.nav_inventory, icon: "\u{1F4E6}", roles: ["admin", "sales"] as string[] },
    { href: "/settings", label: t.nav_settings, icon: "⚙️", roles: ["admin"] as string[] },
    { href: "/note", label: t.nav_note, icon: "\u{1F4DD}" },
  ];

  const ROLE_LABELS: Record<string, string> = {
    admin: t.role_admin,
    sales: t.role_sales,
    accountant: t.role_accountant,
  };

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-56"
      } bg-slate-800 text-slate-300 flex flex-col min-h-screen transition-[width] duration-200`}
    >
      <div
        className={`flex items-center border-b border-slate-700 p-5 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed && (
          <span className="text-white font-bold text-lg truncate">QitekComputer</span>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t.sidebar_expand : t.sidebar_collapse}
          aria-label={collapsed ? t.sidebar_expand : t.sidebar_collapse}
          className="text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
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
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-3 text-sm transition-colors ${
                collapsed ? "justify-center px-0" : "px-5"
              } ${
                active
                  ? "bg-slate-700 text-white border-l-3 border-blue-500"
                  : "hover:bg-slate-700/50"
              }`}
            >
              <span>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-4">
        {!collapsed && (
          <>
            <div className="text-sm text-white">{user.full_name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</div>
          </>
        )}
        <div
          className={`flex items-center gap-2 ${
            collapsed ? "flex-col" : "justify-between mt-2"
          }`}
        >
          <button
            onClick={logout}
            title={t.logout}
            className={`text-xs text-slate-400 hover:text-white ${collapsed ? "text-base" : ""}`}
          >
            {collapsed ? "⏻" : t.logout}
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
