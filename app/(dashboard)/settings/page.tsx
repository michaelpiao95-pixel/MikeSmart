"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SyncButton } from "@/components/canvas/SyncButton";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Database } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name?: string;
  canvas_base_url?: string;
  canvas_api_token_encrypted?: string;
  canvas_last_synced_at?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [canvasUrl, setCanvasUrl] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);
    setUserEmail(user.email ?? "");

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setCanvasUrl(data.canvas_base_url ?? "");
      setFullName(data.full_name ?? "");
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveCanvas = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveResult(null);

    const upsertData: Record<string, string> = {
      id: userId,
      email: userEmail,
      canvas_base_url: canvasUrl.replace(/\/$/, ""),
    };

    if (canvasToken) {
      upsertData.canvas_api_token_encrypted = canvasToken;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(upsertData, { onConflict: "id" });

    if (error) {
      setSaveResult({ ok: false, message: error.message });
    } else {
      setSaveResult({ ok: true, message: "Canvas credentials saved." });
      setJustSaved(true);
      setCanvasToken(""); // clear token field after save
      await load();
    }

    setSaving(false);
    setTimeout(() => setSaveResult(null), 5000);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, email: userEmail, full_name: fullName }, { onConflict: "id" });

    if (!error) setSaveResult({ ok: true, message: "Profile saved." });
    else setSaveResult({ ok: false, message: error.message });
    setSaving(false);
    setTimeout(() => setSaveResult(null), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const tokenToTest = canvasToken || profile?.canvas_api_token_encrypted;
    const urlToTest = canvasUrl || profile?.canvas_base_url;

    if (!tokenToTest || !urlToTest) {
      setTestResult({ ok: false, message: "Enter Canvas URL and token first." });
      setTesting(false);
      return;
    }

    try {
      const res = await fetch("/api/canvas/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_base_url: urlToTest,
          canvas_api_token: tokenToTest,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: `Connected as: ${json.data.name}` });
      } else {
        setTestResult({ ok: false, message: json.error ?? "Connection failed." });
      }
    } catch {
      setTestResult({ ok: false, message: "Unexpected error. Try again." });
    }

    setTesting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Canvas, your profile, and preferences.
        </p>
      </div>

      {/* Canvas Integration */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Canvas LMS</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect your school's Canvas to auto-import assignments.
            </p>
          </div>
          {profile?.canvas_base_url && profile?.canvas_api_token_encrypted && (
            <SyncButton
              lastSyncedAt={profile.canvas_last_synced_at}
              onSyncComplete={load}
            />
          )}
        </div>

        <div className="space-y-4">
          {/* Canvas URL */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Canvas Base URL
            </label>
            <input
              type="url"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              placeholder="https://canvas.yourschool.edu"
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              The domain your school uses for Canvas (no trailing slash).
            </p>
          </div>

          {/* API Token */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Canvas API Token
            </label>
            <input
              type="password"
              value={canvasToken}
              onChange={(e) => setCanvasToken(e.target.value)}
              placeholder={
                profile?.canvas_api_token_encrypted
                  ? "••••••••••• (token saved — enter new to replace)"
                  : "Paste your API token here"
              }
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition font-mono"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              Generate at:{" "}
              <span className="text-brand-400">
                Canvas → Account → Settings → Approved Integrations → New Access Token
              </span>
            </p>
          </div>

          {/* Test + save result */}
          {testResult && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm p-3 rounded-lg border",
                testResult.ok
                  ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
                  : "bg-red-950/30 border-red-900/50 text-red-400"
              )}
            >
              {testResult.ok ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          {saveResult && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm p-3 rounded-lg border",
                saveResult.ok
                  ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"
                  : "bg-red-950/30 border-red-900/50 text-red-400"
              )}
            >
              {saveResult.ok ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {saveResult.message}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCanvas}
              disabled={saving || !userId || (!canvasUrl && !canvasToken)}
            >
              {saving ? "Saving..." : "Save Canvas Settings"}
            </Button>
          </div>

          {/* Sync Now prompt after successful save */}
          {justSaved && profile?.canvas_base_url && profile?.canvas_api_token_encrypted && (
            <div className="flex items-center gap-3 p-3 bg-brand-950/30 border border-brand-800/40 rounded-lg mt-2">
              <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
              <p className="text-sm text-brand-300 flex-1">
                Credentials saved! Sync now to import your courses and assignments.
              </p>
              <SyncButton
                lastSyncedAt={profile.canvas_last_synced_at}
                onSyncComplete={() => { setJustSaved(false); load(); }}
              />
            </div>
          )}
        </div>

        {/* How to get token guide */}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            How to generate a Canvas API token
          </summary>
          <ol className="mt-3 space-y-1.5 text-muted-foreground text-sm list-decimal list-inside">
            <li>Log in to your Canvas account</li>
            <li>Click your profile picture → <strong>Account</strong></li>
            <li>Click <strong>Settings</strong></li>
            <li>Scroll to <strong>Approved Integrations</strong></li>
            <li>Click <strong>+ New Access Token</strong></li>
            <li>Give it a purpose (e.g., "Student Dashboard") and click Generate</li>
            <li>Copy the token and paste it above</li>
          </ol>
        </details>
      </section>

      {/* Profile */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full bg-surface-3/50 border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
            Save Profile
          </Button>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Keyboard Shortcuts
        </h2>
        <div className="space-y-2">
          {[
            { key: "⌘K", label: "Open command palette" },
            { key: "G T", label: "Go to Today" },
            { key: "G A", label: "Go to Assignments" },
            { key: "G C", label: "Go to Courses" },
            { key: "G F", label: "Go to Focus" },
            { key: "G L", label: "Go to Analytics" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{label}</span>
              <kbd className="text-xs font-mono bg-surface-3 border border-border px-2 py-1 rounded text-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Database Setup */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Database Setup</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          If you see "relation does not exist" errors, your Supabase database tables haven&apos;t been created yet.
        </p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside mb-3">
          <li>Open your Supabase project dashboard</li>
          <li>Go to <strong className="text-foreground">SQL Editor</strong></li>
          <li>Paste and run the contents of <code className="font-mono bg-surface-3 px-1 rounded">supabase/schema.sql</code></li>
          <li>Refresh this page</li>
        </ol>
      </section>

      {/* Sign out */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Account</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Signed in as{" "}
          <span className="text-foreground font-medium">{userEmail}</span>
        </p>
        <Button variant="destructive" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
