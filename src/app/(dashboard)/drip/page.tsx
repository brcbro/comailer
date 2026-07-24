"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppModal } from "@/components/app-modal";
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
  senders: Sender[];
}

interface Template {
  id: string;
  name: string;
  subject: string;
  type: "HTML" | "TEXT";
  body: string;
}

interface DripCampaign {
  id: string;
  name: string;
  status: "paused" | "running" | "completed";
  dailyLimit: number;
  batchSize: number;
  sentToday: number;
  dayKey: string;
  subject: string;
  bodyType: string;
  body?: string;
  templateId?: string | null;
  smtpConfig: { id: string; name: string; domain: string };
  sender: { id: string; email: string; displayName?: string | null };
  template?: { id: string; name: string } | null;
  stats: { total: number; pending: number; sent: number; failed: number };
}

export default function DripPage() {
  const [campaigns, setCampaigns] = useState<DripCampaign[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    smtpConfigId: "",
    senderId: "",
    templateId: "",
    subject: "",
    bodyType: "HTML" as "HTML" | "TEXT",
    body: "",
    dailyLimit: "100",
    batchSize: "5",
    recipients: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    templateId: "",
    subject: "",
    bodyType: "HTML" as "HTML" | "TEXT",
    body: "",
  });
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dripRes, smtpRes, tplRes] = await Promise.all([
        fetch("/api/drip"),
        fetch("/api/smtp"),
        fetch("/api/templates"),
      ]);
      if (dripRes.ok) setCampaigns(await dripRes.json());
      if (smtpRes.ok) {
        const configs = await smtpRes.json();
        setSmtpConfigs(configs);
      }
      if (tplRes.ok) setTemplates(await tplRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const activeSmtp = smtpConfigs.find((c) => c.id === form.smtpConfigId);
  const senders = activeSmtp?.senders || [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    if (countRecipientsInText(form.recipients) === 0) {
      setCreateError("Add at least one valid recipient (paste or upload a CSV/Excel file).");
      setCreating(false);
      return;
    }
    try {
      const res = await fetch("/api/drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dailyLimit: parseInt(form.dailyLimit, 10),
          batchSize: parseInt(form.batchSize, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setShowCreate(false);
      setCreateError("");
      setForm({
        name: "",
        smtpConfigId: "",
        senderId: "",
        templateId: "",
        subject: "",
        bodyType: "HTML",
        body: "",
        dailyLimit: "100",
        batchSize: "5",
        recipients: "",
      });
      await load();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(id: string, status: "running" | "paused") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drip/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      if (status === "running") {
        // Kick the worker immediately so sends don't wait up to 60s for cron.
        await fetch("/api/drip/tick", { method: "POST" }).catch(() => null);
      }
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function runTickNow() {
    setBusyId("tick");
    try {
      const res = await fetch("/api/drip/tick", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tick failed");
      await load();
      alert(
        `Sent ${data.processed ?? 0} email(s) across ${data.campaigns ?? 0} running campaign(s).`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Tick failed");
    } finally {
      setBusyId(null);
    }
  }

  async function updateLimit(id: string, dailyLimit: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drip/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function openEditContent(c: DripCampaign) {
    setEditError("");
    setEditingId(c.id);
    setEditForm({
      templateId: c.templateId || "",
      subject: c.subject || "",
      bodyType: c.bodyType === "TEXT" ? "TEXT" : "HTML",
      body: c.body || "",
    });
    // List payload may omit body for size — load full campaign if needed.
    if (!c.body) {
      try {
        const res = await fetch(`/api/drip/${c.id}`);
        if (res.ok) {
          const full = await res.json();
          setEditForm({
            templateId: full.templateId || "",
            subject: full.subject || "",
            bodyType: full.bodyType === "TEXT" ? "TEXT" : "HTML",
            body: full.body || "",
          });
        }
      } catch {
        /* keep list values */
      }
    }
  }

  function applyEditTemplate(tplId: string) {
    const tpl = templates.find((t) => t.id === tplId);
    setEditForm((f) => ({
      ...f,
      templateId: tplId,
      subject: tpl?.subject || f.subject,
      bodyType: tpl?.type || f.bodyType,
      body: tpl?.body || f.body,
    }));
  }

  async function saveEditContent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.subject.trim() || !editForm.body.trim()) {
      setEditError("Subject and body are required.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/drip/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: editForm.templateId || null,
          subject: editForm.subject,
          bodyType: editForm.bodyType,
          body: editForm.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  async function retryFailed(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drip/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retryFailed" }),
      });
      if (!res.ok) throw new Error("Retry failed");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this drip campaign and its queue?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/drip/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function applyTemplate(tplId: string) {
    const tpl = templates.find((t) => t.id === tplId);
    setForm((f) => ({
      ...f,
      templateId: tplId,
      subject: tpl?.subject || f.subject,
      bodyType: tpl?.type || f.bodyType,
      body: tpl?.body || f.body,
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Loading drip campaigns…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
            Drip Campaigns
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Import large recipient lists, toggle automated background sending, and throttle daily send limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer w-fit"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>New Drip Campaign</span>
          </button>
          <button
            type="button"
            disabled={busyId === "tick"}
            onClick={() => runTickNow()}
            className="px-5 py-3 bg-surface-container-high text-on-surface rounded-xl text-sm font-bold border border-outline-variant/30 hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer w-fit disabled:opacity-50"
            title="Manually send the next batch for all running campaigns"
          >
            {busyId === "tick" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">play_circle</span>
            )}
            <span>Send now</span>
          </button>
        </div>
      </section>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 text-xs text-on-surface-variant flex items-start gap-2.5 font-medium">
        <span className="material-symbols-outlined text-lg mt-0.5 text-primary">bolt</span>
        <p className="leading-relaxed">
          While a campaign is{" "}
          <span className="text-primary font-bold">Running</span>, the worker sends up to your daily
          limit in small batches every minute. Toggle{" "}
          <span className="text-tertiary font-bold">Paused</span> anytime to stop. Progress and
          engagement metrics display under Analytics.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-error-container/60 border border-error/20 rounded-2xl text-error text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center space-y-4 border border-outline-variant/20">
          <div className="size-16 bg-surface-container-high text-on-surface-variant rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">water_drop</span>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              No drip campaigns yet
            </h3>
            <p className="text-xs text-on-surface-variant">
              Import your subscriber or outreach email lists and configure daily throttle limits to start automated drip sending.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Create First Drip Campaign</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {campaigns.map((c) => {
            const pct =
              c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0;
            const remainingToday = Math.max(0, c.dailyLimit - c.sentToday);
            return (
              <div
                key={c.id}
                className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-6 shadow-sm hover:border-primary/30 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-outline-variant/20 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-xl font-headline font-bold text-on-surface">
                        {c.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border ${
                          c.status === "running"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : c.status === "completed"
                              ? "bg-surface-container-high text-on-surface-variant border-outline-variant/30"
                              : "bg-tertiary/10 text-tertiary border-tertiary/20"
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-mono">
                      {c.smtpConfig.name} · from {c.sender.email} · {c.subject}
                      {c.template?.name ? ` · template: ${c.template.name}` : ""}
                    </p>
                    {c.stats.total === 0 && (
                      <p className="text-xs text-error font-medium mt-1">
                        No recipients were imported. Delete this campaign and create a new one
                        (recipient save failed on an older deploy).
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {c.status !== "completed" && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => openEditContent(c)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/20 cursor-pointer"
                        title="Change subject/body for remaining recipients"
                      >
                        <span className="material-symbols-outlined text-base">edit_note</span>
                        <span>Edit content</span>
                      </button>
                    )}

                    {c.status !== "completed" && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() =>
                          toggle(c.id, c.status === "running" ? "paused" : "running")
                        }
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50 border ${
                          c.status === "running"
                            ? "bg-tertiary/10 text-tertiary border-tertiary/20 hover:bg-tertiary/20"
                            : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        }`}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-lg">
                            {c.status === "running" ? "pause" : "play_arrow"}
                          </span>
                        )}
                        <span>{c.status === "running" ? "Pause" : "Start"}</span>
                      </button>
                    )}

                    {c.stats.failed > 0 && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => retryFailed(c.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/20 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">sync</span>
                        <span>Retry failed ({c.stats.failed})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => remove(c.id)}
                      className="p-2 rounded-xl bg-error-container/40 hover:bg-error-container text-error cursor-pointer transition-colors"
                      title="Delete campaign"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                    <div className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-base text-primary">group</span>
                      <span>Total</span>
                    </div>
                    <div className="text-on-surface font-headline font-extrabold text-xl mt-1">
                      {c.stats.total}
                    </div>
                  </div>

                  <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                    <div className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-base text-primary">check_circle</span>
                      <span>Sent</span>
                    </div>
                    <div className="text-primary font-headline font-extrabold text-xl mt-1">
                      {c.stats.sent}
                    </div>
                  </div>

                  <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                    <div className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-base text-tertiary">schedule</span>
                      <span>Pending</span>
                    </div>
                    <div className="text-tertiary font-headline font-extrabold text-xl mt-1">
                      {c.stats.pending}
                    </div>
                  </div>

                  <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                    <div className="text-on-surface-variant flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-base text-secondary">speed</span>
                      <span>Today</span>
                    </div>
                    <div className="text-on-surface font-headline font-extrabold text-xl mt-1">
                      {c.sentToday}/{c.dailyLimit}
                      <span className="text-on-surface-variant text-xs font-normal font-sans ml-1">
                        ({remainingToday} left)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-on-surface-variant">
                    <span>Campaign Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-container overflow-hidden border border-outline-variant/20">
                    <div
                      className="h-full bg-primary transition-all duration-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs">
                  <label className="flex items-center gap-2 text-on-surface-variant font-bold">
                    <span>Daily limit:</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={c.dailyLimit}
                      key={`${c.id}-${c.dailyLimit}`}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v !== c.dailyLimit) updateLimit(c.id, v);
                      }}
                      className="w-28 px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface font-bold text-xs focus:outline-none focus:border-primary"
                    />
                  </label>
                  <p className="text-[11px] text-on-surface-variant">
                    Batch size: <strong>{c.batchSize} emails/min</strong> while running.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AppModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateError("");
        }}
        maxWidth="max-w-2xl"
        panelClassName="max-h-[min(calc(100vh-4rem),900px)] flex flex-col"
      >
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 shrink-0">
              <h2 className="text-2xl font-headline font-bold text-on-surface">
                New Drip Campaign
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto scrollbar-theme px-6 py-5 space-y-4 text-xs">
              {createError && (
                <div className="p-3 rounded-xl bg-error-container/50 border border-error/20 text-error text-xs font-medium">
                  {createError}
                </div>
              )}              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Campaign Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                  placeholder="March outreach list"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    SMTP Connection
                  </label>
                  <select
                    required
                    value={form.smtpConfigId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        smtpConfigId: e.target.value,
                        senderId: "",
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="">Select Connection…</option>
                    {smtpConfigs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.domain})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Sender Email
                  </label>
                  <select
                    required
                    value={form.senderId}
                    onChange={(e) => setForm({ ...form, senderId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary disabled:opacity-50"
                    disabled={!form.smtpConfigId}
                  >
                    <option value="">Select sender…</option>
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Template (optional)
                </label>
                <select
                  value={form.templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                >
                  <option value="">Custom / None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Subject Line
                </label>
                <input
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Type
                  </label>
                  <select
                    value={form.bodyType}
                    onChange={(e) =>
                      setForm({ ...form, bodyType: e.target.value as "HTML" | "TEXT" })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="HTML">HTML</option>
                    <option value="TEXT">TEXT</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                      Daily Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.dailyLimit}
                      onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                      Per Minute
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={form.batchSize}
                      onChange={(e) => setForm({ ...form, batchSize: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Body Content
                </label>
                <textarea
                  required
                  rows={6}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full p-3.5 bg-surface-container border border-outline-variant/30 rounded-2xl text-on-surface font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 leading-relaxed resize-y min-h-[140px] max-h-[240px] scrollbar-theme"
                />
              </div>

              <RecipientImport
                id="drip-recipients"
                value={form.recipients}
                onChange={(recipients) => setForm({ ...form, recipients })}
                rows={8}
                helperText="Paste your list or upload CSV/Excel (great for large lists — 14k+ rows). Duplicates are skipped."
              />
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
                  }}
                  className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Campaign (Starts Paused)</span>
                </button>
              </div>
            </form>
      </AppModal>

      {/* Edit content mid-campaign */}
      <AppModal
        open={!!editingId}
        onClose={() => {
          setEditingId(null);
          setEditError("");
        }}
        maxWidth="max-w-2xl"
        panelClassName="max-h-[min(calc(100vh-4rem),900px)] flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-2xl font-headline font-bold text-on-surface">
              Edit campaign content
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Changes apply to pending recipients only. Already-sent emails are unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setEditError("");
            }}
            className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <form onSubmit={saveEditContent} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-theme px-6 py-5 space-y-4 text-xs">
            {editError && (
              <div className="p-3 rounded-xl bg-error-container/50 border border-error/20 text-error text-xs font-medium">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                Load from template
              </label>
              <select
                value={editForm.templateId}
                onChange={(e) => applyEditTemplate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              >
                <option value="">Keep / custom</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                Subject Line
              </label>
              <input
                required
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                Type
              </label>
              <select
                value={editForm.bodyType}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    bodyType: e.target.value as "HTML" | "TEXT",
                  })
                }
                className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-xs focus:outline-none focus:border-primary"
              >
                <option value="HTML">HTML</option>
                <option value="TEXT">TEXT</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                Body Content
              </label>
              <textarea
                required
                rows={10}
                value={editForm.body}
                onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                className="w-full p-3.5 bg-surface-container border border-outline-variant/30 rounded-2xl text-on-surface font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 leading-relaxed resize-y min-h-[180px] max-h-[360px] scrollbar-theme"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEditError("");
              }}
              className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold inline-flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save for remaining sends</span>
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
