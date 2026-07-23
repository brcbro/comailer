"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/app-modal";

type ClientUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type ClientOrg = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  users: ClientUser[];
  _count?: {
    smtpConfigs: number;
    templates: number;
    campaigns: number;
    dripCampaigns: number;
  };
};

export default function ClientsPage() {
  const [orgs, setOrgs] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    orgName: "",
    email: "",
    password: "",
    userName: "",
  });
  const [resetTarget, setResetTarget] = useState<{
    orgId: string;
    userId: string;
    email: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (res.status === 403) {
        setForbidden(true);
        setOrgs([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to load clients");
      const data = (await res.json()) as ClientOrg[];
      setOrgs(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Client created");
      setCreateOpen(false);
      setForm({ orgName: "", email: "", password: "", userName: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggleOrg(org: ClientOrg) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !org.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      toast.success(org.isActive ? "Client disabled" : "Client enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(orgId: string, user: ClientUser) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toggleUserId: user.id,
          userIsActive: !user.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      toast.success(user.isActive ? "User disabled" : "User enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${resetTarget.orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetUserId: resetTarget.userId,
          newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reset failed");
      }
      toast.success("Password updated");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrg(org: ClientOrg) {
    if (org.id === "org_internal_default") {
      toast.error("Cannot delete the Internal organization");
      return;
    }
    if (!confirm(`Delete client "${org.name}" and all of their data?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${org.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Client deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        You do not have access to client management.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
            Clients
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Create and manage client organizations. Each client manages their own SMTPs, templates, and campaigns.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          New client
        </button>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Loading clients…
        </div>
      ) : orgs.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center border border-outline-variant/20">
          <p className="text-on-surface-variant text-sm">No clients yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-headline font-bold text-on-surface">
                      {org.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        org.isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-error-container/50 text-error"
                      }`}
                    >
                      {org.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 font-mono">
                    {org.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleOrg(org)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant/30 hover:bg-surface-variant/40 cursor-pointer"
                  >
                    {org.isActive ? "Disable" : "Enable"}
                  </button>
                  {org.id !== "org_internal_default" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => deleteOrg(org)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-error/30 text-error hover:bg-error-container/40 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {org._count && (
                <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
                  <span>{org._count.smtpConfigs} SMTP</span>
                  <span>{org._count.templates} templates</span>
                  <span>{org._count.campaigns} campaigns</span>
                  <span>{org._count.dripCampaigns} drips</span>
                </div>
              )}

              <div className="border-t border-outline-variant/20 pt-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Users
                </h3>
                {org.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-on-surface">
                        {user.email}
                        {!user.isActive && (
                          <span className="ml-2 text-[10px] text-error font-bold">DISABLED</span>
                        )}
                      </p>
                      {user.name && (
                        <p className="text-xs text-on-surface-variant">{user.name}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          setResetTarget({
                            orgId: org.id,
                            userId: user.id,
                            email: user.email,
                          })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-outline-variant/30 hover:bg-surface-variant/40 cursor-pointer"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => toggleUser(org.id, user)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-outline-variant/30 hover:bg-surface-variant/40 cursor-pointer"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        panelClassName="p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-headline font-bold text-on-surface">Create client</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="p-1 rounded-lg hover:bg-surface-variant/50 cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={createClient} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">
              Organization name
            </label>
            <input
              required
              value={form.orgName}
              onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">
              Contact name
            </label>
            <input
              value={form.userName}
              onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">
              Login email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
              placeholder="client@acme.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">
              Password
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 cursor-pointer"
          >
            {creating ? "Creating…" : "Create client"}
          </button>
        </form>
      </AppModal>

      <AppModal
        open={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setNewPassword("");
        }}
        panelClassName="p-6 space-y-4"
      >
        <h2 className="text-xl font-headline font-bold text-on-surface">Reset password</h2>
        <form onSubmit={resetPassword} className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            New password for <strong>{resetTarget?.email}</strong>
          </p>
          <input
            required
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm"
            placeholder="New password"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </AppModal>
    </div>
  );
}
