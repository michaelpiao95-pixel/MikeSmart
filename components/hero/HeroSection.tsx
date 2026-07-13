"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ParticleMesh } from "./ParticleMesh";
import { ArrowRight, Zap, ChevronRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ─── glassmorphism CTA card with GSAP tilt ────────────────────── */
function TiltCTACard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const xTo = gsap.quickSetter(card, "rotateX", "deg") as (v: number) => void;
    const yTo = gsap.quickSetter(card, "rotateY", "deg") as (v: number) => void;
    const scaleTo = gsap.quickSetter(card, "scale") as (v: number) => void;

    gsap.set(card, { transformPerspective: 900, transformStyle: "preserve-3d" });

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      xTo(((e.clientY - cy) / (rect.height / 2)) * -9);
      yTo(((e.clientX - cx) / (rect.width / 2)) * 9);

      /* spotlight follow */
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      glow.style.background = `radial-gradient(120px at ${px}% ${py}%, rgba(124,58,237,0.2), transparent 70%)`;
    };

    const onEnter = () => scaleTo(1.03);
    const onLeave = () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.55, ease: "power3.out" });
      glow.style.background = "none";
    };

    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseenter", onEnter);
    card.addEventListener("mouseleave", onLeave);
    return () => {
      card.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseenter", onEnter);
      card.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <Link href="/login" className="block w-full max-w-sm mx-auto">
      <div ref={cardRef} className="relative rounded-2xl overflow-hidden cursor-pointer group">
        {/* border gradient */}
        <div className="absolute inset-0 rounded-2xl p-px"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(124,58,237,0.1), rgba(124,58,237,0.4))" }}>
          <div className="absolute inset-0 rounded-2xl" style={{ background: "#0d0b14" }} />
        </div>

        {/* spotlight glow layer */}
        <div ref={glowRef} className="absolute inset-0 rounded-2xl pointer-events-none z-10" />

        {/* content */}
        <div className="relative z-20 flex items-center gap-4 px-5 py-4"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)" }}>
          <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
            <Zap className="w-4 h-4" style={{ color: "#a78bfa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
              Start your command center
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>
              Free forever · No credit card
            </div>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: "rgba(167,139,250,0.6)" }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── hero ──────────────────────────────────────────────────────── */
export function HeroSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const badgeRef    = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtextRef  = useRef<HTMLParagraphElement>(null);
  const ctaRef      = useRef<HTMLDivElement>(null);
  const proofRef    = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      /* badge */
      tl.fromTo(badgeRef.current,
        { opacity: 0, y: -14, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6 }
      );

      /* headline — char stagger */
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "chars,words" });
        gsap.set(headlineRef.current, { opacity: 1 });
        tl.fromTo(split.chars,
          { opacity: 0, y: 48, rotateX: -70, filter: "blur(8px)" },
          {
            opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)",
            duration: 0.6, stagger: 0.018, ease: "back.out(1.6)",
          },
          "-=0.3"
        );
      }

      /* subtext */
      tl.fromTo(subtextRef.current,
        { opacity: 0, y: 20, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.65 },
        "-=0.4"
      );

      /* CTA */
      tl.fromTo(ctaRef.current,
        { opacity: 0, scale: 0.9, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" },
        "-=0.4"
      ).to(ctaRef.current, {
        boxShadow: "0 0 60px rgba(124,58,237,0.3)",
        duration: 1.2, repeat: 1, yoyo: true, ease: "sine.inOut",
      });

      /* social proof */
      tl.fromTo(proofRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45 },
        "-=0.8"
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [ready]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden px-6"
      style={{ background: "#040407" }}
    >
      {/* Three.js canvas */}
      <ParticleMesh />

      {/* radial vignette — fades edges of particle field */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 75% 55% at 50% 50%, transparent 25%, #040407 100%)",
        zIndex: 1,
      }} />

      {/* bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-56 pointer-events-none" style={{
        background: "linear-gradient(to bottom, transparent, #040407)",
        zIndex: 1,
      }} />

      {/* content */}
      <div className="relative z-10 flex flex-col items-center gap-7 max-w-3xl w-full">

        {/* badge */}
        <div ref={badgeRef} style={{ opacity: 0 }}>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
            style={{
              border: "1px solid rgba(124,58,237,0.3)",
              background: "rgba(124,58,237,0.08)",
              color: "#c4b5fd",
              backdropFilter: "blur(8px)",
            }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: "#a78bfa" }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#7c3aed" }} />
            </span>
            Canvas sync · live in 30 seconds
            <ChevronRight className="w-3 h-3 opacity-50" />
          </span>
        </div>

        {/* headline — Syne font */}
        <h1
          ref={headlineRef}
          className="font-syne font-bold leading-[1.05] tracking-[-0.03em]"
          style={{
            fontSize: "clamp(2.8rem, 6.5vw, 5.5rem)",
            opacity: 0,
            perspective: "900px",
            color: "#fff",
          }}
        >
          The student OS{" "}
          <br />
          <span style={{
            background: "linear-gradient(105deg, #a78bfa 0%, #7c3aed 45%, #c084fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            that ships results.
          </span>
        </h1>

        {/* subtext */}
        <p
          ref={subtextRef}
          className="max-w-[520px] leading-relaxed"
          style={{
            fontSize: "1.05rem",
            opacity: 0,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          Connect your Canvas once. Every deadline, grade, and focus session lands
          in one command center. Stop juggling. Start shipping.
        </p>

        {/* CTA card */}
        <div ref={ctaRef} style={{ opacity: 0 }} className="w-full max-w-sm">
          <TiltCTACard />
        </div>

        {/* social proof */}
        <div ref={proofRef}
          className="flex items-center gap-2.5 text-xs"
          style={{ opacity: 0, color: "rgba(255,255,255,0.22)" }}>
          <div className="flex -space-x-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full border-2"
                style={{
                  borderColor: "#040407",
                  background: `linear-gradient(135deg, hsl(${260 + i * 15},65%,55%), hsl(${275 + i * 15},70%,45%))`,
                }} />
            ))}
          </div>
          <span>2,000+ students already in</span>
        </div>
      </div>
    </section>
  );
}
