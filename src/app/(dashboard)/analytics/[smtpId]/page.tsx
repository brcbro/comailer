"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const AnalyticsActivityChart = dynamic(
  () => import("@/components/analytics-activity-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center text-on-surface-variant text-xs gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        Loading chart…
      </div>
    ),
  }
);

interface CampaignStat {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  opens: number;
  clicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: string;
  clickRate: string;
}

interface EventLog {
  id: string;
  type: "OPEN" | "CLICK";
  email: string;
  campaignName: string;
  url?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

interface AnalyticsData {
  smtpConfig: {
    id: string;
    name: string;
    domain: string;
    mode: string;
  };
  totals: {
    recipients: number;
    sent: number;
    failed: number;
    opens: number;
    uniqueOpens: number;
    openRate: string;
    clicks: number;
    uniqueClicks: number;
    clickRate: string;
  };
  campaigns: CampaignStat[];
  recentEvents: EventLog[];
  chartData: Array<{ date: string; opens: number; clicks: number }>;
}

export default function SmtpAnalyticsPage({
  params,
}: {
  params: Promise<{ smtpId: string }>;
}) {
  const { smtpId } = use(params);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAnalytics();
  }, [smtpId]);

  async function fetchAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics/${smtpId}`);
      if (!res.ok) throw new Error("Failed to load analytics for SMTP config");
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading analytics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Loading detailed SMTP analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/analytics"
          className="text-xs font-bold text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Back to Analytics Overview</span>
        </Link>
        <div className="p-6 bg-error-container/60 border border-error/30 rounded-2xl text-error text-sm">
          {error || "Failed to load analytics"}
        </div>
      </div>
    );
  }

  const { smtpConfig, totals, campaigns, recentEvents, chartData } = data;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div className="space-y-1">
          <Link
            href="/analytics"
            className="text-xs font-bold text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to All Configs</span>
          </Link>
          <h1 className="text-3xl font-headline font-bold text-on-background tracking-tight flex items-center gap-3">
            <span>{smtpConfig.name}</span>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-primary/10 text-primary rounded-lg border border-primary/20">
              {smtpConfig.mode}
            </span>
          </h1>
          <p className="text-xs text-on-surface-variant flex items-center gap-1 font-mono">
            <span className="material-symbols-outlined text-sm">globe</span>
            <span>Verified Domain: {smtpConfig.domain}</span>
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-surface-container border border-outline-variant/30 hover:bg-surface-container-high text-xs font-bold text-on-surface rounded-xl flex items-center gap-2 transition cursor-pointer w-fit"
        >
          <span className="material-symbols-outlined text-base">sync</span>
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            Total Sent
          </span>
          <div className="text-3xl font-headline font-extrabold text-on-surface">
            {totals.sent}
          </div>
          <span className="text-[11px] text-on-surface-variant block font-medium">
            Failed: {totals.failed}
          </span>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            Open Rate
          </span>
          <div className="text-3xl font-headline font-extrabold text-primary">
            {totals.openRate}%
          </div>
          <span className="text-[11px] text-on-surface-variant block font-medium">
            {totals.uniqueOpens} unique ({totals.opens} total)
          </span>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            Click Rate
          </span>
          <div className="text-3xl font-headline font-extrabold text-tertiary">
            {totals.clickRate}%
          </div>
          <span className="text-[11px] text-on-surface-variant block font-medium">
            {totals.uniqueClicks} unique ({totals.clicks} total)
          </span>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 space-y-1.5 shadow-sm">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            Total Campaigns
          </span>
          <div className="text-3xl font-headline font-extrabold text-secondary">
            {campaigns.length}
          </div>
          <span className="text-[11px] text-on-surface-variant block font-medium">
            {totals.recipients} total recipients
          </span>
        </div>
      </div>

      {/* Chart: Activity */}
      <div className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">
            trending_up
          </span>
          <span>Recent Activity (Opens vs Clicks)</span>
        </h3>

        <AnalyticsActivityChart data={chartData} />
      </div>

      {/* Campaign Performance Table */}
      <div className="bg-surface-container rounded-3xl p-6 border border-outline-variant/20 space-y-4 shadow-sm">
        <h3 className="text-xl font-headline font-bold text-on-surface">
          Campaign Performance
        </h3>
        {campaigns.length === 0 ? (
          <div className="text-center py-6 text-on-surface-variant text-xs">
            No campaigns sent on this config yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="text-[11px] font-bold text-on-surface-variant uppercase bg-surface-container-high/60 rounded-xl">
                <tr>
                  <th className="px-4 py-3.5 rounded-l-xl">Campaign Name</th>
                  <th className="px-4 py-3.5">Sent</th>
                  <th className="px-4 py-3.5">Unique Opens</th>
                  <th className="px-4 py-3.5">Open Rate</th>
                  <th className="px-4 py-3.5">Unique Clicks</th>
                  <th className="px-4 py-3.5">Click Rate</th>
                  <th className="px-4 py-3.5 rounded-r-xl">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-on-surface">{camp.name}</td>
                    <td className="px-4 py-3.5 font-semibold">{camp.sent}</td>
                    <td className="px-4 py-3.5 text-primary font-bold">{camp.uniqueOpens}</td>
                    <td className="px-4 py-3.5 text-primary font-bold">{camp.openRate}%</td>
                    <td className="px-4 py-3.5 text-tertiary font-bold">{camp.uniqueClicks}</td>
                    <td className="px-4 py-3.5 text-tertiary font-bold">{camp.clickRate}%</td>
                    <td className="px-4 py-3.5 text-on-surface-variant text-[11px]">
                      {new Date(camp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Engagement Event Log */}
      <div className="bg-surface-container rounded-3xl p-6 border border-outline-variant/20 space-y-4 shadow-sm">
        <h3 className="text-xl font-headline font-bold text-on-surface">
          Recent Engagement Events
        </h3>
        {recentEvents.length === 0 ? (
          <div className="text-center py-6 text-on-surface-variant text-xs">
            No open or click events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="text-[11px] font-bold text-on-surface-variant uppercase bg-surface-container-high/60 rounded-xl">
                <tr>
                  <th className="px-4 py-3.5 rounded-l-xl">Event</th>
                  <th className="px-4 py-3.5">Recipient Email</th>
                  <th className="px-4 py-3.5">Campaign</th>
                  <th className="px-4 py-3.5">Details / URL</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-4 py-3.5 rounded-r-xl">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15 font-mono">
                {recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border ${
                          evt.type === "OPEN"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-tertiary/10 text-tertiary border-tertiary/20"
                        }`}
                      >
                        {evt.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-on-surface font-semibold font-sans">{evt.email}</td>
                    <td className="px-4 py-3.5 text-on-surface-variant font-sans">{evt.campaignName}</td>
                    <td className="px-4 py-3.5 text-on-surface-variant max-w-xs truncate" title={evt.url || ""}>
                      {evt.url || "N/A (Pixel)"}
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant">{evt.ip || "127.0.0.1"}</td>
                    <td className="px-4 py-3.5 text-on-surface-variant font-sans text-[11px]">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
