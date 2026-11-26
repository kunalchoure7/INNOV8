import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Maximize2,
  Minimize2,
  Moon,
  ShieldAlert,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { Button, Select } from '../components/ui';
import { cn, playNotificationChime } from '../lib/utils';
import type { LiveDisplayData, OrganizationSummary } from '../types/queue';

interface LiveDisplayPageProps {
  initialSlug?: string;
  onNavigate: (path: string) => void;
}

export const LiveDisplayPage: React.FC<LiveDisplayPageProps> = ({
  initialSlug,
  onNavigate,
}) => {
  const { subscribeQueueEvents } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug || '');
  const [displayData, setDisplayData] = useState<LiveDisplayData | null>(null);
  const [darkBoard, setDarkBoard] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [lastCallBanner, setLastCallBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadList = async () => {
      try {
        const res = await fetch('/api/public/organizations');
        if (res.ok) {
          const data = await res.json();
          const list: OrganizationSummary[] = data.organizations || [];
          setOrganizations(list);
          if (!selectedSlug && list.length > 0) {
            setSelectedSlug(list[0].slug);
          }
        }
      } catch (err) {
        console.error('Failed to fetch org list:', err);
      }
    };
    loadList();
  }, [selectedSlug]);

  const loadDisplay = useCallback(async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/public/display/${encodeURIComponent(slug)}`);
      if (res.ok) {
        setDisplayData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load display data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      loadDisplay(selectedSlug);
    }
  }, [selectedSlug, loadDisplay]);

  useEffect(() => {
    const unsub = subscribeQueueEvents((msg) => {
      if (msg.type === 'connected') return;
      if (selectedSlug) {
        loadDisplay(selectedSlug);
      }
      if (
        msg.type === 'token:called' &&
        displayData?.organization.id === msg.organizationId &&
        msg.tokenCode
      ) {
        if (soundOn) playNotificationChime();
        setLastCallBanner(
          `${msg.tokenCode} — Proceed to ${msg.counterName || 'Counter'}`
        );
        setTimeout(() => setLastCallBanner(null), 6000);
      }
    });
    return unsub;
  }, [
    subscribeQueueEvents,
    selectedSlug,
    loadDisplay,
    displayData?.organization.id,
    soundOn,
  ]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const activeCountersCount =
    displayData?.counters.filter((c) => c.status === 'active').length ?? 0;

  return (
    <div
      className={cn(
        'relative min-h-[calc(100vh-4rem)] overflow-hidden transition-colors duration-200',
        darkBoard
          ? 'bg-gradient-to-br from-[#0B1221] via-[#101828] to-[#1D1B4B] text-white'
          : 'text-[#101828]'
      )}
    >
      {!darkBoard && <AmbientBackdrop />}

      <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Top Broadcast Toolbar */}
        <div
          className={cn(
            'flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b',
            darkBoard ? 'border-slate-800' : 'border-white/80'
          )}
        >
          <div>
            <p
              className={cn(
                'text-xs font-semibold',
                darkBoard ? 'text-[#A8EAF5]' : 'text-[#356DF3]'
              )}
            >
              Public Live Display Screen
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
              {displayData?.organization.name || 'Loading Display...'}
            </h1>
            <p
              className={cn(
                'text-xs mt-1',
                darkBoard ? 'text-slate-400' : 'text-slate-600'
              )}
            >
              {displayData?.organization.location} ·{' '}
              {displayData?.organization.category} · {activeCountersCount} counters
              open
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-60">
              <Select
                value={selectedSlug}
                onChange={(e) => {
                  const slug = e.target.value;
                  setSelectedSlug(slug);
                  onNavigate(`/display/${slug}`);
                }}
                className={cn(
                  darkBoard
                    ? 'bg-slate-900/90 border-slate-700 text-white focus:bg-slate-900'
                    : ''
                )}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.slug}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </div>

            <div
              className={cn(
                'px-3.5 py-2 rounded-xl border font-mono text-sm font-semibold tabular-nums backdrop-blur-md',
                darkBoard
                  ? 'bg-slate-900/90 border-slate-700 text-slate-100'
                  : 'bg-white/80 border-white/95 text-[#101828] shadow-[0_6px_18px_rgba(53,109,243,0.08)]'
              )}
            >
              {format(now, 'HH:mm:ss')}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSoundOn((v) => !v)}
              className={cn(
                darkBoard &&
                  'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
              )}
            >
              {soundOn ? (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              Chime
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDarkBoard((v) => !v)}
              className={cn(
                darkBoard &&
                  'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
              )}
            >
              {darkBoard ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#7859ED]" />
              )}
              {darkBoard ? 'Sky Light' : 'Lobby Dark'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFullscreen}
              className={cn(
                darkBoard &&
                  'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
              )}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              Fullscreen
            </Button>
          </div>
        </div>

        {/* Live Call Announcement Banner */}
        <AnimatePresence>
          {lastCallBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-5 rounded-2xl bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white flex items-center justify-between gap-4 shadow-[0_18px_40px_rgba(53,109,243,0.34)] border border-white/25"
            >
              <span className="font-display text-lg sm:text-2xl font-bold tracking-tight">
                NOW SERVING: {lastCallBanner}
              </span>
              <span className="font-mono text-xs uppercase tracking-wider">
                Please Proceed
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: NOW SERVING Counters */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2
                className={cn(
                  'font-display text-sm sm:text-base font-bold uppercase tracking-widest',
                  darkBoard ? 'text-[#A8EAF5]' : 'text-[#356DF3]'
                )}
              >
                NOW SERVING
              </h2>
              <span
                className={cn(
                  'text-xs font-medium',
                  darkBoard ? 'text-slate-400' : 'text-slate-600'
                )}
              >
                {activeCountersCount} available{' '}
                {activeCountersCount === 1 ? 'counter' : 'counters'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayData?.counters.map((counter) => (
                <div
                  key={counter.id}
                  className={cn(
                    'p-6 rounded-3xl border transition-all duration-200',
                    darkBoard
                      ? 'bg-slate-900/80 backdrop-blur-xl border-slate-700/80 shadow-[0_18px_40px_rgba(0,0,0,0.28)]'
                      : 'bg-white/82 backdrop-blur-xl border-white/95 shadow-[0_18px_46px_rgba(53,109,243,0.11)]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-sky-100/70">
                    <div>
                      <p className="font-display text-base font-bold">
                        {counter.name}
                      </p>
                      <p
                        className={cn(
                          'text-xs',
                          darkBoard ? 'text-slate-400' : 'text-slate-600'
                        )}
                      >
                        {counter.serviceName} · {counter.staffName}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        counter.status === 'active'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      )}
                    >
                      {counter.status === 'active' ? 'Open' : 'Paused'}
                    </span>
                  </div>

                  {counter.currentToken ? (
                    <div>
                      <p
                        className={cn(
                          'font-mono text-5xl sm:text-6xl font-bold tabular-nums tracking-tight',
                          darkBoard ? 'text-white' : 'text-[#101828]'
                        )}
                      >
                        {counter.currentToken.tokenCode}
                      </p>
                      <p
                        className={cn(
                          'text-sm mt-2.5 font-medium truncate',
                          darkBoard ? 'text-slate-200' : 'text-slate-700'
                        )}
                      >
                        {counter.currentToken.customerName}
                      </p>
                      {counter.currentToken.isPriority && (
                        <p className="inline-flex items-center gap-1.5 text-xs text-[#7859ED] font-semibold mt-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Priority Lane
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-5">
                      <p
                        className={cn(
                          'font-mono text-4xl font-semibold',
                          darkBoard ? 'text-slate-600' : 'text-slate-300'
                        )}
                      >
                        —
                      </p>
                      <p
                        className={cn(
                          'text-xs mt-1',
                          darkBoard ? 'text-slate-500' : 'text-slate-500'
                        )}
                      >
                        Ready for next visitor
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {displayData && displayData.recentlyCompleted.length > 0 && (
              <div
                className={cn(
                  'p-4 rounded-2xl border',
                  darkBoard
                    ? 'bg-slate-900/70 border-slate-800'
                    : 'bg-white/78 backdrop-blur-xl border-white/90 shadow-[0_12px_30px_rgba(53,109,243,0.08)]'
                )}
              >
                <p
                  className={cn(
                    'text-xs font-semibold mb-2.5',
                    darkBoard ? 'text-slate-400' : 'text-slate-500'
                  )}
                >
                  Recently Completed
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {displayData.recentlyCompleted.map((tk) => (
                    <span
                      key={tk.id}
                      className={cn(
                        'font-mono text-sm font-medium tabular-nums',
                        darkBoard ? 'text-slate-300' : 'text-slate-700'
                      )}
                    >
                      {tk.tokenCode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Up Next Waiting Queue */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2
                className={cn(
                  'font-display text-sm sm:text-base font-bold uppercase tracking-widest',
                  darkBoard ? 'text-slate-300' : 'text-[#101828]'
                )}
              >
                Next Tokens
              </h2>
              <span
                className={cn(
                  'font-mono text-xs tabular-nums font-semibold',
                  darkBoard ? 'text-slate-400' : 'text-[#356DF3]'
                )}
              >
                {displayData?.waitingQueue.length || 0} waiting
              </span>
            </div>

            <div
              className={cn(
                'rounded-3xl border divide-y overflow-hidden',
                darkBoard
                  ? 'bg-slate-900/80 backdrop-blur-xl border-slate-800 divide-slate-800'
                  : 'bg-white/82 backdrop-blur-xl border-white/95 divide-sky-100/90 shadow-[0_18px_46px_rgba(53,109,243,0.11)]'
              )}
            >
              {!displayData || displayData.waitingQueue.length === 0 ? (
                <div className="p-8 text-center">
                  <p
                    className={cn(
                      'text-sm',
                      darkBoard ? 'text-slate-400' : 'text-slate-600'
                    )}
                  >
                    No visitors currently waiting.
                  </p>
                </div>
              ) : (
                displayData.waitingQueue.slice(0, 8).map((tk, idx) => (
                  <div
                    key={tk.id}
                    className="px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={cn(
                          'font-mono text-xs w-6 tabular-nums',
                          darkBoard ? 'text-slate-500' : 'text-slate-400'
                        )}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-2xl font-bold tabular-nums">
                            {tk.tokenCode}
                          </span>
                          {tk.isPriority && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7859ED]">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Priority
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            'text-xs truncate mt-0.5',
                            darkBoard ? 'text-slate-400' : 'text-slate-600'
                          )}
                        >
                          {tk.serviceName} · {tk.customerName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          'font-mono text-xs tabular-nums',
                          idx === 0
                            ? 'text-[#356DF3] font-bold'
                            : darkBoard
                              ? 'text-slate-400'
                              : 'text-slate-600'
                        )}
                      >
                        {idx === 0 ? 'Next Up' : `~${(idx + 1) * 6}m`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
