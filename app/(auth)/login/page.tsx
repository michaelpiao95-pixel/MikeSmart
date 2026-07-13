"use client";

import { useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";
import { ParticleMesh } from "@/components/hero/ParticleMesh";
import { useEffect, useRef } from "react";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState<"signin" | "signup">("signin");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [message,  setMessage]  = useState<string | null>(null);

  const cardRef  = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef  = useRef<HTMLFormElement>(null);

  const supabase = createClient();

  /* entrance animation */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(titleRef.current, { opacity: 1, y: 0, duration: 0.8,  delay: 0.2, ease: "power3.out" });
      gsap.to(cardRef.current,  { opacity: 1, y: 0, duration: 0.75, delay: 0.45, ease: "power3.out" });
    });
    return () => ctx.revert();
  }, []);

  /* tilt on card */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    gsap.set(el, { transformPerspective: 800 });
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      gsap.to(el, { rotateY: x * 8, rotateX: -y * 8, duration: 0.3, ease: "power1.out" });
    };
    const onLeave = () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "elastic.out(1,0.7)" });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/home";
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/home` },
      });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  return (
    <>
      <ParticleMesh />

      <div style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", background: "transparent" }}>

        <Link href="/" style={{ position: "absolute", top: 24, left: 48, fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
          ← Back
        </Link>

        {/* title */}
        <h1 ref={titleRef} style={{ fontFamily: "var(--font-syne,'Syne',sans-serif)", fontSize: 36, fontWeight: 800, letterSpacing: "-2px", marginBottom: 32, opacity: 0, transform: "translateY(20px)", background: "linear-gradient(135deg, #fff 0%, #a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          MikeSmart
        </h1>

        {/* card */}
        <div ref={cardRef} style={{ width: "100%", maxWidth: 400, opacity: 0, transform: "translateY(30px)" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 36, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

            {/* mode toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 28, border: "1px solid rgba(255,255,255,0.06)" }}>
              {(["signin", "signup"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null); }}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s", background: mode === m ? "#7c3aed" : "transparent", color: mode === m ? "#fff" : "rgba(255,255,255,0.4)", boxShadow: mode === m ? "0 0 20px rgba(124,58,237,0.3)" : "none" }}>
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Email",    type: "email",    val: email,    setter: setEmail,    ph: "you@university.edu" },
                { label: "Password", type: "password", val: password, setter: setPassword, ph: "••••••••" },
              ].map(({ label, type, val, setter, ph }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                    {label}
                  </label>
                  <input type={type} value={val} onChange={e => setter(e.target.value)} required placeholder={ph}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#fff", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" }}
                    onFocus={e => { e.target.style.borderColor = "rgba(124,58,237,0.5)"; e.target.style.boxShadow = "0 0 0 2px rgba(124,58,237,0.15)"; }}
                    onBlur={e  => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                </div>
              ))}

              {error && (
                <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                  {error}
                </div>
              )}
              {message && (
                <div style={{ fontSize: 13, color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "10px 14px" }}>
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ marginTop: 8, background: "#7c3aed", border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 0 40px rgba(124,58,237,0.4)", transition: "transform 0.2s, box-shadow 0.2s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(124,58,237,0.6)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(124,58,237,0.4)"; }}>
                {loading ? "..." : mode === "signin" ? "Sign in →" : "Create account →"}
              </button>
            </form>
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 16 }}>
            Your productivity, your data. Always private.
          </p>
        </div>
      </div>

      <style jsx global>{`
        body { background: #040407 !important; }
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </>
  );
}
