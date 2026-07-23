import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <Sidebar />

      {/* Top AppBar */}
      <header className="fixed top-0 left-72 right-0 h-16 flex items-center justify-between px-8 bg-background/80 backdrop-blur-md z-40 border-b border-outline-variant/20">
        <div className="flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
              search
            </span>
            <input
              type="text"
              placeholder="Search campaigns, senders, templates..."
              className="w-full pl-11 pr-4 py-2 bg-surface-container border border-outline-variant/20 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs text-on-surface placeholder:text-on-surface-variant/50 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <Link
              href="/smtp"
              className="p-2 rounded-full hover:bg-surface-variant/50 hover:text-primary transition-colors cursor-pointer"
              title="SMTP Configs"
            >
              <span className="material-symbols-outlined text-xl">
                settings_input_component
              </span>
            </Link>
            <Link
              href="/compose"
              className="p-2 rounded-full hover:bg-surface-variant/50 hover:text-primary transition-colors cursor-pointer"
              title="Compose Campaign"
            >
              <span className="material-symbols-outlined text-xl">
                send
              </span>
            </Link>
          </div>

          <div className="h-6 w-px bg-outline-variant/30"></div>

          <div className="flex items-center gap-2.5 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/20">
            <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              A
            </div>
            <span className="text-xs font-semibold text-on-surface pr-1">
              Admin
            </span>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="pl-72 pt-16 min-h-screen">
        <div className="mx-auto max-w-[1500px] p-8">{children}</div>
      </main>
    </div>
  );
}
