"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 sm:p-12 overflow-hidden bg-background text-on-background selection:bg-primary/20">
      <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-primary/10 blur-[100px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-tertiary/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: "-3s" }}></div>
        <div className="absolute top-[30%] right-[15%] w-[30%] h-[30%] bg-secondary/10 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: "-6s" }}></div>
      </div>

      <main className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center p-3.5 bg-primary/10 rounded-2xl mb-2">
            <span className="material-symbols-outlined text-primary text-4xl">
              alternate_email
            </span>
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">
            Comailer
          </h1>
          <p className="text-on-surface-variant font-body text-sm">
            Refined communication for the modern web.
          </p>
        </div>

        <div className="glass rounded-2xl p-8 sm:p-10 shadow-xl border border-outline-variant/30">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-on-surface-variant px-1">
                Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
                    mail
                  </span>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="block w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-on-surface-variant px-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-11 py-3.5 bg-surface-container-low border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-error-container/60 border border-error/20 rounded-xl text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-6 border border-transparent text-sm font-bold rounded-xl text-on-primary bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all active:scale-[0.98] shadow-md cursor-pointer disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center border-t border-outline-variant/20 pt-6 text-xs text-on-surface-variant">
            <span>Powered by </span>
            <strong className="text-primary font-semibold">CohortIX mail suit</strong>
          </div>
        </div>
      </main>
    </div>
  );
}
