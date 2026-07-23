"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/org-switcher";

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/smtp", label: "SMTP Configs", icon: "settings_input_component" },
  { href: "/templates", label: "Templates", icon: "description" },
  { href: "/compose", label: "Compose", icon: "edit_note" },
  { href: "/drip", label: "Drip Campaigns", icon: "water_drop" },
  { href: "/analytics", label: "Analytics", icon: "analytics" },
];

type MeUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organization: { id: string; name: string } | null;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user as MeUser);
      })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <aside className="h-screen w-72 flex-col fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant/20 p-5 flex space-y-2 z-50 overflow-y-auto scrollbar-theme">
      <div className="px-3 py-4 mb-2 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 overflow-hidden shrink-0">
          <img
            src="/logo.png"
            alt="Comailer"
            className="size-10 object-cover scale-150"
          />
        </div>
        <div>
          <h1 className="font-headline font-bold text-2xl text-primary tracking-tight leading-none">
            Comailer
          </h1>
          <p className="text-on-surface-variant text-xs font-body mt-1">
            CohortIX mail suit
          </p>
        </div>
      </div>

      {isAdmin && <OrgSwitcher isAdmin />}

      {!isAdmin && user?.organization && (
        <div className="px-4 py-2 mb-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Organization
          </p>
          <p className="text-sm font-semibold text-on-surface truncate">
            {user.organization.name}
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-1.5 pt-2">
        {NAV.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-200 hover:translate-x-1",
                active
                  ? "bg-secondary-container text-on-secondary-container font-bold shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-variant/50 font-medium"
              )}
            >
              <span className="material-symbols-outlined text-xl">{icon}</span>
              <span className="font-body text-body-medium">{label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/clients"
            className={cn(
              "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-200 hover:translate-x-1",
              isActive("/clients")
                ? "bg-secondary-container text-on-secondary-container font-bold shadow-sm"
                : "text-on-surface-variant hover:bg-surface-variant/50 font-medium"
            )}
          >
            <span className="material-symbols-outlined text-xl">group</span>
            <span className="font-body text-body-medium">Clients</span>
          </Link>
        )}
      </nav>

      <div className="pt-4 border-t border-outline-variant/20 space-y-2">
        {user && (
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-on-surface truncate">
              {user.name || user.email}
            </p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
              {user.role === "ADMIN" ? "Admin" : "Client"}
            </p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-error-container/40 hover:text-error transition-all flex items-center gap-3 cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
