import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { orgWhere, resolveOrganizationId } from "@/lib/tenant";

export const revalidate = 0;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const organizationId = await resolveOrganizationId(session, { requireOrg: false });
  const scope = orgWhere(organizationId);

  const [
    smtpCount,
    templateCount,
    campaignCount,
    recipientCount,
    openCount,
    clickCount,
  ] = await Promise.all([
    prisma.smtpConfig.count({ where: scope }),
    prisma.template.count({ where: scope }),
    prisma.campaign.count({ where: scope }),
    prisma.recipient.count({
      where: { status: "sent", campaign: scope },
    }),
    prisma.trackingEvent.count({
      where: { type: "OPEN", recipient: { campaign: scope } },
    }),
    prisma.trackingEvent.count({
      where: { type: "CLICK", recipient: { campaign: scope } },
    }),
  ]);

  const recentCampaigns = await prisma.campaign.findMany({
    where: scope,
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      smtpConfig: true,
      recipients: true,
    },
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden bg-primary-container/20 border border-primary/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="space-y-3 relative z-10 max-w-2xl">
          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20 uppercase tracking-wider">
            CohortIX mail suit Overview
          </span>
          <h2 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Welcome back to Comailer.
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
            Your delivery systems are operating smoothly. Manage your SMTP nodes, email templates, and track real-time open and click engagement rates across your campaigns.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/compose"
              className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs sm:text-sm hover:opacity-90 hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">edit_note</span>
              <span>Compose Campaign</span>
            </Link>
            <Link
              href="/analytics"
              className="px-5 py-2.5 bg-surface-container border border-outline-variant/30 text-primary rounded-xl font-bold text-xs sm:text-sm hover:bg-surface-variant/50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">analytics</span>
              <span>View Analytics</span>
            </Link>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center p-6 bg-surface-container-lowest/80 rounded-2xl border border-outline-variant/20 shadow-inner">
          <div className="text-center space-y-1">
            <span className="material-symbols-outlined text-5xl text-primary">
              mark_email_read
            </span>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Inbox Delivery
            </p>
            <p className="text-2xl font-headline font-extrabold text-primary">
              Active
            </p>
          </div>
        </div>
      </section>

      {/* Glassmorphic Metric Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total SMTPs */}
        <div className="glass p-6 rounded-2xl flex flex-col justify-between gap-4 hover:shadow-lg transition-all duration-300 border border-outline-variant/20">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <span className="material-symbols-outlined text-xl">dns</span>
            </div>
            <Link
              href="/smtp"
              className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              Manage
            </Link>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
              SMTP Configs
            </p>
            <h3 className="text-3xl font-headline font-black text-on-background mt-1">
              {smtpCount}
            </h3>
          </div>
          <div className="h-8 w-full">
            <svg className="w-full h-full" viewBox="0 0 100 20">
              <path
                d="M0 15 Q 10 5, 20 12 T 40 8 T 60 15 T 80 5 T 100 12"
                fill="none"
                stroke="#4a7c59"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        {/* Templates */}
        <div className="glass p-6 rounded-2xl flex flex-col justify-between gap-4 hover:shadow-lg transition-all duration-300 border border-outline-variant/20">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-tertiary/10 rounded-xl text-tertiary">
              <span className="material-symbols-outlined text-xl">description</span>
            </div>
            <Link
              href="/templates"
              className="text-xs font-bold text-tertiary bg-tertiary/10 hover:bg-tertiary/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              View
            </Link>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
              Mail Templates
            </p>
            <h3 className="text-3xl font-headline font-black text-on-background mt-1">
              {templateCount}
            </h3>
          </div>
          <div className="h-8 w-full">
            <svg className="w-full h-full" viewBox="0 0 100 20">
              <path
                d="M0 10 Q 20 18, 40 10 T 80 12 T 100 5"
                fill="none"
                stroke="#705c30"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        {/* Campaigns */}
        <div className="glass p-6 rounded-2xl flex flex-col justify-between gap-4 hover:shadow-lg transition-all duration-300 border border-outline-variant/20">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <span className="material-symbols-outlined text-xl">campaign</span>
            </div>
            <Link
              href="/compose"
              className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              Send
            </Link>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
              Total Campaigns
            </p>
            <h3 className="text-3xl font-headline font-black text-on-background mt-1">
              {campaignCount}
            </h3>
          </div>
          <div className="h-8 w-full">
            <svg className="w-full h-full" viewBox="0 0 100 20">
              <path
                d="M0 15 Q 20 15, 40 5 T 70 10 T 100 12"
                fill="none"
                stroke="#4a7c59"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        {/* Emails Sent */}
        <div className="glass p-6 rounded-2xl flex flex-col justify-between gap-4 hover:shadow-lg transition-all duration-300 border border-outline-variant/20">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
              <span className="material-symbols-outlined text-xl">send</span>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              Delivered
            </span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">
              Emails Sent
            </p>
            <h3 className="text-3xl font-headline font-black text-on-background mt-1">
              {recipientCount}
            </h3>
          </div>
          <div className="h-8 w-full">
            <svg className="w-full h-full" viewBox="0 0 100 20">
              <path
                d="M0 18 L 10 12 L 20 15 L 30 8 L 40 10 L 50 4 L 60 7 L 70 2 L 80 5 L 90 1 L 100 3"
                fill="none"
                stroke="#6b6358"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Engagement Quick Stats Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">visibility</span>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Total Opens Tracked
              </p>
              <h4 className="text-2xl font-headline font-bold text-on-surface mt-0.5">
                {openCount}
              </h4>
            </div>
          </div>
          <Link
            href="/analytics"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Analytics</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">touch_app</span>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Total Clicks Tracked
              </p>
              <h4 className="text-2xl font-headline font-bold text-on-surface mt-0.5">
                {clickCount}
              </h4>
            </div>
          </div>
          <Link
            href="/analytics"
            className="text-xs font-bold text-tertiary hover:underline flex items-center gap-1"
          >
            <span>Analytics</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Recent Campaigns Table */}
      <section className="bg-surface-container rounded-3xl p-6 border border-outline-variant/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-headline font-bold text-on-surface">
              Recent Campaigns
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Summary of recent dispatched email campaigns.
            </p>
          </div>
          <Link
            href="/compose"
            className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Campaign</span>
          </Link>
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant text-sm bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40 space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline">
              mark_email_unread
            </span>
            <p className="font-semibold text-on-surface">No email campaigns sent yet</p>
            <p className="text-xs max-w-sm mx-auto">
              Create a mail template and compose your first email campaign to see performance data here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="text-[11px] font-bold text-on-surface-variant uppercase bg-surface-container-high/60 rounded-xl">
                <tr>
                  <th className="px-4 py-3.5 rounded-l-xl">Campaign Name</th>
                  <th className="px-4 py-3.5">SMTP Domain</th>
                  <th className="px-4 py-3.5">Recipients</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 rounded-r-xl">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {recentCampaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-container-high/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-bold text-on-surface">
                      {c.name}
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant font-mono">
                      {c.smtpConfig?.domain || "N/A"}
                    </td>
                    <td className="px-4 py-3.5 font-semibold">
                      {c.recipients.length}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 text-[11px] font-bold bg-primary/10 text-primary rounded-lg border border-primary/20">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
