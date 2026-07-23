"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppModal } from "@/components/app-modal";

interface Sender {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
}

interface SmtpConfig {
  id: string;
  name: string;
  mode: "SMTP" | "API";
  domain: string;
  bounceAddress?: string | null;
  region: string;
  host?: string | null;
  port?: number | null;
  secure: boolean;
  username?: string | null;
  hasPassword?: boolean;
  hasApiToken?: boolean;
  senders: Sender[];
  createdAt: string;
}

export default function SmtpPage() {
  const [configs, setConfigs] = useState<SmtpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeSenderConfig, setActiveSenderConfig] = useState<SmtpConfig | null>(null);

  // Form state for creating config
  const [formData, setFormData] = useState({
    name: "",
    mode: "SMTP" as "SMTP" | "API",
    domain: "",
    bounceAddress: "",
    region: "com",
    host: "smtp.zeptomail.com",
    port: "587",
    secure: false,
    username: "emailapikey",
    password: "",
    apiToken: "",
  });
  const [submitting, setLoadingSubmit] = useState(false);
  const [bounceDrafts, setBounceDrafts] = useState<Record<string, string>>({});
  const [savingBounceId, setSavingBounceId] = useState<string | null>(null);

  // Connection testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Sender creation state
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [addingSender, setAddingSender] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smtp");
      if (!res.ok) throw new Error("Failed to load configs");
      const data = await res.json();
      setConfigs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading configs");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateConfig(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSubmit(true);
    try {
      const res = await fetch("/api/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save config");
      }
      setShowAddModal(false);
      setFormData({
        name: "",
        mode: "SMTP",
        domain: "",
        bounceAddress: "",
        region: "com",
        host: "smtp.zeptomail.com",
        port: "587",
        secure: false,
        username: "emailapikey",
        password: "",
        apiToken: "",
      });
      await fetchConfigs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating config");
    } finally {
      setLoadingSubmit(false);
    }
  }

  async function handleSaveBounce(config: SmtpConfig) {
    const bounceAddress = (bounceDrafts[config.id] ?? config.bounceAddress ?? "").trim();
    if (!bounceAddress) {
      alert("Paste the exact bounce address from ZeptoMail → Domains");
      return;
    }
    setSavingBounceId(config.id);
    try {
      const res = await fetch(`/api/smtp/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name,
          mode: config.mode,
          domain: config.domain,
          bounceAddress,
          region: config.region,
          host: config.host,
          port: config.port,
          secure: config.secure,
          username: config.username,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save bounce address");
      }
      await fetchConfigs();
      alert("Bounce address saved. Retry send from Compose.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving bounce address");
    } finally {
      setSavingBounceId(null);
    }
  }

  async function handleDeleteConfig(id: string) {
    if (!confirm("Are you sure you want to delete this SMTP config?")) return;
    try {
      const res = await fetch(`/api/smtp/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchConfigs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting config");
    }
  }

  async function handleTestConnection(id: string) {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/smtp/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message || (data.success ? "Connection successful" : "Connection failed"),
      });
    } catch (err: unknown) {
      setTestResult({
        id,
        success: false,
        message: err instanceof Error ? err.message : "Test request failed",
      });
    } finally {
      setTestingId(null);
    }
  }

  async function handleAddSender(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSenderConfig) return;
    setAddingSender(true);
    try {
      const res = await fetch(`/api/smtp/${activeSenderConfig.id}/senders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: senderEmail, displayName: senderName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add sender");
      }
      setSenderEmail("");
      setSenderName("");
      await fetchConfigs();
      const updatedConfigs = await (await fetch("/api/smtp")).json();
      setConfigs(updatedConfigs);
      const updatedActive = updatedConfigs.find((c: SmtpConfig) => c.id === activeSenderConfig.id);
      if (updatedActive) setActiveSenderConfig(updatedActive);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error adding sender");
    } finally {
      setAddingSender(false);
    }
  }

  async function handleDeleteSender(configId: string, senderId: string) {
    if (!confirm("Remove this sender address?")) return;
    try {
      const res = await fetch(`/api/smtp/${configId}/senders/${senderId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete sender");
      }
      await fetchConfigs();
      setActiveSenderConfig((prev) =>
        prev
          ? { ...prev, senders: prev.senders.filter((s) => s.id !== senderId) }
          : prev
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting sender");
    }
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
            SMTP Configs & Senders
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage your ZeptoMail connections (SMTP or API) and registered domain sender addresses.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer w-fit"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>Add Connection</span>
        </button>
      </section>

      {error && (
        <div className="p-4 bg-error-container/60 border border-error/20 rounded-2xl text-error text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading configurations...</span>
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center space-y-4 border border-outline-variant/20">
          <div className="size-16 bg-surface-container-high text-on-surface-variant rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">dns</span>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              No SMTP connections configured
            </h3>
            <p className="text-xs text-on-surface-variant">
              Add a ZeptoMail connection using your SMTP credentials or API key to start sending emails.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Create First Connection</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {configs.map((config) => (
            <div
              key={config.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-6 hover:border-primary/30 transition-all shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <span className="material-symbols-outlined text-2xl">
                      {config.mode === "SMTP" ? "dns" : "api"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-headline font-bold text-on-surface">
                        {config.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border ${
                          config.mode === "SMTP"
                            ? "bg-tertiary/10 text-tertiary border-tertiary/20"
                            : "bg-primary/10 text-primary border-primary/20"
                        }`}
                      >
                        {config.mode} Mode
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-surface-container-high text-on-surface-variant rounded-lg">
                        Region: {config.region.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm">globe</span>
                      <span>Verified Domain: {config.domain}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(config.id)}
                    disabled={testingId === config.id}
                    className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high disabled:opacity-50 text-xs font-bold text-on-surface rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-outline-variant/20"
                  >
                    {testingId === config.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <span className="material-symbols-outlined text-base">sync</span>
                    )}
                    <span>Test Connection</span>
                  </button>

                  <button
                    onClick={() => setActiveSenderConfig(config)}
                    className="px-3.5 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-primary/20"
                  >
                    <span className="material-symbols-outlined text-base">group</span>
                    <span>Senders ({config.senders.length})</span>
                  </button>

                  <button
                    onClick={() => handleDeleteConfig(config.id)}
                    className="p-2 bg-error-container/40 hover:bg-error-container text-error rounded-xl transition cursor-pointer"
                    title="Delete connection"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>

              {/* Test Result Banner */}
              {testResult && testResult.id === config.id && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border ${
                    testResult.success
                      ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                      : "bg-error-container/60 border-error/30 text-error font-semibold"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {testResult.success ? "check_circle" : "error"}
                  </span>
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Bounce Address setup for API mode */}
              {config.mode === "API" && (
                <div className="space-y-2 rounded-2xl border border-tertiary/20 bg-tertiary-container/10 p-4">
                  <label className="text-xs font-bold uppercase text-tertiary tracking-wider block">
                    Bounce address (Required from ZeptoMail → Domains)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      placeholder={`e.g. bounce@bounce.${config.domain}`}
                      value={bounceDrafts[config.id] ?? config.bounceAddress ?? ""}
                      onChange={(e) =>
                        setBounceDrafts((prev) => ({ ...prev, [config.id]: e.target.value }))
                      }
                      className="w-full flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-2 font-mono text-xs text-on-surface focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveBounce(config)}
                      disabled={savingBounceId === config.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-tertiary text-on-primary px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {savingBounceId === config.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-base">save</span>
                      )}
                      Save Bounce
                    </button>
                  </div>
                  {!config.bounceAddress && (
                    <p className="text-[11px] text-tertiary font-medium">
                      Required for API sends. Without this, ZeptoMail returns Invalid email address.
                    </p>
                  )}
                </div>
              )}

              {/* Connection Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {config.mode === "SMTP" ? (
                  <>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-on-surface-variant block font-semibold">Host</span>
                      <span className="text-on-surface font-mono mt-1 block">
                        {config.host || "smtp.zeptomail.com"}
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-on-surface-variant block font-semibold">Port / Secure</span>
                      <span className="text-on-surface font-mono mt-1 block">
                        {config.port || 587} ({config.secure ? "SSL" : "TLS"})
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-on-surface-variant block font-semibold">Username</span>
                      <span className="text-on-surface font-mono mt-1 block">
                        {config.username || "emailapikey"}
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20">
                      <span className="text-on-surface-variant block font-semibold">Password Token</span>
                      <span className="text-primary font-bold mt-1 block">
                        {config.hasPassword ? "•••••••• Encrypted" : "Not Set"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 col-span-2">
                      <span className="text-on-surface-variant block font-semibold">ZeptoMail API Endpoint</span>
                      <span className="text-on-surface font-mono mt-1 block">
                        https://api.zeptomail.{config.region}/v1.1/email
                      </span>
                    </div>
                    <div className="bg-surface-container p-3.5 rounded-2xl border border-outline-variant/20 col-span-2">
                      <span className="text-on-surface-variant block font-semibold">API Send Token</span>
                      <span className="text-primary font-bold mt-1 block">
                        {config.hasApiToken ? "•••••••• Encrypted (Zoho-enczapikey)" : "Not Set"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Senders overview strip */}
              <div className="bg-surface-container/60 rounded-2xl p-3.5 border border-outline-variant/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-base text-primary">group</span>
                  <span>
                    Senders registered:{" "}
                    <strong className="text-on-surface font-semibold">
                      {config.senders.map((s) => s.email).join(", ") || "None registered yet"}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => setActiveSenderConfig(config)}
                  className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Manage Senders</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Config Modal */}
      <AppModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        maxWidth="max-w-lg"
        panelClassName="p-6 space-y-6"
      >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <h2 className="text-2xl font-headline font-bold text-on-surface">
                Add ZeptoMail Connection
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateConfig} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Connection Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Primary Transactional Mailer"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Mode
                  </label>
                  <select
                    value={formData.mode}
                    onChange={(e) =>
                      setFormData({ ...formData, mode: e.target.value as "SMTP" | "API" })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  >
                    <option value="SMTP">SMTP Relay</option>
                    <option value="API">ZeptoMail Send API</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Region Domain
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  >
                    <option value="com">Global (.com)</option>
                    <option value="eu">Europe (.eu)</option>
                    <option value="in">India (.in)</option>
                    <option value="com.cn">China (.com.cn)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Verified Domain (from ZeptoMail console)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mycompany.com"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {formData.mode === "API" && (
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Bounce Address (required for API)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. bounce@bounce.mycompany.com"
                    value={formData.bounceAddress}
                    onChange={(e) => setFormData({ ...formData, bounceAddress: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    Copy the exact address from ZeptoMail → Domains (e.g.{" "}
                    <span className="font-mono">prefix@bounce.yourdomain.com</span>).
                  </p>
                </div>
              )}

              {formData.mode === "SMTP" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                        Port
                      </label>
                      <input
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                      SMTP Username
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                      SMTP Password Token
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Send-mail token from ZeptoMail"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    API Send Token (Zoho-enczapikey)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="e.g. wAuthToken..."
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  />
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Connection</span>
                </button>
              </div>
            </form>
      </AppModal>

      {/* Manage Senders Drawer/Modal */}
      <AppModal
        open={Boolean(activeSenderConfig)}
        onClose={() => setActiveSenderConfig(null)}
        maxWidth="max-w-md"
        panelClassName="p-6 space-y-6"
      >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">Manage Senders</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Domain: <span className="text-primary font-bold">{activeSenderConfig.domain}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveSenderConfig(null)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Add Sender Form */}
            <form onSubmit={handleAddSender} className="space-y-3 bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Add Sender Email
              </span>
              <div className="space-y-2">
                <input
                  type="email"
                  required
                  placeholder={`e.g. support@${activeSenderConfig.domain}`}
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="Display Name (e.g. Support Team)"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={addingSender}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {addingSender ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base">add</span>
                )}
                <span>Add Sender</span>
              </button>
            </form>

            {/* Sender List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Current Senders ({activeSenderConfig.senders.length})
              </span>
              {activeSenderConfig.senders.length === 0 ? (
                <div className="text-xs text-on-surface-variant text-center py-6 bg-surface-container/30 rounded-2xl border border-dashed border-outline-variant/30">
                  No senders added for this domain yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-theme">
                  {activeSenderConfig.senders.map((sender) => (
                    <div
                      key={sender.id}
                      className="flex items-center justify-between p-3.5 bg-surface-container/60 rounded-2xl border border-outline-variant/20 text-xs"
                    >
                      <div>
                        <div className="font-bold text-on-surface">{sender.email}</div>
                        {sender.displayName && (
                          <div className="text-on-surface-variant text-[11px] mt-0.5">
                            {sender.displayName}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSender(activeSenderConfig.id, sender.id)}
                        className="p-1.5 text-on-surface-variant hover:text-error transition cursor-pointer"
                        title="Remove sender"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
      </AppModal>
    </div>
  );
}
