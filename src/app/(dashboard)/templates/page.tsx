"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string;
  type: "TEXT" | "HTML";
  body: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / Editor State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    type: "HTML" as "HTML" | "TEXT",
    body: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading templates");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setFormData({
      name: "",
      subject: "",
      type: "HTML",
      body: `<div style="font-family: sans-serif; padding: 24px; color: #2e3230; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e4e0d8;">\n  <h2 style="color: #4a7c59; font-family: serif; margin-bottom: 16px;">Hello {{name}},</h2>\n  <p style="line-height: 1.6; color: #4a4e4a;">Thank you for connecting with us! We have exciting updates to share with you.</p>\n  <div style="margin-top: 24px;">\n    <a href="https://example.com" style="background-color: #4a7c59; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Learn More</a>\n  </div>\n</div>`,
    });
    setPreviewMode(false);
    setShowModal(true);
  }

  function openEditModal(template: Template) {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      subject: template.subject,
      type: template.type,
      body: template.body,
    });
    setPreviewMode(false);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save template");
      }

      setShowModal(false);
      await fetchTemplates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving template");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchTemplates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting template");
    }
  }

  function insertTag(tag: string) {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + tag,
    }));
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Page Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-on-background tracking-tight">
            Mail Templates
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Create and manage reusable TEXT and HTML email templates with live preview.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-5 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer w-fit"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>New Template</span>
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
          <span>Loading email templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-surface-container rounded-3xl p-12 text-center space-y-4 border border-outline-variant/20">
          <div className="size-16 bg-surface-container-high text-on-surface-variant rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">description</span>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              No email templates created
            </h3>
            <p className="text-xs text-on-surface-variant">
              Build your first HTML or Text email template with personalization variables.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Create First Template</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-surface-container-low border border-outline-variant/20 rounded-3xl p-6 space-y-4 hover:border-primary/30 transition-all flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline font-bold text-on-surface text-lg">
                        {tpl.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${
                          tpl.type === "HTML"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-tertiary/10 text-tertiary border-tertiary/20"
                        }`}
                      >
                        {tpl.type}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium truncate max-w-sm">
                      Subject: <span className="text-on-surface font-semibold">{tpl.subject}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tpl)}
                      className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition cursor-pointer"
                      title="Edit template"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/40 rounded-xl transition cursor-pointer"
                      title="Delete template"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container rounded-2xl p-3.5 border border-outline-variant/20 max-h-32 overflow-hidden text-xs text-on-surface-variant font-mono">
                  {tpl.type === "TEXT" ? (
                    <p className="whitespace-pre-wrap">{tpl.body}</p>
                  ) : (
                    <div className="truncate">{tpl.body}</div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
                <span>Updated: {new Date(tpl.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={() => openEditModal(tpl)}
                  className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Preview & Edit</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor / Live Preview Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-4xl p-6 space-y-6 shadow-2xl max-h-[90vh] flex flex-col animate-fade-in-up scrollbar-theme">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-headline font-bold text-on-surface">
                  {editingId ? "Edit Template" : "New Email Template"}
                </h2>
                <div className="flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      !previewMode
                        ? "bg-surface-container-lowest text-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">code</span>
                    <span>Editor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      previewMode
                        ? "bg-surface-container-lowest text-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    <span>Live Preview</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 text-xs pr-1 scrollbar-theme">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Template Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Welcome Email"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Format
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as "HTML" | "TEXT" })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                  >
                    <option value="HTML">HTML Email</option>
                    <option value="TEXT">Plain Text</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Welcome {{name}} to our platform!"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Personalization Tag Chips */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-on-surface-variant font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-tertiary">auto_awesome</span>
                  <span>Insert Variable:</span>
                </span>
                {["{{name}}", "{{email}}"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg border border-outline-variant/30 cursor-pointer font-mono font-bold"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              {/* Content / Preview Split */}
              {!previewMode ? (
                <div className="space-y-1.5">
                  <label className="font-bold text-on-surface-variant uppercase tracking-wider block">
                    Body Content
                  </label>
                  <textarea
                    rows={12}
                    required
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    className="w-full p-4 bg-surface-container border border-outline-variant/30 rounded-2xl text-on-surface font-mono text-xs focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-3 border border-outline-variant/20 rounded-2xl p-4 bg-surface-container-low">
                  <div className="text-xs text-on-surface-variant pb-2 border-b border-outline-variant/20">
                    <strong>Subject Preview:</strong>{" "}
                    <span className="text-on-surface font-semibold">
                      {formData.subject.replace("{{name}}", "John Doe").replace("{{email}}", "john@example.com")}
                    </span>
                  </div>

                  {formData.type === "HTML" ? (
                    <div className="bg-white rounded-xl p-2 min-h-[300px] border border-outline-variant/20 shadow-inner">
                      <iframe
                        title="HTML Live Preview"
                        srcDoc={formData.body
                          .replace("{{name}}", "John Doe")
                          .replace("{{email}}", "john@example.com")}
                        className="w-full h-[300px] border-0 rounded-lg"
                      />
                    </div>
                  ) : (
                    <pre className="p-4 bg-surface-container-lowest rounded-xl text-on-surface text-xs font-mono whitespace-pre-wrap min-h-[300px] border border-outline-variant/20">
                      {formData.body
                        .replace("{{name}}", "John Doe")
                        .replace("{{email}}", "john@example.com")}
                    </pre>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  <span>{editingId ? "Update Template" : "Save Template"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
