"use client";

import { useEffect, useState } from "react";

type AccessInfo = {
  daysRemaining: number | null;
  expired: boolean;
  accessEndsAt: string | null;
  organizationName: string;
};

export function AccessDaysBadge() {
  const [access, setAccess] = useState<AccessInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.access) return;
        setAccess(data.access as AccessInfo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!access || access.daysRemaining === null) return null;

  const days = access.daysRemaining;
  const expired = access.expired || days <= 0;
  const label = expired
    ? "Expired"
    : days === 1
      ? "1 day left"
      : `${days} days left`;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
        expired
          ? "bg-error-container/50 border-error/30 text-error"
          : days <= 7
            ? "bg-surface-container border-outline-variant/40 text-on-surface"
            : "bg-surface-container-low border-outline-variant/20 text-on-surface"
      }`}
      title={
        access.accessEndsAt
          ? `Access ends ${new Date(access.accessEndsAt).toLocaleDateString()}`
          : undefined
      }
    >
      <span className="material-symbols-outlined text-base">
        {expired ? "event_busy" : "schedule"}
      </span>
      <span>{label}</span>
    </div>
  );
}
