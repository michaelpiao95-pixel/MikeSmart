"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Users, UserPlus, Search, Check, X, Clock, UserCheck, Zap } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
}

interface DiscoverProfile extends Profile {
  mutuals: number;
}

interface FriendRequest {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

function Avatar({ name, email, avatarUrl, size = "md" }: { name: string | null; email: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const safeEmail = email || "?";
  const initials = name
    ? name.split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2)
    : safeEmail[0].toUpperCase();
  const colors = ["bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-blue-600", "bg-purple-600", "bg-pink-600"];
  const color = colors[safeEmail.charCodeAt(0) % colors.length];
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? email}
        className={cn("rounded-full object-cover shrink-0", sizeClass)}
      />
    );
  }
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
      color,
      sizeClass
    )}>
      {initials}
    </div>
  );
}

export default function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "add">("friends");
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [discover, setDiscover] = useState<DiscoverProfile[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true);
    const [friendsRes, requestsRes] = await Promise.all([
      fetch("/api/friends"),
      fetch("/api/friends/requests"),
    ]);
    const friendsJson = await friendsRes.json();
    const requestsJson = await requestsRes.json();
    setFriends(friendsJson.data ?? []);
    setIncoming(requestsJson.data?.incoming ?? []);
    setOutgoing(requestsJson.data?.outgoing ?? []);
    setLoadingFriends(false);
  }, []);

  const loadDiscover = useCallback(async () => {
    setLoadingDiscover(true);
    const res = await fetch("/api/friends/discover");
    const json = await res.json();
    setDiscover(json.data ?? []);
    setLoadingDiscover(false);
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  useEffect(() => {
    if (tab === "add") loadDiscover();
  }, [tab, loadDiscover]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSendResult(null);
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: searchEmail.trim() }),
    });
    const json = await res.json();
    if (res.ok) {
      setSendResult({ ok: true, message: "Friend request sent!" });
      setSearchEmail("");
      loadFriends();
      loadDiscover();
    } else {
      setSendResult({ ok: false, message: json.error ?? "Something went wrong" });
    }
    setSearching(false);
  };

  const handleQuickAdd = async (profile: DiscoverProfile) => {
    setSendingId(profile.id);
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: profile.email }),
    });
    if (res.ok) {
      setSentIds((prev) => new Set(prev).add(profile.id));
      loadFriends();
    }
    setSendingId(null);
  };

  const handleRespond = async (id: string, action: "accept" | "decline") => {
    await fetch(`/api/friends/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadFriends();
    loadDiscover();
  };

  const pendingCount = incoming.length;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
        <p className="text-sm text-muted-foreground mt-1">Add friends and track each other on the leaderboard.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-3 rounded-full p-1 gap-0.5 w-fit">
        {(["friends", "add"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-full font-medium transition-all flex items-center gap-1.5",
              tab === t ? "bg-surface-0 text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "friends" ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {t === "friends" ? "Friends" : "Add Friends"}
            {t === "friends" && friends.length > 0 && (
              <span className="text-xs bg-brand-600/20 text-brand-400 px-1.5 rounded-full">{friends.length}</span>
            )}
            {t === "add" && pendingCount > 0 && (
              <span className="text-xs bg-red-600/20 text-red-400 px-1.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        <div className="space-y-4">
          {loadingFriends ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-16 bg-surface-2 border border-border rounded-xl">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No friends yet.</p>
              <button
                onClick={() => setTab("add")}
                className="mt-3 text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                Add your first friend →
              </button>
            </div>
          ) : (
            <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border stagger-children">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-4">
                  <Avatar name={f.full_name} email={f.email} avatarUrl={f.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {f.full_name || f.email || "Unknown User"}
                    </p>
                    {f.full_name && f.email && (
                      <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                    )}
                  </div>
                  <span className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-2 py-0.5 rounded-full">
                    Friends
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "add" && (
        <div className="space-y-5">
          {/* Send request by email */}
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-400" />
              Search by email
            </h3>
            <form onSubmit={handleSendRequest} className="flex gap-2">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => { setSearchEmail(e.target.value); setSendResult(null); }}
                placeholder="friend@university.edu"
                className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              <button
                type="submit"
                disabled={searching || !searchEmail.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                {searching ? "Sending..." : "Send"}
              </button>
            </form>
            {sendResult && (
              <p className={cn(
                "mt-2 text-xs px-3 py-2 rounded-lg border",
                sendResult.ok
                  ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/30"
                  : "text-red-400 bg-red-950/20 border-red-900/30"
              )}>
                {sendResult.message}
              </p>
            )}
          </div>

          {/* Quick Add — all users on the platform */}
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Quick Add
              <span className="text-xs text-muted-foreground font-normal">— everyone on the app</span>
            </h3>
            {loadingDiscover ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-border border-t-brand-500 rounded-full animate-spin" />
              </div>
            ) : discover.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No one else to add right now.</p>
            ) : (
              <div className="space-y-2 stagger-children">
                {discover.map((profile) => {
                  const sent = sentIds.has(profile.id);
                  return (
                    <div key={profile.id} className="flex items-center gap-3">
                      <Avatar name={profile.full_name} email={profile.email} avatarUrl={profile.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {profile.full_name ?? profile.email.split("@")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.full_name ? profile.email : null}
                          {profile.mutuals > 0 && (
                            <span className={cn(profile.full_name ? "ml-1.5" : "", "text-brand-400/80")}>
                              {profile.mutuals} mutual{profile.mutuals !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!profile.full_name && profile.mutuals === 0 && profile.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleQuickAdd(profile)}
                        disabled={sent || sendingId === profile.id}
                        className={cn(
                          "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                          sent
                            ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400 cursor-default"
                            : "bg-brand-600/20 border-brand-600/30 text-brand-400 hover:bg-brand-600/30"
                        )}
                      >
                        {sent ? (
                          <><Check className="w-3 h-3" /> Sent</>
                        ) : sendingId === profile.id ? (
                          "..."
                        ) : (
                          <><UserPlus className="w-3 h-3" /> Add</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming requests */}
          {incoming.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Incoming Requests
                <span className="text-xs bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded-full">{incoming.length}</span>
              </h3>
              <div className="space-y-3">
                {incoming.map((req) => (
                  <div key={req.id} className="flex items-center gap-3">
                    <Avatar name={req.sender?.full_name ?? null} email={req.sender?.email ?? ""} avatarUrl={req.sender?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {req.sender?.full_name ?? req.sender?.email}
                      </p>
                      {req.sender?.full_name && (
                        <p className="text-xs text-muted-foreground truncate">{req.sender.email}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRespond(req.id, "accept")}
                        className="w-8 h-8 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/30 text-emerald-400 flex items-center justify-center transition-all"
                        title="Accept"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, "decline")}
                        className="w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 flex items-center justify-center transition-all"
                        title="Decline"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing requests */}
          {outgoing.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Sent Requests
              </h3>
              <div className="space-y-3">
                {outgoing.map((req) => (
                  <div key={req.id} className="flex items-center gap-3">
                    <Avatar name={req.receiver?.full_name ?? null} email={req.receiver?.email ?? ""} avatarUrl={req.receiver?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {req.receiver?.full_name ?? req.receiver?.email}
                      </p>
                      {req.receiver?.full_name && (
                        <p className="text-xs text-muted-foreground truncate">{req.receiver.email}</p>
                      )}
                    </div>
                    <span className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded-full shrink-0">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
