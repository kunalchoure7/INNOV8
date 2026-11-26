import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRight,
  BellRing,
  Building2,
  Clock,
  Monitor,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { Button, Card, StatusLabel } from '../components/ui';
import { cn, formatWaitLabel } from '../lib/utils';
import type { OrganizationSummary, PublicStats } from '../types/queue';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const CATEGORIES = [
  'All',
  'Hospital',
  'Bank',
  'Government',
  'College',
  'Service Centre',
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { subscribeQueueEvents } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [previewOrgIdx, setPreviewOrgIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, orgsRes] = await Promise.all([
        fetch('/api/public/stats'),
        fetch('/api/public/organizations'),
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (orgsRes.ok) {
        const data = await orgsRes.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Failed to fetch landing data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeQueueEvents((msg) => {
      if (msg.type !== 'connected') {
        loadData();
      }
    });
    return unsub;
  }, [loadData, subscribeQueueEvents]);

  const handleHeroPointerMove = (e: React.MouseEvent<HTMLElement>) => {
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !window.matchMedia('(hover: hover)').matches)
    ) {
      return;
    }
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: nx * 16, y: ny * 12 });
  };

  const filteredOrgs =
    selectedCategory === 'All'
      ? organizations
      : organizations.filter((o) => o.category === selectedCategory);

  const previewOrg = organizations[previewOrgIdx] || organizations[0];
  const featuredServingCode =
    previewOrg?.currentlyServing[0]?.tokenCode || 'A-015';
  const featuredOrgName = previewOrg?.name || 'Metro General Hospital';
  const featuredServiceName =
    previewOrg?.services[0]?.name || 'General Outpatient';
  const featuredWait = previewOrg?.services[0]?.estimatedWaitMinutes ?? 8;

  return (
    <div className="min-h-screen flex flex-col">
      {/* IMMERSIVE 3D CYAN, SKY-BLUE & LAVENDER GLASS HERO */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroPointerMove}
        onMouseLeave={() => setParallax({ x: 0, y: 0 })}
        className="relative overflow-hidden"
      >
        <AmbientBackdrop variant="hero" />
        {/* Smooth bottom merge into the lower continuous canvas */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#D9F3FF] via-[#D9F3FF]/70 to-transparent pointer-events-none z-0"
        />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-[#356DF3] mb-3">
                Your Time Matters · Smart Digital Queue Platform
              </p>

              <h1
                className="font-display font-bold tracking-tight text-[#101828] leading-[1.07] mb-5"
                style={{
                  fontSize: 'clamp(2.35rem, 4.2vw, 3.75rem)',
                  textWrap: 'balance',
                }}
              >
                Skip The Queue.{' '}
                <span className="bg-gradient-to-r from-[#356DF3] via-[#5E63F0] to-[#7859ED] bg-clip-text text-transparent">
                  Own Your Time.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-xl mb-8">
                Book your token from anywhere, track your position in real time
                and arrive just before your turn.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onNavigate('/book')}
                >
                  Get Your Token
                  <ArrowRight className="w-4 h-4 ql-btn-arrow" />
                </Button>
                <Button
                  variant="glass"
                  size="lg"
                  onClick={() => onNavigate('/display')}
                >
                  <Monitor className="w-4 h-4 text-[#356DF3]" />
                  Open Live Display
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/75 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700">
                <span>Instant QR Token Pass</span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span>Priority Care Lanes</span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span>Live Lobby Sync</span>
              </div>
            </div>

            {/* Right Side: Floating 3D Glass Spheres & Queue Cards */}
            <div className="lg:col-span-6 relative min-h-[380px] sm:min-h-[440px] flex items-center justify-center">
              <div
                className="relative w-full max-w-[500px] h-[380px] sm:h-[430px] transition-transform duration-300 ease-out"
                style={{
                  transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
                }}
              >
                {/* Floating 3D Glass Ring */}
                <div
                  aria-hidden="true"
                  className="absolute -top-5 left-5 w-32 h-32 rounded-full border-[14px] border-white/60 bg-gradient-to-br from-white/45 to-[#A8EAF5]/25 backdrop-blur-md shadow-[0_20px_44px_rgba(53,109,243,0.16)] animate-float-slow pointer-events-none"
                />

                {/* Large Specular Cyan-Lavender Sphere */}
                <div
                  aria-hidden="true"
                  className="absolute bottom-3 left-1 w-22 h-22 rounded-full border border-white/90 backdrop-blur-lg shadow-[inset_6px_8px_16px_rgba(255,255,255,0.95),0_18px_36px_rgba(120,89,237,0.18)] animate-float-gentle pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.95) 0%, rgba(168,234,245,0.7) 52%, rgba(183,169,255,0.5) 100%)',
                  }}
                />

                {/* Small Top-Right Glass Bubble */}
                <div
                  aria-hidden="true"
                  className="absolute top-10 right-2 w-14 h-14 rounded-full border border-white/90 shadow-[inset_4px_4px_10px_rgba(255,255,255,0.95),0_14px_28px_rgba(53,109,243,0.16)] animate-float-medium pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.96) 0%, rgba(155,215,250,0.68) 55%, rgba(154,145,245,0.42) 100%)',
                  }}
                />

                {/* Soft Violet Accent Sphere */}
                <div
                  aria-hidden="true"
                  className="absolute -top-2 right-20 w-9 h-9 rounded-full border border-white/85 shadow-[0_12px_24px_rgba(120,89,237,0.2)] animate-float-gentle pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(183,169,255,0.72) 70%)',
                  }}
                />

                {/* 1. Primary Floating Translucent Digital Ticket Card */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  onClick={() => onNavigate('/book')}
                  className="absolute top-8 left-4 sm:left-10 right-10 sm:right-14 p-6 rounded-3xl bg-white/78 backdrop-blur-2xl border border-white/95 shadow-[0_28px_60px_rgba(53,109,243,0.16),0_8px_24px_rgba(120,89,237,0.10),inset_0_1px_0_rgba(255,255,255,1)] cursor-pointer animate-float-slow"
                >
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-sky-100/90">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent">
                        Digital Queue Ticket
                      </p>
                      <h2 className="font-display text-base font-bold text-[#101828] mt-0.5">
                        {featuredOrgName}
                      </h2>
                      <p className="text-xs text-slate-600">
                        {featuredServiceName}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-700">
                      Live
                    </span>
                  </div>

                  <div className="pt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Your Token</p>
                      <p className="font-mono text-4xl sm:text-5xl font-bold text-[#101828] tabular-nums tracking-tight">
                        {featuredServingCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Estimated Wait</p>
                      <p className="font-mono text-lg font-bold text-[#356DF3] tabular-nums">
                        {formatWaitLabel(featuredWait)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {previewOrg?.totalWaiting ?? 4} ahead in queue
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* 2. Floating 3D QR Code Pass Card */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 }}
                  whileHover={{ y: -4 }}
                  onClick={() => onNavigate('/my-tokens')}
                  className="absolute bottom-6 right-0 sm:right-2 w-44 sm:w-48 p-4 rounded-2xl bg-white/84 backdrop-blur-2xl border border-white shadow-[0_24px_50px_rgba(120,89,237,0.18),inset_0_1px_0_rgba(255,255,255,1)] cursor-pointer animate-float-medium"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold text-[#101828]">
                      QR Check-In
                    </span>
                    <QrCode className="w-3.5 h-3.5 text-[#7859ED]" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/95 border border-[#D9F3FF] flex items-center justify-center">
                    <QRCodeSVG
                      value={`queueless://token/${featuredServingCode}`}
                      size={92}
                      bgColor="#FFFFFF"
                      fgColor="#101828"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    Scan at counter arrival
                  </p>
                </motion.div>

                {/* 3. Floating Active Counter Token Card */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.14 }}
                  whileHover={{ y: -3 }}
                  onClick={() =>
                    onNavigate(
                      previewOrg ? `/display/${previewOrg.slug}` : '/display'
                    )
                  }
                  className="absolute bottom-14 left-0 sm:left-4 w-56 p-4 rounded-2xl bg-white/82 backdrop-blur-xl border border-white/95 shadow-[0_20px_42px_rgba(53,109,243,0.14)] cursor-pointer animate-float-gentle"
                >
                  <p className="text-[11px] font-medium text-slate-500">
                    Now Calling · Counter 01
                  </p>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-2xl font-bold text-[#101828] tabular-nums">
                      {featuredServingCode}
                    </span>
                    <span className="text-xs font-semibold text-[#356DF3]">
                      Proceed →
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UNIFIED CONTINUOUS CYAN · SKY-BLUE · LAVENDER LOWER CANVAS */}
      <div
        className="relative flex-1 flex flex-col overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, #D9F3FF 0%, #EAF8FF 16%, #BDEBFB 38%, #D8D1FF 64%, #BBE8FA 86%, #D9F3FF 100%)',
        }}
      >
        {/* Pure-CSS 3D Spheres, Bubbles, Orbs & Subtle Light Particles */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
        >
          {/* Ambient Blurred Gradient Light Orbs */}
          <div
            className="absolute top-[3%] -left-28 w-[500px] h-[500px] rounded-full blur-3xl animate-ambient-drift"
            style={{
              background:
                'radial-gradient(circle, rgba(168,234,245,0.68) 0%, rgba(155,215,250,0.22) 65%, transparent 100%)',
            }}
          />
          <div
            className="absolute top-[24%] -right-28 w-[520px] h-[520px] rounded-full blur-3xl animate-ambient-drift"
            style={{
              animationDelay: '3s',
              background:
                'radial-gradient(circle, rgba(183,169,255,0.58) 0%, rgba(154,145,245,0.22) 65%, transparent 100%)',
            }}
          />
          <div
            className="absolute top-[52%] left-[8%] w-[560px] h-[560px] rounded-full blur-3xl animate-ambient-drift"
            style={{
              animationDelay: '6s',
              background:
                'radial-gradient(circle, rgba(255,255,255,0.62) 0%, rgba(168,234,245,0.28) 65%, transparent 100%)',
            }}
          />
          <div
            className="absolute bottom-[6%] -right-20 w-[500px] h-[500px] rounded-full blur-3xl animate-ambient-drift"
            style={{
              animationDelay: '2s',
              background:
                'radial-gradient(circle, rgba(154,145,245,0.45) 0%, rgba(155,215,250,0.24) 65%, transparent 100%)',
            }}
          />

          {/* Large & Small Floating 3D Spheres */}
          <div
            className="hidden sm:block absolute top-[7%] right-[4%] w-28 h-28 rounded-full border border-white/90 backdrop-blur-md shadow-[inset_8px_10px_20px_rgba(255,255,255,0.95),0_22px_48px_rgba(53,109,243,0.14)] animate-float-slow"
            style={{
              background:
                'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.96), rgba(168,234,245,0.68) 54%, rgba(183,169,255,0.42) 100%)',
            }}
          />
          <div
            className="hidden md:block absolute top-[26%] left-[3%] w-22 h-22 rounded-full border border-white/90 backdrop-blur-md shadow-[inset_6px_8px_16px_rgba(255,255,255,0.95),0_20px_42px_rgba(120,89,237,0.14)] animate-float-gentle"
            style={{
              background:
                'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.96), rgba(217,243,255,0.68) 55%, rgba(154,145,245,0.38) 100%)',
            }}
          />
          <div
            className="hidden lg:block absolute top-[48%] right-[3%] w-32 h-32 rounded-full border border-white/90 backdrop-blur-md shadow-[inset_8px_10px_22px_rgba(255,255,255,0.95),0_24px_52px_rgba(53,109,243,0.14)] animate-float-medium"
            style={{
              background:
                'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.96), rgba(155,215,250,0.66) 54%, rgba(183,169,255,0.44) 100%)',
            }}
          />
          <div
            className="hidden md:block absolute top-[72%] left-[4%] w-20 h-20 rounded-full border border-white/90 backdrop-blur-md shadow-[inset_5px_6px_14px_rgba(255,255,255,0.95),0_18px_38px_rgba(53,109,243,0.12)] animate-float-slow"
            style={{
              background:
                'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), rgba(168,234,245,0.66) 56%, rgba(183,169,255,0.36) 100%)',
            }}
          />

          {/* Translucent Glass Bubbles & Geometric Shapes */}
          <div className="hidden lg:block absolute top-[15%] left-[2%] w-28 h-28 rounded-full border-[10px] border-white/55 bg-white/15 backdrop-blur-sm shadow-[0_16px_36px_rgba(53,109,243,0.1)] animate-float-medium" />
          <div className="hidden lg:block absolute top-[37%] right-[5%] w-24 h-24 rounded-3xl rotate-12 border border-white/85 bg-gradient-to-br from-white/55 to-[#B7A9FF]/28 backdrop-blur-md shadow-[0_18px_40px_rgba(120,89,237,0.1)] animate-float-slow" />
          <div className="hidden lg:block absolute top-[62%] right-[6%] w-20 h-20 rounded-full border-[8px] border-white/55 bg-[#A8EAF5]/20 backdrop-blur-sm shadow-[0_14px_30px_rgba(53,109,243,0.09)] animate-float-gentle" />
          <div className="hidden md:block absolute bottom-[11%] right-[5%] w-24 h-24 rounded-3xl -rotate-12 border border-white/85 bg-gradient-to-tr from-white/55 to-[#9BD7FA]/35 backdrop-blur-md shadow-[0_18px_40px_rgba(53,109,243,0.1)] animate-float-slow" />

          {/* Subtle Glowing Particles */}
          <span className="absolute top-[11%] left-[18%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(168,234,245,0.95)] animate-float-gentle" />
          <span className="absolute top-[24%] left-[42%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(183,169,255,0.9)] animate-float-slow" />
          <span className="absolute top-[33%] right-[20%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(155,215,250,0.9)] animate-float-medium" />
          <span className="absolute top-[54%] left-[22%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(154,145,245,0.85)] animate-float-gentle" />
          <span className="absolute top-[69%] right-[24%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(168,234,245,0.95)] animate-float-slow" />
          <span className="absolute top-[86%] right-[16%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(183,169,255,0.9)] animate-float-medium" />
        </div>

        {/* LIVE QUEUE PREVIEW & LIVE PLATFORM STATS */}
        <section className="relative z-10 py-12 lg:py-16">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-8 flex flex-col">
                <Card
                  glass
                  className="p-6 sm:p-7 flex-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-100/90">
                      <div>
                        <p className="text-xs text-[#356DF3] font-semibold">
                          Live Queue Preview
                        </p>
                        <h2 className="font-display text-lg font-bold text-[#101828] mt-0.5">
                          {previewOrg ? previewOrg.name : 'Loading live queues...'}
                        </h2>
                      </div>

                      {organizations.length > 0 && (
                        <div className="flex items-center gap-1 p-1 bg-white/75 backdrop-blur-md border border-[#9BD7FA]/75 rounded-xl w-fit">
                          {organizations.slice(0, 3).map((org, idx) => (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => setPreviewOrgIdx(idx)}
                              className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer',
                                previewOrgIdx === idx
                                  ? 'bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white shadow-[0_4px_14px_rgba(53,109,243,0.28)]'
                                  : 'text-slate-600 hover:text-[#101828] hover:bg-white/60'
                              )}
                            >
                              {org.category}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {loading ? (
                      <div className="py-10 space-y-3">
                        <div className="h-14 bg-white/70 rounded-xl animate-pulse" />
                        <div className="h-14 bg-white/70 rounded-xl animate-pulse" />
                        <div className="h-14 bg-white/70 rounded-xl animate-pulse" />
                      </div>
                    ) : previewOrg ? (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={previewOrg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className="pt-5 space-y-4"
                        >
                          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#101828] via-[#172240] to-[#232054] text-white flex items-center justify-between gap-4 shadow-[0_16px_34px_rgba(16,24,40,0.18)] border border-white/15">
                            <div>
                              <p className="text-xs text-[#A8EAF5]">
                                Currently Serving · {previewOrg.location}
                              </p>
                              <div className="mt-1 flex items-baseline gap-3">
                                <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                                  {previewOrg.currentlyServing[0]?.tokenCode || '—'}
                                </span>
                                <span className="text-xs text-emerald-400 font-medium">
                                  {previewOrg.currentlyServing.length > 0
                                    ? `${previewOrg.currentlyServing.length} active ${
                                        previewOrg.currentlyServing.length === 1
                                          ? 'counter'
                                          : 'counters'
                                      }`
                                    : 'Ready for next call'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-300">Waiting</p>
                              <p className="font-mono text-xl font-semibold tabular-nums">
                                {previewOrg.totalWaiting}
                              </p>
                            </div>
                          </div>

                          <div className="divide-y divide-sky-100/90">
                            {previewOrg.services.map((svc) => (
                              <div
                                key={svc.id}
                                className="py-3.5 flex items-center justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#101828] truncate">
                                    {svc.name}
                                  </p>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    Prefix {svc.prefix} · {svc.waitingCount} waiting ·{' '}
                                    {formatWaitLabel(svc.estimatedWaitMinutes)}
                                  </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-3">
                                  <span className="font-mono text-sm font-semibold text-[#101828] tabular-nums">
                                    {svc.servingTokens[0]?.tokenCode ||
                                      `${svc.prefix}-000`}
                                  </span>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      onNavigate(
                                        `/book?org=${previewOrg.slug}&service=${svc.id}`
                                      )
                                    }
                                  >
                                    Book
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <p className="py-8 text-sm text-slate-500 text-center">
                        No active queues right now.
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-sky-100/90 flex items-center justify-between text-xs text-slate-600">
                    <span>Real-time WebSocket sync enabled</span>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate(
                          previewOrg ? `/display/${previewOrg.slug}` : '/display'
                        )
                      }
                      className="font-semibold text-[#356DF3] hover:text-[#7859ED] transition-colors cursor-pointer"
                    >
                      Open full lobby display →
                    </button>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                <Card glass hoverable className="p-5 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Active Organizations
                  </p>
                  <p className="font-display text-2xl font-bold text-[#101828] tabular-nums mt-1">
                    {stats ? stats.activeOrganizations : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Across 5 public sectors
                  </p>
                </Card>
                <Card glass hoverable className="p-5 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Tokens Served
                  </p>
                  <p className="font-display text-2xl font-bold text-[#101828] tabular-nums mt-1">
                    {stats ? stats.completedTokens : '—'}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Completed without lobby lines
                  </p>
                </Card>
                <Card glass hoverable className="p-5 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-medium">
                    In Active Queues
                  </p>
                  <p className="font-display text-2xl font-bold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent tabular-nums mt-1">
                    {stats ? stats.waitingTokens + stats.servingTokens : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats ? `${stats.priorityTokens} priority tickets` : 'Live count'}
                  </p>
                </Card>
                <Card glass hoverable className="p-5 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Avg Service Cycle
                  </p>
                  <p className="font-display text-2xl font-bold text-[#101828] tabular-nums mt-1">
                    {stats ? `${stats.avgServiceMinutes} min` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dynamic counter pacing
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="relative z-10 py-14 lg:py-20 bg-gradient-to-b from-transparent via-white/30 to-transparent"
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-semibold text-[#356DF3] mb-2">
                How QueueLess Works
              </p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]"
                style={{ textWrap: 'balance' }}
              >
                Three clear steps from booking at home to walking straight to
                your counter.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <Card glass hoverable className="p-7 rounded-3xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-sm font-semibold text-[#356DF3]">
                    01.
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center text-[#356DF3]">
                    <QrCode className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-[#101828] mb-2">
                  Book Digital Token
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Choose your organization and service department, select
                  standard or priority access, and receive an instant QR token
                  pass.
                </p>
              </Card>

              <Card glass hoverable className="p-7 rounded-3xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-sm font-semibold text-[#356DF3]">
                    02.
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center text-[#356DF3]">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-[#101828] mb-2">
                  Track Live Position
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Watch your exact queue rank, active counter numbers, and
                  recalculated arrival window update live via WebSockets.
                </p>
              </Card>

              <Card glass hoverable className="p-7 rounded-3xl">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-sm font-semibold text-[#7859ED]">
                    03.
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center text-[#7859ED]">
                    <BellRing className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-[#101828] mb-2">
                  Arrive Just In Time
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Receive pre-turn alerts when you are two spots away, then scan
                  your digital token directly at the assigned counter.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* SUPPORTED ORGANIZATIONS & SERVICES */}
        <section id="organizations" className="relative z-10 py-14 lg:py-20">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-xs font-semibold text-[#356DF3] mb-2">
                  Live Directory & Services
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]">
                  Supported Organizations
                </h2>
                <p className="text-sm text-slate-700 mt-1.5">
                  Select any live facility to reserve a digital token or inspect
                  its lobby screen.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-white/75 backdrop-blur-xl border border-white/90 shadow-[0_10px_28px_rgba(53,109,243,0.08)] rounded-xl">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer',
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white shadow-[0_6px_16px_rgba(53,109,243,0.28)]'
                        : 'text-slate-600 hover:text-[#101828] hover:bg-white/70'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrgs.map((org) => (
                <Card
                  key={org.id}
                  glass
                  hoverable
                  className="p-6 rounded-3xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-[#356DF3]">
                        {org.category}
                      </span>
                      <span>{org.services.length} services</span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#101828]">
                      {org.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {org.location}
                    </p>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                      {org.description}
                    </p>

                    {org.services.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-sky-100/80">
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">
                          Available Services
                        </p>
                        <p className="text-xs text-[#101828]/85 leading-relaxed">
                          {org.services
                            .slice(0, 3)
                            .map((s) => s.name)
                            .join(' · ')}
                          {org.services.length > 3
                            ? ` · +${org.services.length - 3} more`
                            : ''}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-3.5 border-t border-sky-100/90 flex items-center justify-between text-xs">
                      <StatusLabel
                        status={
                          org.currentlyServing.length > 0 ? 'serving' : 'waiting'
                        }
                      />
                      <span className="font-mono text-slate-600 tabular-nums">
                        {org.totalWaiting} waiting
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => onNavigate(`/book?org=${org.slug}`)}
                    >
                      Book Token
                      <ArrowRight className="w-3.5 h-3.5 ql-btn-arrow" />
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => onNavigate(`/display/${org.slug}`)}
                    >
                      Live Screen
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* PRIORITY SERVICE & CUSTOMER CONVENIENCE */}
        <section className="relative z-10 overflow-hidden py-16 lg:py-20 bg-gradient-to-b from-transparent via-white/25 to-transparent">
          <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <p className="text-xs font-semibold text-[#356DF3] mb-2">
                    Accessible & Fair Prioritization
                  </p>
                  <h2
                    className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]"
                    style={{ textWrap: 'balance' }}
                  >
                    Built for customer convenience and priority care.
                  </h2>
                  <p className="text-sm text-slate-700 mt-3 leading-relaxed">
                    Senior citizens, differently-abled visitors, and urgent
                    medical cases automatically route into the priority lane
                    while maintaining full transparency on every lobby screen.
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  <Card glass hoverable className="p-4 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4.5 h-4.5 text-[#356DF3]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#101828]">
                        Automated Priority Lane
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Priority tickets move ahead of standard queues
                        automatically when counters call the next visitor.
                      </p>
                    </div>
                  </Card>
                  <Card glass hoverable className="p-4 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center shrink-0">
                      <Users className="w-4.5 h-4.5 text-[#356DF3]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#101828]">
                        Zero Crowded Waiting Rooms
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Wait comfortably from home, a nearby cafe, or your car
                        until your pre-turn alert arrives.
                      </p>
                    </div>
                  </Card>
                  <Card glass hoverable className="p-4 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D9F3FF] to-[#E6E0FF] border border-white flex items-center justify-center shrink-0">
                      <Building2 className="w-4.5 h-4.5 text-[#7859ED]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#101828]">
                        Multi-Counter Operations & Analytics
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Administrators manage services, staff counters, and
                        hourly throughput analytics from one unified console.
                      </p>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 rounded-3xl overflow-hidden border-2 border-white/95 shadow-[0_20px_50px_rgba(53,109,243,0.14)] bg-white/80 backdrop-blur-md aspect-[16/9]">
                  {!imgErrors['atrium'] ? (
                    <img
                      src="/src/assets/images/calm_service_atrium_1795681279210.jpg"
                      alt="Calm sunlit civic and healthcare atrium with zero waiting lines"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, atrium: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500">
                      <Building2 className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">
                        Calm Modern Service Atrium
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl overflow-hidden border-2 border-white/95 shadow-[0_16px_38px_rgba(53,109,243,0.12)] bg-white/80 backdrop-blur-md aspect-[4/3]">
                  {!imgErrors['medical'] ? (
                    <img
                      src="/src/assets/images/medical_reception_desk_1795681279462.jpg"
                      alt="Hospital outpatient reception lounge"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, medical: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500">
                      <ShieldCheck className="w-7 h-7 mb-2" />
                      <span className="text-xs font-medium">
                        Hospital Outpatient Reception
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl overflow-hidden border-2 border-white/95 shadow-[0_16px_38px_rgba(120,89,237,0.12)] bg-white/80 backdrop-blur-md aspect-[4/3]">
                  {!imgErrors['bank'] ? (
                    <img
                      src="/src/assets/images/modern_bank_lounge_1795681279651.jpg"
                      alt="Minimalist banking and advisory lounge"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, bank: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500">
                      <Clock className="w-7 h-7 mb-2" />
                      <span className="text-xs font-medium">
                        Banking Advisory Lounge
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEAMLESS GLASS FOOTER */}
        <footer className="relative z-10 border-t border-white/85 bg-white/55 backdrop-blur-2xl py-10 mt-auto">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-display text-base font-bold text-[#101828]">
                QueueLess
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Your Time Matters. Skip the Queue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-700">
              <button
                type="button"
                onClick={() => onNavigate('/book')}
                className="hover:text-[#356DF3] transition-colors cursor-pointer"
              >
                Book Token
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/my-tokens')}
                className="hover:text-[#356DF3] transition-colors cursor-pointer"
              >
                Track Position
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/display')}
                className="hover:text-[#356DF3] transition-colors cursor-pointer"
              >
                Live Display
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="hover:text-[#356DF3] transition-colors cursor-pointer"
              >
                Admin Console
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
