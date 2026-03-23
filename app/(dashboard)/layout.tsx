"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { useCommandPalette } from "@/lib/hooks/useCommandPalette";
import { AlertTriangle, Ban } from "lucide-react";
import { PomodoroProvider } from "@/lib/contexts/PomodoroContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open, setOpen } = useCommandPalette();
  const [dbMissing, setDbMissing] = useState(false);
  const [banInfo, setBanInfo] = useState<{ banned: boolean; bannedUntil: string | null; isPermanent: boolean } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Only check once, skip on the setup page itself
    if (pathname === "/setup") return;
    fetch("/api/health")
      .then((r) => r.json())
      .then((json) => { if (!json.ok) setDbMissing(true); })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((json) => { if (json.banned) setBanInfo(json); })
      .catch(() => {});
  }, []);

  if (banInfo?.banned) {
    const until = banInfo.bannedUntil ? new Date(banInfo.bannedUntil) : null;
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0 p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center mx-auto">
            <Ban className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground">You&apos;ve been banned.</h1>
          <p className="text-sm text-muted-foreground">
            {banInfo.isPermanent
              ? "You have been permanently banned from this platform."
              : until
                ? `Come back when the ban period ends. Your ban expires on ${until.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at ${until.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`
                : "Come back when the ban period ends."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Sidebar — hidden on mobile, shown md+ */}
      <div className="hidden md:flex">
        <Sidebar onCommandPalette={() => setOpen(true)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-10 glass border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gradient-animated">MikeSmart</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg bg-surface-3 border border-border text-muted-foreground"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* DB missing banner */}
        {dbMissing && pathname !== "/setup" && (
          <div className="bg-amber-950/40 border-b border-amber-900/50 px-4 py-2.5 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300 flex-1">
              Database tables are not set up yet — the app won&apos;t work until you run the schema.
            </p>
            <Link
              href="/setup"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0"
            >
              Fix it →
            </Link>
          </div>
        )}

        <PomodoroProvider>{children}</PomodoroProvider>
      </main>

      {/* Command Palette */}
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
