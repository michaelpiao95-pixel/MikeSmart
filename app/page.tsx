"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ParticleMesh } from "@/components/hero/ParticleMesh";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ─── design tokens ─────────────────────────────────────────────── */
const ACC  = "#7c3aed";
const ACC2 = "#a78bfa";
const CYAN = "#06b6d4";

/* ─── features ──────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "⚡", title: "Canvas Sync",         desc: "Every assignment, deadline, and grade pulled automatically. Zero manual entry." },
  { icon: "🧠", title: "Pomodoro Engine",     desc: "Deep work sessions with streak tracking. Your focus, measured and compounded." },
  { icon: "📊", title: "Grade Calculator",    desc: "Live weighted GPA. Know exactly what you need on finals before it's too late." },
  { icon: "🔥", title: "Streak System",       desc: "Daily task completion streaks with leaderboard. Accountability built in." },
  { icon: "🔗", title: "Command Palette",     desc: "Navigate everything with ⌘K. Every page, action, and sync one keystroke away." },
  { icon: "🚀", title: "Analytics",           desc: "Study hours, completion rate, heatmaps. Data-driven students consistently win." },
];

/* ─── card tilt hook ─────────────────────────────────────────────── */
function useTilt(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { transformPerspective: 800 });

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      gsap.to(el, { rotateY: x * 12, rotateX: -y * 12, duration: 0.3, ease: "power1.out" });
    };
    const onLeave = () => {
      gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.6, ease: "elastic.out(1,0.7)" });
    };

    el.addEventListener("mousemove", onMove as EventListener);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove as EventListener);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [ref]);
}

/* ─── feature card ───────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref);
  return (
    <div ref={ref} className="ms-feature-card">
      <div className="ms-feature-icon">{icon}</div>
      <div className="ms-feature-title">{title}</div>
      <div className="ms-feature-desc">{desc}</div>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────── */
export default function LandingPage() {
  const badgeRef   = useRef<HTMLDivElement>(null);
  const h1Ref      = useRef<HTMLHeadingElement>(null);
  const subRef     = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const featRef    = useRef<HTMLDivElement>(null);
  const ctaRef     = useRef<HTMLDivElement>(null);

  /* ── entrance sequence ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      /* hero sequence — matches reference exactly */
      gsap.to(badgeRef.current,   { opacity: 1, y: 0, duration: 0.8,  delay: 0.3,  ease: "power3.out" });
      gsap.to(h1Ref.current,      { opacity: 1, y: 0, duration: 1.0,  delay: 0.55, ease: "power3.out" });
      gsap.to(subRef.current,     { opacity: 1, y: 0, duration: 0.9,  delay: 0.75, ease: "power3.out" });
      gsap.to(actionsRef.current, { opacity: 1, y: 0, duration: 0.8,  delay: 0.95, ease: "power3.out" });
      gsap.to(scrollRef.current,  { opacity: 1,        duration: 1.0,  delay: 1.8,  ease: "power2.out" });

      /* metrics — scroll triggered */
      if (metricsRef.current) {
        gsap.to(metricsRef.current.querySelectorAll(".ms-metric"), {
          opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out",
          scrollTrigger: { trigger: metricsRef.current, start: "top 85%" },
        });
      }

      /* feature cards — scroll triggered */
      if (featRef.current) {
        gsap.to(featRef.current.querySelectorAll(".ms-feature-card"), {
          opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out",
          scrollTrigger: { trigger: featRef.current, start: "top 85%" },
        });
      }

      /* CTA section */
      if (ctaRef.current) {
        gsap.to(ctaRef.current.querySelectorAll(".ms-cta-child"), {
          opacity: 1, y: 0, duration: 0.7, stagger: 0.15, ease: "power3.out",
          scrollTrigger: { trigger: ctaRef.current, start: "top 85%" },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* fixed Three.js canvas — whole page */}
      <ParticleMesh />

      <div style={{ position: "relative", zIndex: 10 }}>

        {/* ── nav ── */}
        <nav className="ms-nav">
          <Link href="/" className="ms-logo">MikeSmart</Link>
          <ul className="ms-nav-links">
            <li><Link href="#features" className="ms-nav-link">Product</Link></li>
            <li><Link href="#features" className="ms-nav-link">Features</Link></li>
            <li><Link href="/login"    className="ms-nav-link">Docs</Link></li>
            <li><Link href="/login"    className="ms-nav-link ms-nav-cta">Get Started →</Link></li>
          </ul>
        </nav>

        {/* ── hero ── */}
        <section className="ms-hero">
          <div ref={badgeRef} className="ms-badge">
            <span className="ms-badge-dot" />
            Now in public beta — join 2,000+ students
          </div>

          <h1 ref={h1Ref} className="ms-h1">
            The <span className="ms-gradient-text">smartest</span>
            <br />
            way to study.
          </h1>

          <p ref={subRef} className="ms-hero-sub">
            MikeSmart syncs your Canvas courses, calculates your grades in real-time,
            and turns your deadlines into a daily action plan. Stay ahead, always.
          </p>

          <div ref={actionsRef} className="ms-hero-actions">
            <Link href="/login" className="ms-btn-primary">Start for free</Link>
            <Link href="/login" className="ms-btn-ghost">
              See how it works <span className="ms-arrow-icon">→</span>
            </Link>
          </div>

          {/* scroll indicator */}
          <div ref={scrollRef} className="ms-scroll-indicator">
            <span className="ms-scroll-text">Scroll</span>
            <div className="ms-scroll-line" />
          </div>
        </section>

        {/* ── metrics ── */}
        <div ref={metricsRef} className="ms-metrics">
          {[
            { num: "2K+",   label: "Active students" },
            { num: "99.9%", label: "Uptime"          },
            { num: "3×",    label: "Faster studying"  },
            { num: "$0",    label: "To get started"   },
          ].map(({ num, label }) => (
            <div key={label} className="ms-metric">
              <div className="ms-metric-num">{num}</div>
              <div className="ms-metric-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ── features ── */}
        <section id="features" className="ms-features">
          <p className="ms-section-tag">Why MikeSmart</p>
          <h2 className="ms-section-title">
            Built different.
            <br />
            Built to <span className="ms-gradient-text">ship grades.</span>
          </h2>
          <div ref={featRef} className="ms-feature-grid">
            {FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </section>

        {/* ── CTA ── */}
        <section ref={ctaRef} className="ms-cta-section">
          <div className="ms-cta-glow" />
          <h2 className="ms-cta-h2 ms-cta-child">
            Ready to study{" "}
            <span className="ms-gradient-text">smarter?</span>
          </h2>
          <p className="ms-cta-p ms-cta-child">
            Join thousands of students already running on MikeSmart.
          </p>
          <Link href="/login" className="ms-btn-primary ms-cta-child">
            Get started free →
          </Link>
        </section>

        {/* ── footer ── */}
        <footer className="ms-footer">
          <span>© 2025 MikeSmart. All rights reserved.</span>
          <span>Made with 💜 for students everywhere</span>
        </footer>
      </div>

      {/* ── design system styles ── */}
      <style jsx global>{`
        /* ── reset & base ── */
        *, *::before, *::after { box-sizing: border-box; }

        body {
          background: #040407 !important;
          color: #fff;
          font-family: 'Inter', var(--font-geist-sans), sans-serif;
          overflow-x: hidden;
          min-height: 100vh;
        }

        /* ── gradient text (animated) ── */
        .ms-gradient-text {
          background: linear-gradient(135deg, #fff 0%, #7c3aed 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          background-size: 200% 200%;
          animation: ms-gradient-shift 4s ease-in-out infinite;
        }
        @keyframes ms-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }

        /* ── nav ── */
        .ms-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 48px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(4,4,7,0.4);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .ms-logo {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
        }
        .ms-nav-links {
          display: flex;
          gap: 36px;
          list-style: none;
          margin: 0; padding: 0;
          align-items: center;
        }
        .ms-nav-link {
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }
        .ms-nav-link:hover { color: #fff; }
        .ms-nav-cta {
          background: #7c3aed;
          color: #fff !important;
          padding: 10px 22px;
          border-radius: 8px;
          font-weight: 500 !important;
          transition: background 0.2s, transform 0.15s !important;
        }
        .ms-nav-cta:hover { background: #6d28d9 !important; transform: translateY(-1px); }

        /* ── hero ── */
        .ms-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 24px;
        }
        .ms-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.4);
          border-radius: 100px;
          padding: 8px 18px;
          font-size: 13px;
          color: #a78bfa;
          margin-bottom: 32px;
          opacity: 0;
          transform: translateY(20px);
        }
        .ms-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          animation: ms-pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes ms-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        .ms-h1 {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -3px;
          margin-bottom: 24px;
          opacity: 0;
          transform: translateY(40px);
          max-width: 900px;
        }
        .ms-hero-sub {
          font-size: 18px;
          color: rgba(255,255,255,0.5);
          font-weight: 300;
          max-width: 520px;
          line-height: 1.7;
          margin-bottom: 48px;
          opacity: 0;
          transform: translateY(30px);
        }
        .ms-hero-actions {
          display: flex;
          gap: 16px;
          align-items: center;
          opacity: 0;
          transform: translateY(20px);
        }

        /* ── buttons ── */
        .ms-btn-primary {
          background: #7c3aed;
          color: #fff;
          padding: 16px 36px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          text-decoration: none;
          border: none;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 40px rgba(124,58,237,0.4);
          display: inline-block;
        }
        .ms-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .ms-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 60px rgba(124,58,237,0.6); }
        .ms-btn-primary:hover::before { opacity: 1; }

        .ms-btn-ghost {
          color: rgba(255,255,255,0.6);
          font-size: 15px;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color 0.2s;
        }
        .ms-btn-ghost:hover { color: #fff; }
        .ms-arrow-icon {
          width: 20px; height: 20px;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          transition: transform 0.2s, border-color 0.2s;
        }
        .ms-btn-ghost:hover .ms-arrow-icon { transform: translateX(3px); border-color: rgba(255,255,255,0.6); }

        /* ── scroll indicator ── */
        .ms-scroll-indicator {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          opacity: 0;
        }
        .ms-scroll-text {
          font-size: 11px;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
        }
        .ms-scroll-line {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
          animation: ms-scroll-anim 2s ease-in-out infinite;
        }
        @keyframes ms-scroll-anim {
          0%, 100% { transform: scaleY(1); opacity: 1; }
          50%       { transform: scaleY(0.5); opacity: 0.4; }
        }

        /* ── metrics ── */
        .ms-metrics {
          display: flex;
          justify-content: center;
          gap: 80px;
          padding: 60px 48px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
        }
        .ms-metric {
          text-align: center;
          opacity: 0;
          transform: translateY(20px);
        }
        .ms-metric-num {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -2px;
          background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ms-metric-label {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin-top: 4px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* ── features ── */
        .ms-features {
          padding: 80px 48px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .ms-section-tag {
          font-size: 12px;
          color: #7c3aed;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .ms-section-title {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 800;
          letter-spacing: -2px;
          margin-bottom: 64px;
          max-width: 600px;
          line-height: 1.1;
        }
        .ms-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 900px) { .ms-feature-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 560px) { .ms-feature-grid { grid-template-columns: 1fr; } }

        .ms-feature-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 32px;
          cursor: default;
          transition: border-color 0.3s, background 0.3s;
          opacity: 0;
          transform: translateY(30px);
        }
        .ms-feature-card:hover {
          border-color: rgba(124,58,237,0.4);
          background: rgba(124,58,237,0.05);
        }
        .ms-feature-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: rgba(124,58,237,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 20px;
        }
        .ms-feature-title {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #fff;
        }
        .ms-feature-desc {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          line-height: 1.6;
        }

        /* ── cta ── */
        .ms-cta-section {
          position: relative;
          text-align: center;
          padding: 100px 48px;
          overflow: hidden;
        }
        .ms-cta-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px; height: 300px;
          background: radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%);
          pointer-events: none;
        }
        .ms-cta-h2 {
          font-family: var(--font-syne), 'Syne', sans-serif;
          font-size: clamp(36px, 5vw, 64px);
          font-weight: 800;
          letter-spacing: -2px;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .ms-cta-p {
          color: rgba(255,255,255,0.45);
          font-size: 16px;
          margin-bottom: 40px;
          position: relative;
          z-index: 1;
        }
        .ms-cta-child {
          opacity: 0;
          transform: translateY(20px);
          position: relative;
          z-index: 1;
        }

        /* ── footer ── */
        .ms-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 32px 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: rgba(255,255,255,0.25);
          font-size: 13px;
          flex-wrap: wrap;
          gap: 12px;
        }

        /* ── nav responsive ── */
        @media (max-width: 640px) {
          .ms-nav { padding: 16px 24px; }
          .ms-nav-links { gap: 20px; }
          .ms-metrics { gap: 40px; padding: 40px 24px; }
          .ms-features { padding: 60px 24px; }
          .ms-footer { padding: 24px; flex-direction: column; text-align: center; }
        }
      `}</style>
    </>
  );
}
