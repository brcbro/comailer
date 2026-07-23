"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ORG_COOKIE } from "@/lib/cookies";

type OrgOption = { id: string; name: string; slug: string };

function readOrgCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ORG_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("=")) || null;
}

export function OrgSwitcher({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selected, setSelected] = useState<string>("");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/orgs");
    if (!res.ok) return;
    const data = (await res.json()) as OrgOption[];
    setOrgs(data);
    const cookieVal = readOrgCookie();
    setSelected(cookieVal || "");
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) return null;

  async function onChange(value: string) {
    setSelected(value);
    await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: value || null }),
    });
    router.refresh();
    // Force client pages that fetch on mount to reload scoped data
    window.location.reload();
  }

  return (
    <div className="px-3 pb-3">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 px-1">
        Working as client
      </label>
      <select
        value={selected}
        onChange={(e) => void onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <option value="">All clients (view)</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {!selected && (
        <p className="text-[10px] text-on-surface-variant mt-1.5 px-1 leading-snug">
          Select a client to create or edit resources.
        </p>
      )}
    </div>
  );
}
