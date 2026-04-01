'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
    CloudRain, Wind, Factory, Ban, Wifi, AlertTriangle,
    CheckCircle2, ChevronDown, ArrowUpRight, Shield,
    Clock, Zap, Users, TrendingUp, Activity,
} from 'lucide-react';
import { PLAN_PACKAGES, TRIGGERS } from '@/lib/config/constants';

/* ─── FONTS + GLOBAL STYLES ─────────────────────────── */
const GlobalStyles = () => (
    <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

    :root {
      --cream:   #f5f0e8;
      --cream-d: #ede7d8;
      --ink:     #111010;
      --ink-90:  #1a1918;
      --ink-60:  rgba(17,16,16,0.55);
      --ink-30:  rgba(17,16,16,0.28);
      --ink-10:  rgba(17,16,16,0.08);
      --teal:    #0d9488;
      --teal-d:  #0f766e;
      --teal-bg: rgba(13,148,136,0.07);
      --red-acc: #c0392b;
      --rule:    rgba(17,16,16,0.14);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--cream);
      color: var(--ink);
      font-family: 'IBM Plex Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .serif { font-family: 'Playfair Display', serif; }
    .mono  { font-family: 'IBM Plex Mono', monospace; }
    .sans  { font-family: 'IBM Plex Sans', sans-serif; }

    @keyframes blink-dot {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.2; }
    }
    .blink { animation: blink-dot 1.8s ease-in-out infinite; }

    @keyframes scaleX-prog {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    .step-prog {
      transform-origin: left;
      animation: scaleX-prog 3.8s linear forwards;
    }

    @keyframes bar-fill {
      from { width: 0; }
      to   { width: var(--w); }
    }
    .tbar {
      width: 0;
      animation: bar-fill 1.1s cubic-bezier(0.22,1,0.36,1) var(--delay, 0s) forwards;
    }

    @keyframes slide-in-row {
      from { opacity: 0; transform: translateX(-10px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    .payout-row {
      opacity: 0;
      animation: slide-in-row 0.4s ease forwards;
      animation-delay: var(--row-delay, 0s);
    }
    .payout-row.visible { opacity: 1; }

    /* inky hover on trigger rows */
    .trigger-row:hover { background: var(--teal-bg); }
    .trigger-row { transition: background 0.2s; }

    /* ── animated trigger icons ── */
    @keyframes rain-fall {
      0%   { transform: translateY(-6px); opacity: 0; }
      30%  { opacity: 1; }
      100% { transform: translateY(10px); opacity: 0; }
    }
    .anim-rain-drop {
      animation: rain-fall 1.2s ease-in infinite;
    }

    @keyframes smog-pulse {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50%      { opacity: 0.85; transform: scale(1.12); }
    }
    .anim-smog {
      animation: smog-pulse 2.4s ease-in-out infinite;
    }

    @keyframes cyclone-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .anim-cyclone {
      animation: cyclone-spin 2.8s linear infinite;
    }

    @keyframes wifi-blink {
      0%, 60%  { opacity: 1; }
      70%, 85% { opacity: 0.15; }
      100%     { opacity: 1; }
    }
    .anim-wifi {
      animation: wifi-blink 2.2s ease-in-out infinite;
    }

    @keyframes barrier-slide {
      0%, 100% { transform: translateX(0); }
      50%      { transform: translateX(4px); }
    }
    .anim-barrier {
      animation: barrier-slide 1.6s ease-in-out infinite;
    }
  `}</style>
);

/* ─── REVEAL WRAPPER ────────────────────────────────── */
function Reveal({
                    children, delay = 0, id, style = {}, className = '',
                }: {
    children: React.ReactNode; delay?: number; id?: string;
    style?: React.CSSProperties; className?: string;
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-50px' });
    return (
        <motion.div ref={ref} id={id} style={style} className={className}
                    initial={{ opacity: 0, y: 28 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
        >
            {children}
        </motion.div>
    );
}

/* ─── ANIMATED TRIGGER ICONS ───────────────────────── */
function AnimRain({ color }: { color: string }) {
    return (
        <div style={{ width: 32, height: 32, position: 'relative', overflow: 'hidden' }}>
            {[0, 0.35, 0.7].map((d, i) => (
                <div key={i} className="anim-rain-drop" style={{
                    position: 'absolute',
                    left: 6 + i * 9,
                    top: 4,
                    width: 3,
                    height: 8,
                    borderRadius: 2,
                    background: color,
                    animationDelay: `${d}s`,
                }} />
            ))}
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ position: 'absolute', top: 0, left: 0 }}>
                <path d="M6 14 Q16 8 26 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            </svg>
        </div>
    );
}

function AnimSmog({ color }: { color: string }) {
    return (
        <div style={{ width: 32, height: 32, position: 'relative' }}>
            {[{ x: 4, y: 8, s: 14, d: '0s' }, { x: 14, y: 12, s: 12, d: '0.6s' }, { x: 8, y: 16, s: 10, d: '1.2s' }].map((c, i) => (
                <div key={i} className="anim-smog" style={{
                    position: 'absolute',
                    left: c.x,
                    top: c.y,
                    width: c.s,
                    height: c.s * 0.6,
                    borderRadius: '50%',
                    background: color,
                    opacity: 0.5,
                    animationDelay: c.d,
                }} />
            ))}
        </div>
    );
}

function AnimCyclone({ color }: { color: string }) {
    return (
        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg className="anim-cyclone" width="24" height="24" viewBox="0 0 24 24">
                <path d="M12 2C12 2 14 6 14 8C14 10 12 12 12 12C12 12 10 10 10 8C10 6 12 2 12 2Z" fill={color} opacity="0.7" />
                <path d="M22 12C22 12 18 14 16 14C14 14 12 12 12 12C12 12 14 10 16 10C18 10 22 12 22 12Z" fill={color} opacity="0.5" />
                <path d="M12 22C12 22 10 18 10 16C10 14 12 12 12 12C12 12 14 14 14 16C14 18 12 22 12 22Z" fill={color} opacity="0.7" />
                <path d="M2 12C2 12 6 10 8 10C10 10 12 12 12 12C12 12 10 14 8 14C6 14 2 12 2 12Z" fill={color} opacity="0.5" />
                <circle cx="12" cy="12" r="2.5" fill={color} />
            </svg>
        </div>
    );
}

function AnimWifi({ color }: { color: string }) {
    return (
        <div className="anim-wifi" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M2 8.5C5.5 4 18.5 4 22 8.5" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                <path d="M5.5 12C8 9 16 9 18.5 12" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                <path d="M9 15.5C10.5 14 13.5 14 15 15.5" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                <circle cx="12" cy="19" r="1.5" fill={color} />
            </svg>
        </div>
    );
}

function AnimBarrier({ color }: { color: string }) {
    return (
        <div style={{ width: 32, height: 32, position: 'relative' }}>
            <div className="anim-barrier" style={{ position: 'absolute', top: 10, left: 2, width: 28, height: 4, background: color, borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 10, left: 2, width: 28, height: 4, borderRadius: 2, overflow: 'hidden' }}>
                {[0, 8, 16, 24].map((x, i) => (
                    <div key={i} style={{ position: 'absolute', left: x, top: 0, width: 4, height: 4, background: 'var(--cream)', opacity: 0.5, transform: 'skewX(-20deg)' }} />
                ))}
            </div>
            <div style={{ position: 'absolute', top: 14, left: 6, width: 3, height: 12, background: color, opacity: 0.6, borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: 14, left: 23, width: 3, height: 12, background: color, opacity: 0.6, borderRadius: 1 }} />
        </div>
    );
}

const animatedIcons: Record<string, (color: string) => React.ReactNode> = {
    heavy_rainfall:  (c) => <AnimRain color={c} />,
    aqi_grap_iv:     (c) => <AnimSmog color={c} />,
    cyclone:         (c) => <AnimCyclone color={c} />,
    platform_outage: (c) => <AnimWifi color={c} />,
    curfew_bandh:    (c) => <AnimBarrier color={c} />,
};

/* ─── STATIC DATA ───────────────────────────────────── */
const triggerMeta: Record<string, { icon: React.ElementType; color: string; fill: string }> = {
    heavy_rainfall:  { icon: CloudRain, color: '#0369a1', fill: '72%' },
    aqi_grap_iv:     { icon: Factory,   color: '#b45309', fill: '58%' },
    cyclone:         { icon: Wind,      color: '#7c3aed', fill: '31%' },
    platform_outage: { icon: Wifi,      color: '#0d9488', fill: '19%' },
    curfew_bandh:    { icon: Ban,       color: '#c0392b', fill: '44%' },
};

const steps = [
    { n: '01', title: 'Quick KYC', body: 'Aadhaar + DL + RC upload. UPI link. Under 5 minutes. No branch visit.', badge: '5 min' },
    { n: '02', title: 'Pick a Tier', body: 'Normal ₹80 · Medium ₹120 · High ₹160 per week. No lock-in. Cancel any time.', badge: '1 min' },
    { n: '03', title: 'AI Watches', body: 'Live weather, AQI, platform status, news feeds — scanning your zone 24/7.', badge: 'Always' },
    { n: '04', title: 'Auto Payout', body: 'Both gates pass → claim filed → Razorpay UPI transfer in under 10 minutes. Nothing to do.', badge: '<10 min' },
];

const faqs = [
    { q: 'What is Parametric Insurance?', a: 'Unlike traditional insurance where you file a claim and wait for approval, parametric insurance pays out automatically when a pre-defined trigger is met (e.g., rainfall >65mm). No adjusters, no paperwork, no delays.' },
    { q: 'How fast are payouts?', a: 'Under 60 seconds. When a trigger is detected, our system runs 4 automated fraud checks (GPS, activity, session, duplicate) and sends money directly to your UPI if all pass.' },
    { q: 'How is pricing structured?', a: 'Weekly. Coverage and premiums run week-to-week to match delivery partner cashflows.' },
    { q: 'Who is eligible for SafeShift?', a: 'Any LCV delivery partner operating on Porter with a valid Driving License, Vehicle RC, Aadhaar, and active UPI ID. You must be operating in one of our covered cities (Delhi-NCR, Mumbai, Bangalore, Chennai, Pune).' },
    { q: 'Can I cancel anytime?', a: 'Yes. SafeShift is a weekly subscription. Simply don\'t renew next week. No lock-in, no cancellation fees, no questions asked.' },
    { q: 'Do riders need to file claims?', a: 'No. This is parametric coverage: when trigger thresholds are met, payouts are created automatically with zero manual claims processing.' },
    { q: 'Is there a waiting period?', a: 'Yes — 1 week. You pay your first premium immediately, and coverage begins from Week 2. This prevents adverse selection (signing up only during active disruptions).' },
    { q: 'What if there are multiple disruptors in one day?', a: 'Only the highest-severity payout fires. No stacking of payouts. Maximum one claim per day, even if rainfall, AQI, and a cyclone all trigger simultaneously.' },
];

const payoutRows = [
    { t: '14:03:11', label: 'Rainfall detected: 68mm — exceeds 65mm threshold', ok: true },
    { t: '14:03:14', label: 'Driver active 47 min · GPS in Kothrud zone ✓', ok: true },
    { t: '14:03:15', label: 'Claim auto-filed · ref #SS-20241203-0041', ok: true },
    { t: '14:03:22', label: '₹1,500 → Ravi Kumar (UPI: ravi@upi) · SENT', ok: true, highlight: true },
];

/* ─── PAGE ──────────────────────────────────────────── */
export default function LandingPage() {
    const [mounted, setMounted] = useState(false);
    const [activeStep,  setActiveStep]  = useState(0);
    const [activeFaq,   setActiveFaq]   = useState<number | null>(null);
    const [scrolled,    setScrolled]    = useState(false);
    const [liveRain,    setLiveRain]    = useState(47);
    const [payoutVisible, setPayoutVisible] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const payoutRef = useRef<HTMLDivElement>(null);
    const payoutInView = useInView(payoutRef as React.RefObject<Element>, { once: true });

    useEffect(() => {
        const t = setInterval(() => setActiveStep(p => (p + 1) % steps.length), 3800);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
            setLiveRain(p => Math.min(Math.max(p + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3 + 1), 38), 73));
        }, 1300);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (payoutInView) setTimeout(() => setPayoutVisible(true), 400);
    }, [payoutInView]);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    /* ── shared section header ── */
    const SectionHead = ({ n, title, sub }: { n: string; title: string; sub?: string }) => (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingBottom: 18, borderBottom: '1px solid var(--rule)', marginBottom: 44 }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-60)', textTransform: 'uppercase' }}>§ {n}</span>
            <h2 className="serif" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'inherit' }}>
                {title}
            </h2>
            {sub && <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', fontWeight: 300 }}>{sub}</p>}
        </div>
    );

    return (
        <>
            <GlobalStyles />
            <div style={{ background: 'var(--cream)', minHeight: '100vh', overflowX: 'hidden' }}>

                {/* ══════ NAV ══════ */}
                <nav style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                    background: mounted && scrolled ? 'rgba(245,240,232,0.96)' : 'transparent',
                    backdropFilter: mounted && scrolled ? 'blur(14px)' : 'none',
                    borderBottom: mounted && scrolled ? '1px solid var(--rule)' : '1px solid transparent',
                    transition: 'all 0.3s',
                }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span className="serif" style={{ fontSize: 21, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Safe<span style={{ color: 'var(--teal)' }}>Shift</span>
              </span>
                        </Link>
                        <div className="hidden md:flex" style={{ gap: 28 }}>
                            {[['How It Works','#how-it-works'],['Coverage','#coverage'],['Plans','#plans'],['FAQ','#faq']].map(([l,h]) => (
                                <a key={l} href={h} className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', textDecoration: 'none', fontWeight: 500 }}
                                   onMouseOver={e=>(e.currentTarget.style.color='var(--ink)')}
                                   onMouseOut={e=>(e.currentTarget.style.color='var(--ink-60)')}
                                >{l}</a>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Link href="/login" style={{ fontSize: 13, color: 'var(--ink-60)', textDecoration: 'none', padding: '7px 12px', fontWeight: 500 }}
                                  onMouseOver={e=>(e.currentTarget.style.color='var(--ink)')}
                                  onMouseOut={e=>(e.currentTarget.style.color='var(--ink-60)')}
                            >Sign in</Link>
                            <Link href="/admin" style={{
                                fontSize: 13, fontWeight: 600, color: '#fff',
                                background: 'var(--ink)', padding: '8px 16px', borderRadius: 3,
                                textDecoration: 'none', transition: 'background 0.2s',
                            }}
                                  onMouseOver={e=>(e.currentTarget.style.background='var(--teal)')}
                                  onMouseOut={e=>(e.currentTarget.style.background='var(--ink)')}
                            >Admin Portal</Link>
                        </div>
                    </div>
                </nav>

                {/* ══════ MASTHEAD STRIP ══════ */}
                <div style={{ paddingTop: 56 }}>
                    <div className="mono" style={{
                        background: 'var(--ink)', color: 'rgba(245,240,232,0.6)',
                        fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '7px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                    }}>
                        <span>India's First Parametric Insurance for LCV Delivery Partners · Porter</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ color: 'rgba(245,240,232,0.35)' }}>Guidewire DEVTrails 2026</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="blink" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                Live monitoring active
              </span>
            </span>
                    </div>
                </div>

                {/* ══════ HERO ══════ */}
                <section style={{ borderBottom: '3px solid var(--ink)' }}>
                    {/* Main headline block */}
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 0', textAlign: 'center', borderBottom: '1px solid var(--rule)' }}>
                        <motion.p className="mono"
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                                  style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-60)', textTransform: 'uppercase', marginBottom: 20 }}
                        >
                            Porter · LCV Partners · India — Est. 2026
                        </motion.p>
                        <motion.h1 className="serif"
                                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                   transition={{ duration: 0.85, ease: [0.22,1,0.36,1] }}
                                   style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.96, color: 'var(--ink)', marginBottom: 26 }}
                        >
                            When the Weather Stops You,<br />
                            <em style={{ fontStyle: 'italic', color: 'var(--teal)' }}>SafeShift Pays You.</em>
                        </motion.h1>
                        <motion.p className="sans"
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.6 }}
                                  style={{ fontSize: 16, color: 'var(--ink-60)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.72, fontWeight: 300 }}
                        >
                            Zero-touch parametric income protection for LCV delivery partners on Porter.
                            No forms. No adjusters. Money in your UPI in under 10 minutes.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55, duration: 0.5 }}
                            style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 40 }}
                        >
                            <Link href="/register" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '13px 26px', background: 'var(--teal)', color: '#fff',
                                fontSize: 14, fontWeight: 600, borderRadius: 3, textDecoration: 'none', transition: 'background 0.2s',
                            }}
                                  onMouseOver={e=>(e.currentTarget.style.background='var(--teal-d)')}
                                  onMouseOut={e=>(e.currentTarget.style.background='var(--teal)')}
                            >
                                Protect my income <ArrowUpRight size={14} />
                            </Link>
                            <a href="#how-it-works" style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '13px 22px', border: '1px solid var(--rule)', color: 'var(--ink-60)',
                                fontSize: 14, fontWeight: 500, borderRadius: 3, textDecoration: 'none', transition: 'border-color 0.2s, color 0.2s',
                            }}
                               onMouseOver={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--ink)';(e.currentTarget as HTMLElement).style.color='var(--ink)';}}
                               onMouseOut={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--rule)';(e.currentTarget as HTMLElement).style.color='var(--ink-60)';}}
                            >How it works</a>
                        </motion.div>
                    </div>

                    {/* Three-column layout */}
                    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--rule)' }}>

                        {/* Col 1: Live sensor */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 0.6 }}
                                    style={{ padding: '28px 28px 32px', borderRight: '1px solid var(--rule)' }}>
                            <p className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-60)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
                                ◉ Live — Pune Zone Sensor
                            </p>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                <span className="serif" style={{
                    fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em',
                    color: mounted && liveRain >= 65 ? 'var(--teal)' : 'var(--ink)',
                    transition: 'color 0.5s',
                }}>{liveRain}</span>
                                <div style={{ paddingBottom: 12 }}>
                                    <p className="mono" style={{ fontSize: 13, color: 'var(--ink-60)' }}>mm/day</p>
                                    <p className="mono" style={{ fontSize: 10, color: mounted && liveRain >= 65 ? 'var(--teal)' : 'var(--ink-30)', marginTop: 3 }}>
                                        {mounted && liveRain >= 65 ? '⚡ TRIGGER ZONE' : 'threshold: 65mm'}
                                    </p>
                                </div>
                            </div>
                            {/* Sparkline */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32, marginBottom: 16 }}>
                                {[32,38,44,55,61,58,50,liveRain].map((v,i)=>(
                                    <div key={i} style={{
                                        flex:1, borderRadius: 2,
                                        height: `${(v/80)*100}%`,
                                        background: i===7 ? 'var(--teal)' : v>=65 ? 'rgba(13,148,136,0.45)' : 'var(--ink-10)',
                                        transition: 'height 0.4s',
                                    }}/>
                                ))}
                            </div>
                            <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.65, fontWeight: 300 }}>
                                Real-time IMD + OpenWeatherMap feeds power automatic payouts — no human review.
                            </p>
                        </motion.div>

                        {/* Col 2: Pull quote */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.6 }}
                                    style={{ padding: '28px 28px 32px', borderRight: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <p className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-60)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
                                    ◎ Market Context
                                </p>
                                <blockquote className="serif" style={{
                                    fontSize: 22, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.35,
                                    color: 'var(--ink)', marginBottom: 16,
                                    borderLeft: '3px solid var(--teal)', paddingLeft: 16,
                                }}>
                                    "One restricted week wipes ₹7,000–₹9,000. The EMI doesn't pause."
                                </blockquote>
                                <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', lineHeight: 1.65, fontWeight: 300 }}>
                                    ~70% of LCV drivers carry vehicle EMIs of ₹8K–₹15K/month.
                                    Delhi GRAP-IV (Nov–Dec 2024) banned commercial vehicles for 11+ days in a row.
                                </p>
                            </div>
                            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {[['500K+','Porter LCV drivers'],['₹84K–₹1L','Avg annual income loss']].map(([v,l])=>(
                                    <div key={l}>
                                        <p className="serif" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}>{v}</p>
                                        <p className="mono" style={{ fontSize: 9, color: 'var(--ink-60)', marginTop: 5, lineHeight: 1.45 }}>{l}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Col 3: Payout simulation */}
                        <motion.div ref={payoutRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.6 }}
                                    style={{ padding: '28px 28px 32px' }}>
                            <p className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-60)', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
                                ◈ Payout Demo · Medium Tier
                            </p>
                            {payoutRows.map((row, i) => (
                                <div key={i} className={`payout-row${payoutVisible ? ' visible' : ''}`}
                                     style={{
                                         '--row-delay': `${i * 0.22}s`,
                                         display: 'flex', alignItems: 'flex-start', gap: 10,
                                         padding: '9px 0', borderBottom: i < payoutRows.length-1 ? '1px solid var(--ink-10)' : 'none',
                                     } as React.CSSProperties}
                                >
                                    <span className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', minWidth: 58, paddingTop: 1 }}>{row.t}</span>
                                    <CheckCircle2 size={12} color="var(--teal)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }}/>
                                    <span className="sans" style={{ fontSize: 12, fontWeight: row.highlight ? 600 : 400, color: row.highlight ? 'var(--teal)' : 'var(--ink)', lineHeight: 1.5 }}>
                    {row.label}
                  </span>
                                </div>
                            ))}
                            {payoutVisible && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1.1, duration: 0.5 }}
                                    style={{ marginTop: 18, padding: '16px 18px', background: 'var(--teal)', borderRadius: 3 }}
                                >
                                    <p className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Transfer confirmed</p>
                                    <p className="serif" style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>₹1,500</p>
                                    <p className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 5 }}>9 min 11 sec · trigger → UPI</p>
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                </section>

                {/* ══════ STATS BAR ══════ */}
                <section style={{ background: 'var(--ink)', borderBottom: '3px solid var(--ink)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                        {[
                            { v: '<10', u: 'min', l: 'Payout time' },
                            { v: '500K', u: '+',  l: 'Target drivers' },
                            { v: '₹192', u: 'Cr', l: 'Annual market' },
                            { v: '5',    u: '',   l: 'Trigger types' },
                        ].map((s, i) => (
                            <Reveal key={i} delay={i * 0.07}>
                                <div style={{ padding: '22px 24px', borderRight: i<3?'1px solid rgba(245,240,232,0.07)':'none' }}>
                                    <p className="serif" style={{ fontSize: 36, fontWeight: 900, color: 'var(--cream)', letterSpacing: '-0.05em', lineHeight: 1 }}>
                                        {s.v}<span style={{ color: 'var(--teal)' }}>{s.u}</span>
                                    </p>
                                    <p className="mono" style={{ fontSize: 9, color: 'rgba(245,240,232,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 7 }}>{s.l}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </section>

                {/* ══════ HOW IT WORKS ══════ */}
                <section id="how-it-works" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 0' }}>
                        <SectionHead n="02" title="How It Works" />
                    </div>
                    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--rule)', borderTop: '1px solid var(--rule)' }}>
                        {steps.map((s, i) => (
                            <Reveal key={i} delay={i * 0.09}>
                                <div onClick={()=>setActiveStep(i)} style={{
                                    padding: '28px 24px 34px', cursor: 'pointer',
                                    borderRight: i<3?'1px solid var(--rule)':'none',
                                    background: activeStep===i ? 'var(--teal-bg)' : 'transparent',
                                    transition: 'background 0.3s', position: 'relative',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: activeStep===i ? 'var(--teal)' : 'var(--ink-30)', transition: 'color 0.3s' }}>
                      {s.n}
                    </span>
                                        <span className="mono" style={{
                                            fontSize: 9, padding: '3px 7px',
                                            border: `1px solid ${activeStep===i ? 'var(--teal)' : 'var(--rule)'}`,
                                            color: activeStep===i ? 'var(--teal)' : 'var(--ink-60)',
                                            borderRadius: 2, letterSpacing: '0.05em', transition: 'all 0.3s',
                                        }}>{s.badge}</span>
                                    </div>
                                    <h3 className="serif" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 10 }}>{s.title}</h3>
                                    <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.65, fontWeight: 300 }}>{s.body}</p>
                                    {activeStep===i && (
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--ink-10)' }}>
                                            <div className="step-prog" key={`prog-${activeStep}`} style={{ height: '100%', background: 'var(--teal)' }} />
                                        </div>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </section>

                {/* ══════ COVERAGE / TRIGGERS ══════ */}
                <section id="coverage" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
                        <SectionHead n="03" title="What We Cover" sub="5 parametric triggers · zero manual claims" />

                        {Object.entries(TRIGGERS).map(([key, trigger], i) => {
                            const meta = triggerMeta[key] ?? { icon: AlertTriangle, color: 'var(--ink)', fill: '40%' };
                            const animIcon = animatedIcons[key];
                            return (
                                <Reveal key={key} delay={i * 0.07}>
                                    <div className="trigger-row" style={{
                                        display: 'grid', gridTemplateColumns: '32px 1fr 280px 130px',
                                        alignItems: 'center', gap: 20,
                                        padding: '18px 10px', borderBottom: '1px solid var(--rule)',
                                        marginLeft: -10, marginRight: -10, paddingLeft: 10, paddingRight: 10,
                                        borderRadius: 4,
                                    }}>
                                        {animIcon ? animIcon(meta.color) : <AlertTriangle size={17} color={meta.color} />}
                                        <div>
                                            <p className="sans" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{trigger.label}</p>
                                            <p className="mono" style={{ fontSize: 10, color: 'var(--ink-60)', marginTop: 2 }}>{'>'}{trigger.threshold} {trigger.unit}</p>
                                        </div>
                                        <div style={{ height: 5, background: 'var(--ink-10)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div className="tbar" style={{ '--w': meta.fill, '--delay': `${0.3+i*0.1}s`, height: '100%', background: meta.color, borderRadius: 2 } as React.CSSProperties} />
                                        </div>
                                        <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', fontWeight: 300, lineHeight: 1.45, textAlign: 'right' }}>
                                            {trigger.description}
                                        </p>
                                    </div>
                                </Reveal>
                            );
                        })}

                        {/* Dual-gate callout */}
                        <Reveal delay={0.5}>
                            <div style={{
                                marginTop: 24, padding: '20px 24px',
                                background: 'var(--teal-bg)', border: '1px solid rgba(13,148,136,0.18)',
                                borderRadius: 4, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                            }}>
                                <Shield size={16} color="var(--teal)" />
                                <div>
                                    <p className="sans" style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>Dual-Gate Verified</p>
                                    <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', fontWeight: 300, marginTop: 2 }}>Both gates must pass before a payout fires</p>
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                                    {['Gate 1: Environmental data','Gate 2: Driver activity'].map(g=>(
                                        <span key={g} className="mono" style={{ fontSize: 10, padding: '4px 10px', border: '1px solid rgba(13,148,136,0.3)', color: 'var(--teal)', borderRadius: 2 }}>{g}</span>
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* ══════ PLANS ══════ */}
                <section id="plans" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 44 }}>
                            <p className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</p>
                            <h2 className="serif" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 10 }}>
                                Weekly plans that fit gig budgets
                            </h2>
                            <p className="sans" style={{ fontSize: 15, color: 'var(--ink-60)', fontWeight: 300 }}>
                                No long-term lock-ins. Pay weekly, stay flexible.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                            {[
                                {
                                    name: 'Basic Shield', slug: 'normal', price: 80, sub: 'Up to 6 hrs/day coverage',
                                    payout: '\u20B92,000/disruption payout', best: 'Best for part-time drivers',
                                    features: ['All 5 triggers', 'UPI payout <60s', 'GigPoints rewards', 'Basic forecast alerts'],
                                    excluded: ['Premium forecast alerts', 'Smart reminders', 'Priority UPI payout', 'GigPoints 2x multiplier', 'Dedicated support'],
                                },
                                {
                                    name: 'Pro Shield', slug: 'medium', price: 120, sub: 'Up to 10 hrs/day coverage',
                                    payout: '\u20B93,000/disruption payout', best: 'Best for regular drivers', popular: true,
                                    features: ['All 5 triggers', 'UPI payout <60s', 'GigPoints rewards', 'Premium forecast alerts', 'Smart reminders'],
                                    excluded: ['Priority UPI payout', 'GigPoints 2x multiplier', 'Dedicated support'],
                                },
                                {
                                    name: 'Elite Shield', slug: 'high', price: 160, sub: 'Up to 14 hrs/day coverage',
                                    payout: '\u20B94,000/disruption payout', best: 'Best for full-time drivers',
                                    features: ['All 5 triggers', 'Priority UPI payout', 'GigPoints 2x multiplier', 'Premium forecast alerts', 'Smart reminders', 'Dedicated support'],
                                    excluded: [],
                                },
                            ].map((tier, i) => (
                                <Reveal key={tier.slug} delay={i * 0.09}>
                                    <div style={{
                                        padding: '32px 28px',
                                        border: tier.popular ? '2px solid var(--teal)' : '1px solid var(--rule)',
                                        borderRadius: 16,
                                        position: 'relative',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}>
                                        {tier.popular && (
                                            <span className="mono" style={{
                                                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                                                fontSize: 9, color: '#fff', background: 'var(--teal)',
                                                padding: '4px 12px', borderRadius: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
                                            }}>Most Popular</span>
                                        )}
                                        <p className="sans" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                                            {tier.name}
                                        </p>
                                        <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', fontWeight: 300, marginBottom: 16 }}>
                                            {tier.sub}
                                        </p>
                                        <p className="serif" style={{ fontSize: 42, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 2 }}>
                                            {'\u20B9'}{tier.price}<span className="sans" style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-60)' }}>/week</span>
                                        </p>
                                        <p className="mono" style={{ fontSize: 11, color: 'var(--teal)', marginTop: 6, marginBottom: 20 }}>
                                            {tier.payout}
                                        </p>

                                        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: 18, marginBottom: 20, flex: 1 }}>
                                            {tier.features.map((f) => (
                                                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                                                    <span style={{ color: 'var(--teal)', fontSize: 14, flexShrink: 0 }}>{'\u2713'}</span>
                                                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 400 }}>{f}</span>
                                                </div>
                                            ))}
                                            {tier.excluded.map((f) => (
                                                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                                                    <span style={{ color: 'var(--ink-30)', fontSize: 14, flexShrink: 0 }}>{'\u2717'}</span>
                                                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink-30)', fontWeight: 400 }}>{f}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <Link href="/register" style={{
                                            display: 'block', textAlign: 'center', padding: '12px',
                                            background: tier.popular ? 'var(--teal)' : 'transparent',
                                            color: tier.popular ? '#fff' : 'var(--ink)',
                                            border: `1px solid ${tier.popular ? 'var(--teal)' : 'var(--rule)'}`,
                                            borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s',
                                            fontFamily: 'IBM Plex Sans',
                                        }}
                                              onMouseOver={e=>{(e.currentTarget as HTMLElement).style.background='var(--teal)';(e.currentTarget as HTMLElement).style.color='#fff';(e.currentTarget as HTMLElement).style.borderColor='var(--teal)';}}
                                              onMouseOut={e=>{(e.currentTarget as HTMLElement).style.background=tier.popular?'var(--teal)':'transparent';(e.currentTarget as HTMLElement).style.color=tier.popular?'#fff':'var(--ink)';(e.currentTarget as HTMLElement).style.borderColor=tier.popular?'var(--teal)':'var(--rule)';}}
                                        >Get Started</Link>

                                        <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', textAlign: 'center', marginTop: 14, fontWeight: 300 }}>
                                            {tier.best}
                                        </p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════ FAQ ══════ */}
                <section id="faq" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
                        <SectionHead n="05" title="Common Questions" />
                        {faqs.map((faq, i) => (
                            <Reveal key={i} delay={i * 0.04}>
                                <div style={{ borderBottom: '1px solid var(--rule)' }}>
                                    <button onClick={()=>setActiveFaq(activeFaq===i?null:i)} style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16,
                                    }}>
                                        <span className="sans" style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{faq.q}</span>
                                        <span className="mono" style={{ fontSize: 14, color: activeFaq===i?'var(--teal)':'var(--ink-30)', minWidth: 18, transition: 'color 0.2s', lineHeight: 1 }}>
                          {activeFaq===i?'−':'+'}
                        </span>
                                    </button>
                                    <AnimatePresence>
                                        {activeFaq===i && (
                                            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration: 0.26 }} style={{ overflow: 'hidden' }}>
                                                <p className="sans" style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.75, paddingBottom: 20, fontWeight: 300, maxWidth: 580 }}>
                                                    {faq.a}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </section>

                {/* ══════ FINAL CTA ══════ */}
                <section>
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px', display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'start' }}>
                        {/* Left */}
                        <Reveal style={{ paddingRight: 60 }}>
                            <p className="mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-60)', textTransform: 'uppercase', marginBottom: 20 }}>
                                No driver should lose their livelihood to the weather.
                            </p>
                            <h2 className="serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 22 }}>
                                Your first week of protection starts at{' '}
                                <em style={{ fontStyle: 'italic', color: 'var(--teal)' }}>₹80.</em>
                            </h2>
                            <p className="sans" style={{ fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.75, fontWeight: 300, marginBottom: 32 }}>
                                Less than ₹12 a day. No lock-in. No forms. No waiting.
                                If conditions breach your threshold and you're working — the money comes to you.
                            </p>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <Link href="/register" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '13px 26px', background: 'var(--ink)', color: '#fff',
                                    fontSize: 14, fontWeight: 600, borderRadius: 3, textDecoration: 'none', transition: 'background 0.2s',
                                }}
                                      onMouseOver={e=>(e.currentTarget.style.background='var(--teal)')}
                                      onMouseOut={e=>(e.currentTarget.style.background='var(--ink)')}
                                >
                                    Start now <ArrowUpRight size={14} />
                                </Link>
                                <Link href="/login" style={{
                                    display: 'inline-flex', alignItems: 'center',
                                    padding: '13px 20px', border: '1px solid var(--rule)', color: 'var(--ink-60)',
                                    fontSize: 14, fontWeight: 500, borderRadius: 3, textDecoration: 'none',
                                }}>Sign in</Link>
                            </div>
                        </Reveal>

                        <div style={{ background: 'var(--rule)', alignSelf: 'stretch' }} />

                        {/* Right: feature ledger */}
                        <Reveal delay={0.12} style={{ paddingLeft: 60 }}>
                            <p className="mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-60)', textTransform: 'uppercase', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}>
                                What you get
                            </p>
                            {[
                                ['Zero-touch claims',   'Auto-filed when both gates pass'],
                                ['Instant UPI payout',  'Under 10 min via Razorpay'],
                                ['AI dynamic pricing',  'Adjusted weekly by zone risk'],
                                ['Predictive alerts',   'Sunday forecast of next-week risk'],
                                ['5 trigger types',     'Rain · AQI · Cyclone · Bandh · Outage'],
                                ['Vernacular support',  'Hindi · Marathi · Tamil · Telugu · EN'],
                                ['Rewards system',      '₹5 off per 100 coins earned'],
                            ].map(([title, sub]) => (
                                <div key={title} style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--ink-10)' }}>
                                    <CheckCircle2 size={12} color="var(--teal)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                                    <span className="sans" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</span>
                                    <span className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', fontWeight: 300 }}>— {sub}</span>
                                </div>
                            ))}
                        </Reveal>
                    </div>
                </section>

                {/* ══════ FOOTER ══════ */}
                <footer style={{ borderTop: '3px solid var(--ink)', padding: '18px 24px', background: 'var(--cream)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span className="serif" style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              Safe<span style={{ color: 'var(--teal)' }}>Shift</span>
            </span>
                        <div className="hidden md:flex" style={{ gap: 24, alignItems: 'center' }}>
                            {['How It Works','Coverage','Plans','FAQ'].map(l=>(
                                <a key={l} href={`#${l.toLowerCase().replace(/\s+/g,'-')}`} className="mono"
                                   style={{ fontSize: 9, color: 'var(--ink-60)', textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}
                                   onMouseOver={e=>(e.currentTarget.style.color='var(--teal)')}
                                   onMouseOut={e=>(e.currentTarget.style.color='var(--ink-60)')}
                                >{l}</a>
                            ))}
                        </div>
                        <p className="mono" style={{ fontSize: 9, color: 'var(--ink-30)', letterSpacing: '0.06em', fontWeight: 600 }}>
                            Team Code Mavens · Guidewire DEVTrails 2026
                        </p>
                    </div>
                </footer>

            </div>
        </>
    );
}