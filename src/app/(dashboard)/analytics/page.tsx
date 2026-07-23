import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const revalidate = 0;

export default async function AnalyticsOverviewPage() {
  const configs = await prisma.smtpConfig.findMany({
    include: {
      campaigns: {
        include: {
          recipients: {
            include: {
              events: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <section className="border-b border-outline-variant/20 pb-6">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Select a ZeptoMail SMTP configuration below to view detailed engagement metrics, open/click rates, and live event logs.
        </p>
      </section>

      {configs.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center space-y-4 border border-outline-variant/20">
          <div className="size-16 bg-surface-container-high text-on-surface-variant rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">analytics</span>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              No SMTP Configs Configured
            </h3>
            <p className="text-xs text-on-surface-variant">
              Add an SMTP connection to start tracking email performance.
            </p>
          </div>
          <Link
            href="/smtp"
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Configure SMTP Connection</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {configs.map((config) => {
            let totalSent = 0;
            let totalOpens = 0;
            let totalClicks = 0;

            config.campaigns.forEach((camp) => {
              camp.recipients.forEach((rec) => {
                if (rec.status === "sent") totalSent++;
                rec.events.forEach((evt) => {
                  if (evt.type === "OPEN") totalOpens++;
                  if (evt.type === "CLICK") totalClicks++;
                });
              });
            });

            return (
              <div
                key={config.id}
                className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-6 hover:border-primary/30 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-2xl">
                          analytics
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-headline font-bold text-on-surface">
                          {config.name}
                        </h3>
                        <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                          Domain: {config.domain}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 text-xs font-bold bg-surface-container-high text-on-surface-variant rounded-lg">
                      {config.mode}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                        Sent
                      </span>
                      <span className="text-xl font-headline font-extrabold text-on-surface mt-0.5 block">
                        {totalSent}
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                        Opens
                      </span>
                      <span className="text-xl font-headline font-extrabold text-primary mt-0.5 block">
                        {totalOpens}
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                        Clicks
                      </span>
                      <span className="text-xl font-headline font-extrabold text-tertiary mt-0.5 block">
                        {totalClicks}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/analytics/${config.id}`}
                  className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-primary/20"
                >
                  <span>View Detailed Analytics</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
