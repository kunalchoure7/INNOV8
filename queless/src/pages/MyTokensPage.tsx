import React, { useCallback, useEffect, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  Monitor,
  QrCode,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { Button, Card, Input, StatusLabel } from '../components/ui';
import {
  cn,
  formatWaitLabel,
  playNotificationChime,
  PRIORITY_REASON_LABELS,
} from '../lib/utils';
import type { EnrichedToken, NotificationItem } from '../types/queue';

interface MyTokensPageProps {
  onNavigate: (path: string) => void;
}

export const MyTokensPage: React.FC<MyTokensPageProps> = ({ onNavigate }) => {
  const {
    firebaseUser,
    apiFetch,
    signInWithGoogle,
    subscribeQueueEvents,
  } = useAuth();
  const [myTokens, setMyTokens] = useState<EnrichedToken[]>([]);
  const [lookupResults, setLookupResults] = useState<EnrichedToken[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeQrToken, setActiveQrToken] = useState<EnrichedToken | null>(null);
  const [confirmCancelToken, setConfirmCancelToken] =
    useState<EnrichedToken | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runLookup = useCallback(async (query: string) => {
    const clean = query.trim();
    if (clean.length < 2) return;
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/public/tokens/lookup?q=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Token lookup failed.');
        return;
      }
      setLookupResults(data.tokens || []);
    } catch {
      setErrorMsg('Unable to search tokens right now.');
    }
  }, []);

  const loadUserWorkspace = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const [tokensRes, notifRes] = await Promise.all([
        apiFetch<{ tokens: EnrichedToken[] }>('/api/my/tokens'),
        apiFetch<{ notifications: NotificationItem[] }>('/api/my/notifications'),
      ]);
      setMyTokens(tokensRes.tokens || []);
      setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Failed to load user tokens:', err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, apiFetch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setSearchCode(codeParam);
      runLookup(codeParam);
    }
  }, [runLookup]);

  useEffect(() => {
    loadUserWorkspace();
  }, [loadUserWorkspace]);

  useEffect(() => {
    const unsub = subscribeQueueEvents((msg) => {
      if (msg.type === 'connected') return;
      if (firebaseUser) loadUserWorkspace();
      if (searchCode.trim().length >= 2) runLookup(searchCode);
      if (msg.type === 'token:called' && soundEnabled) {
        playNotificationChime();
      }
    });
    return unsub;
  }, [
    subscribeQueueEvents,
    firebaseUser,
    loadUserWorkspace,
    searchCode,
    runLookup,
    soundEnabled,
  ]);

  const handleConfirmCancel = async () => {
    if (!confirmCancelToken) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/tokens/${confirmCancelToken.id}/cancel`, {
        method: 'POST',
      });
      setConfirmCancelToken(null);
      await loadUserWorkspace();
      if (searchCode.trim().length >= 2) await runLookup(searchCode);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cancel token.');
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/my/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const displayedTokens =
    lookupResults.length > 0 && searchCode.trim().length >= 2
      ? lookupResults
      : myTokens;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <AmbientBackdrop />
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]">
              Live Queue Tracker
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              Monitor real-time queue position, estimated call times, and turn
              alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSoundEnabled((v) => !v)}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#356DF3]" />
                  Sound Alerts On
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  Sound Muted
                </>
              )}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('/book')}
            >
              Book New Token
              <ArrowRight className="w-3.5 h-3.5 ql-btn-arrow" />
            </Button>
          </div>
        </div>

        {/* Token Search Bar */}
        <Card glass className="p-4 sm:p-5 mb-8 rounded-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runLookup(searchCode);
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchCode}
                onChange={(e) => {
                  setSearchCode(e.target.value);
                  if (!e.target.value.trim()) setLookupResults([]);
                }}
                placeholder="Track any token by code (e.g. A-016) or phone number..."
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="accent">
              Track Token
            </Button>
            {lookupResults.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearchCode('');
                  setLookupResults([]);
                }}
              >
                Clear Filter
              </Button>
            )}
          </form>
          {errorMsg && (
            <p className="text-xs text-rose-600 mt-2">{errorMsg}</p>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Tokens List */}
          <div className="lg:col-span-8 space-y-5">
            {!firebaseUser && lookupResults.length === 0 && (
              <Card glass className="p-8 text-center rounded-3xl">
                <h2 className="font-display text-lg font-semibold text-[#101828]">
                  Sign in to view your saved tokens
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  Or enter any token code like{' '}
                  <span className="font-mono font-medium text-[#356DF3]">
                    A-016
                  </span>{' '}
                  above to track its live queue position without signing in.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() => signInWithGoogle()}
                  >
                    Sign In with Google
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchCode('A-016');
                      runLookup('A-016');
                    }}
                  >
                    Preview Token A-016
                  </Button>
                </div>
              </Card>
            )}

            {loading && displayedTokens.length === 0 && (
              <div className="space-y-4">
                <div className="h-36 bg-white/75 rounded-3xl border border-white animate-pulse" />
                <div className="h-36 bg-white/75 rounded-3xl border border-white animate-pulse" />
              </div>
            )}

            {firebaseUser && !loading && displayedTokens.length === 0 && (
              <Card glass className="p-8 text-center rounded-3xl">
                <h2 className="font-display text-lg font-semibold text-[#101828]">
                  No tokens found yet
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Book your first digital token to track your live position
                  here.
                </p>
                <Button
                  variant="primary"
                  className="mt-5"
                  onClick={() => onNavigate('/book')}
                >
                  Book Your Token
                  <ArrowRight className="w-4 h-4 ql-btn-arrow" />
                </Button>
              </Card>
            )}

            {displayedTokens.map((tk) => {
              const isTurnSoon =
                tk.status === 'waiting' && tk.positionInQueue <= 2;
              const estCallTime = addMinutes(new Date(), tk.dynamicEtaMinutes);
              const progressPercent =
                tk.status === 'serving' || tk.status === 'completed'
                  ? 100
                  : Math.max(
                      12,
                      Math.min(92, Math.round(100 - tk.peopleAhead * 18))
                    );

              return (
                <Card glass hoverable key={tk.id} className="p-6 rounded-3xl">
                  {tk.status === 'serving' && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50/95 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        It&apos;s your turn! Proceed to{' '}
                        {tk.counterName || 'Counter'}
                        {tk.staffName ? ` (${tk.staffName})` : ''}.
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        NOW SERVING
                      </span>
                    </div>
                  )}

                  {isTurnSoon && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-amber-50/95 border border-amber-200 text-amber-900 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        Almost your turn —{' '}
                        {tk.peopleAhead === 0
                          ? 'you are next in line'
                          : `${tk.peopleAhead} person ahead`}
                        . Please head toward the service area.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-3xl font-bold text-[#101828] tabular-nums">
                          {tk.tokenCode}
                        </span>
                        <StatusLabel
                          status={tk.status}
                          isPriority={tk.isPriority}
                        />
                      </div>
                      <p className="text-sm font-medium text-[#101828] mt-1.5">
                        {tk.organizationName} · {tk.serviceName}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {tk.customerName}
                        {tk.isPriority
                          ? ` · ${
                              PRIORITY_REASON_LABELS[tk.priorityReason] ||
                              'Priority'
                            }`
                          : ''}
                        {' · '}Booked {format(new Date(tk.bookedAt), 'HH:mm')}
                      </p>
                    </div>

                    {tk.status === 'waiting' && (
                      <div className="flex items-center gap-6 sm:text-right">
                        <div>
                          <p className="text-xs text-slate-500">Position</p>
                          <p className="font-mono text-2xl font-bold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent tabular-nums">
                            #{tk.positionInQueue}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Est. Turn</p>
                          <p className="font-mono text-2xl font-bold text-[#101828] tabular-nums">
                            {format(estCallTime, 'HH:mm')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatWaitLabel(tk.dynamicEtaMinutes)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Queue Progress Indicator */}
                  {(tk.status === 'waiting' || tk.status === 'serving') && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                        <span>Queue Progress</span>
                        <span className="font-mono tabular-nums text-[#356DF3] font-semibold">
                          {tk.status === 'serving'
                            ? 'At Counter'
                            : `${tk.peopleAhead} ahead`}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/80 border border-sky-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#356DF3] via-[#5E63F0] to-[#7859ED] transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-sky-100/90 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      Currently Serving:{' '}
                      <span className="font-mono font-semibold text-[#101828]">
                        {tk.currentlyServingCode || 'Ready'}
                      </span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() =>
                          onNavigate(`/display/${tk.organizationSlug}`)
                        }
                      >
                        <Monitor className="w-3.5 h-3.5 text-[#356DF3]" />
                        Lobby Screen
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => setActiveQrToken(tk)}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Pass
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onNavigate(
                            `/book?org=${tk.organizationSlug}&service=${tk.serviceId}`
                          )
                        }
                      >
                        Reschedule
                      </Button>
                      {tk.status === 'waiting' && firebaseUser && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmCancelToken(tk)}
                        >
                          Cancel Token
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Notifications Sidebar */}
          <Card glass className="lg:col-span-4 p-6 rounded-3xl">
            <div className="flex items-center justify-between pb-4 border-b border-sky-100/90">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#356DF3]" />
                <h2 className="font-display text-base font-semibold text-[#101828]">
                  Turn Alerts
                </h2>
                {unreadCount > 0 && (
                  <span className="font-mono text-xs font-semibold text-[#7859ED]">
                    ({unreadCount})
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-[#356DF3] transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark read
                </button>
              )}
            </div>

            {!firebaseUser ? (
              <p className="py-6 text-xs text-slate-600 leading-relaxed">
                Sign in with Google when booking to receive persistent turn-soon
                and counter-call alerts here.
              </p>
            ) : notifications.length === 0 ? (
              <p className="py-6 text-xs text-slate-600">
                No notifications yet. Alerts appear here automatically as your
                queue advances.
              </p>
            ) : (
              <div className="divide-y divide-sky-100/80 max-h-[460px] overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'py-3.5 transition-colors',
                      !n.isRead ? 'bg-[#D9F3FF]/60 -mx-2 px-2 rounded-xl' : ''
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#101828]">
                        {n.title}
                      </p>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {format(new Date(n.createdAt), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* QR Code Modal */}
        {activeQrToken && (
          <div
            className="fixed inset-0 z-50 bg-[#101828]/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActiveQrToken(null)}
          >
            <Card
              glass
              className="max-w-sm w-full p-6 text-center rounded-3xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <p className="text-xs text-slate-500 font-medium">
                {activeQrToken.organizationName}
              </p>
              <h3 className="font-mono text-3xl font-bold text-[#101828] mt-1">
                {activeQrToken.tokenCode}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 mb-5">
                {activeQrToken.serviceName} · {activeQrToken.customerName}
              </p>
              <div className="inline-flex p-4 bg-white rounded-2xl border border-[#9BD7FA]/80 shadow-sm">
                <QRCodeSVG
                  value={`queueless://token/${activeQrToken.tokenCode}?org=${activeQrToken.organizationSlug}`}
                  size={180}
                  bgColor="#FFFFFF"
                  fgColor="#101828"
                />
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Show this QR code at the reception kiosk or counter.
              </p>
              <Button
                variant="secondary"
                className="w-full mt-5"
                onClick={() => setActiveQrToken(null)}
              >
                Close
              </Button>
            </Card>
          </div>
        )}

        {/* Cancel Token Confirmation Dialog */}
        {confirmCancelToken && (
          <div
            className="fixed inset-0 z-50 bg-[#101828]/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !cancelling && setConfirmCancelToken(null)}
          >
            <Card
              glass
              className="max-w-sm w-full p-6 rounded-3xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#101828]">
                    Cancel Token {confirmCancelToken.tokenCode}?
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    This will release your queue spot at{' '}
                    <span className="font-medium text-[#101828]">
                      {confirmCancelToken.organizationName}
                    </span>{' '}
                    ({confirmCancelToken.serviceName}). You can book a new token
                    anytime.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cancelling}
                  onClick={() => setConfirmCancelToken(null)}
                >
                  Keep Spot
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={cancelling}
                  onClick={handleConfirmCancel}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
