"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { RecipientImport } from "@/components/recipient-import";
import { countRecipientsInText } from "@/lib/parse-recipients";

interface Sender {
  id: string;
  email: string;
  displayName?: string | null;
}

interface SmtpConfig {
  id: string;
  name: string;
  domain: string;
  mode: string;
  senders: Sender[];
}

interface Template {
  id: string;
  name: string;
  subject: string;
  type: "HTML" | "TEXT";
  body: string;
}

export default function ComposePage() {
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const [selectedSmtpId, setSelectedSmtpId] = useState("");
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyType, setBodyType] = useState<"HTML" | "TEXT">("HTML");
  const [bodyContent, setBodyContent] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");

  // Sending Status
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    totalCount?: number;
    successCount?: number;
    failureCount?: number;
    error?: string;
  } | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<{
    appUrl: string;
    isPublic: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [smtpRes, tplRes, trackRes] = await Promise.all([
          fetch("/api/smtp"),
          fetch("/api/templates"),
          fetch("/api/tracking/status"),
        ]);
        if (smtpRes.ok) {
          const configs = await smtpRes.json();
          setSmtpConfigs(configs);
          if (configs.length > 0) {
            setSelectedSmtpId(configs[0].id);
            if (configs[0].senders.length > 0) {
              setSelectedSenderId(configs[0].senders[0].id);
            }
          }
        }
        if (tplRes.ok) {
          setTemplates(await tplRes.json());
        }
        if (trackRes.ok) {
          setTrackingStatus(await trackRes.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInit(false);
      }
    }
    loadData();
  }, []);

  const activeSmtpConfig = smtpConfigs.find((c) => c.id === selectedSmtpId);
  const availableSenders = activeSmtpConfig?.senders || [];

  function handleSmtpChange(configId: string) {
    setSelectedSmtpId(configId);
    const cfg = smtpConfigs.find((c) => c.id === configId);
    if (cfg && cfg.senders.length > 0) {
      setSelectedSenderId(cfg.senders[0].id);
    } else {
      setSelectedSenderId("");
    }
  }

  function handleTemplateChange(tplId: string) {
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setSubject(tpl.subject);
      setBodyType(tpl.type);
      setBodyContent(tpl.body);
    }
  }

  const parsedRecipientCount = countRecipientsInText(recipientsRaw);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendResult(null);

    if (!selectedSmtpId || !selectedSenderId) {
      alert("Please select an SMTP Config and a Sender address.");
      return;
    }

    if (parsedRecipientCount === 0) {
      alert("Please enter at least one valid recipient email address.");
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
          smtpConfigId: selectedSmtpId,
          senderId: selectedSenderId,
          templateId: selectedTemplateId || null,
          subject,
          bodyType,
          body: bodyContent,
          recipients: recipientsRaw,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch campaign");
      }

      setSendResult({
        success: true,
        totalCount: data.totalCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
      });

      setRecipientsRaw("");
    } catch (err: unknown) {
      setSendResult({
        success: false,
        error: err instanceof Error ? err.message : "Error sending campaign",
      });
    } finally {
      setSending(false);
    }
  }

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Loading compose dependencies...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <section className="border-b border-outline-variant/20 pb-6">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
          Compose & Send Email
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Select your ZeptoMail connection, sender address, template, and recipients to send tracked emails.
        </p>
      </section>

      {/* Tracking URL Status Banner */}
      {trackingStatus && !trackingStatus.isPublic && (
        <div className="p-4 rounded-2xl border border-tertiary/30 bg-tertiary-container/15 text-sm flex items-start gap-3 text-tertiary">
          <span className="material-symbols-outlined text-xl mt-0.5">warning</span>
          <div className="space-y-1">
            <h4 className="font-bold">Tracking will not work with this APP_URL</h4>
            <p className="text-xs leading-relaxed opacity-90">
              Opens and clicks are loaded by the recipient&apos;s mail client.{" "}
              <code className="font-mono font-bold">{trackingStatus.appUrl}</code> is not
              reachable from the internet (localhost). Set <code className="font-mono font-bold">APP_URL</code> in{" "}
              <code className="font-mono font-bold">.env</code> to a public HTTPS URL (e.g. your deployed host or an ngrok/cloudflare tunnel), then restart server.
            </p>
          </div>
        </div>
      )}

      {trackingStatus?.isPublic && (
        <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/10 text-xs text-primary font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>
            Tracking base URL: <span className="font-mono font-bold">{trackingStatus.appUrl}</span> — open pixel + click redirects active.
          </span>
        </div>
      )}

      {sendResult && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
            sendResult.success
              ? "bg-primary/10 border-primary/30 text-primary font-semibold"
              : "bg-error-container/60 border-error/30 text-error font-semibold"
          }`}
        >
          <span className="material-symbols-outlined text-xl mt-0.5">
            {sendResult.success ? "check_circle" : "error"}
          </span>
          <div>
            {sendResult.success ? (
              <div className="space-y-1">
                <h4 className="font-bold">Campaign Dispatched Successfully!</h4>
                <p className="text-xs opacity-90">
                  Total Recipients: <strong>{sendResult.totalCount}</strong> \| Sent:{" "}
                  <strong>{sendResult.successCount}</strong> \| Failed:{" "}
                  <strong>{sendResult.failureCount}</strong>
                </p>
              </div>
            ) : (
              <div>
                <h4 className="font-bold">Sending Failed</h4>
                <p className="text-xs">{sendResult.error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {smtpConfigs.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center space-y-4 border border-outline-variant/20">
          <span className="material-symbols-outlined text-4xl text-tertiary">dns</span>
          <h3 className="text-xl font-headline font-bold text-on-surface">No SMTP Configs Available</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            You need to add at least one SMTP Config and Sender before sending emails.
          </p>
          <Link
            href="/smtp"
            className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span>Configure SMTP Connections</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSend} className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Campaign & Connection Setup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. July Newsletter"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                ZeptoMail Connection
              </label>
              <select
                value={selectedSmtpId}
                onChange={(e) => handleSmtpChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              >
                {smtpConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>
                    {cfg.name} ({cfg.mode} - {cfg.domain})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Sender Address
              </label>
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                disabled={availableSenders.length === 0}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary disabled:opacity-50"
              >
                {availableSenders.length === 0 ? (
                  <option value="">No senders added for this domain</option>
                ) : (
                  availableSenders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName ? `${s.displayName} <${s.email}>` : s.email}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {availableSenders.length === 0 && (
            <div className="p-3.5 bg-tertiary-container/15 border border-tertiary/30 rounded-2xl text-tertiary text-xs flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined text-lg">info</span>
              <span>
                Selected SMTP config has no sender addresses. Please add a sender in{" "}
                <Link href="/smtp" className="underline font-bold">
                  SMTP Configs
                </Link>
                .
              </span>
            </div>
          )}

          {/* Template Selection & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-outline-variant/20 pt-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Load Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              >
                <option value="">-- Custom Email --</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Subject Line
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hello {{name}}, check out our update!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Body & Format Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Email Body
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant font-semibold">Format:</span>
                <button
                  type="button"
                  onClick={() => setBodyType("HTML")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    bodyType === "HTML"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant border border-outline-variant/30"
                  }`}
                >
                  HTML
                </button>
                <button
                  type="button"
                  onClick={() => setBodyType("TEXT")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    bodyType === "TEXT"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant border border-outline-variant/30"
                  }`}
                >
                  TEXT
                </button>
              </div>
            </div>

            <textarea
              rows={10}
              required
              placeholder={
                bodyType === "HTML"
                  ? `<div style="font-family: sans-serif;">\n  <h2>Hello {{name}},</h2>\n  <p>Your message content here...</p>\n</div>`
                  : `Hello {{name}},\n\nYour message content here...`
              }
              value={bodyContent}
              onChange={(e) => setBodyContent(e.target.value)}
              className="w-full p-4 bg-surface-container border border-outline-variant/30 rounded-2xl text-on-surface font-mono text-xs focus:outline-none focus:border-primary leading-relaxed"
            />
          </div>

          {/* Recipients Section */}
          <div className="border-t border-outline-variant/20 pt-6">
            <RecipientImport
              id="compose-recipients"
              value={recipientsRaw}
              onChange={setRecipientsRaw}
              rows={5}
              helperText="Paste one recipient per line, or upload a CSV / Excel file with email (and optional name) columns."
            />
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-outline-variant/20">
            <p className="text-xs text-on-surface-variant max-w-xl">
              HTML emails get transparent open pixel + link rewriting. Text emails track clicks only. Use absolute <span className="font-mono font-bold">https://</span> links in email bodies.
            </p>

            <button
              type="submit"
              disabled={sending || availableSenders.length === 0}
              className="px-6 py-3.5 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">send</span>
                  <span>Send Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
