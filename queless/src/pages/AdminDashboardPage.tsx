import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  Layers,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Settings2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import {
  Button,
  Card,
  Input,
  Select,
  StatusLabel,
  Textarea,
} from '../components/ui';
import { cn } from '../lib/utils';
import type { AdminWorkspaceData, OrganizationSummary } from '../types/queue';

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
}

const createOrgSchema = z.object({
  name: z.string().trim().min(3, 'Organization name is required'),
  category: z.enum([
    'Hospital',
    'Bank',
    'Government',
    'College',
    'Service Centre',
  ]),
  location: z.string().trim().min(3, 'Location is required'),
  description: z.string().trim().min(5, 'Brief description is required'),
  serviceName: z.string().trim().min(2, 'Initial service name is required'),
  servicePrefix: z
    .string()
    .trim()
    .min(1, 'Prefix required')
    .max(2, 'Max 2 characters'),
  avgServiceMinutes: z.number().int().min(1).max(120),
  counterName: z.string().trim().min(2, 'Counter name is required'),
  staffName: z.string().trim().min(2, 'Staff name is required'),
});

const createServiceSchema = z.object({
  name: z.string().trim().min(2, 'Service name required'),
  prefix: z.string().trim().min(1).max(2),
  avgServiceMinutes: z.number().int().min(1).max(120),
  priorityEnabled: z.boolean(),
});

const createCounterSchema = z.object({
  name: z.string().trim().min(2, 'Counter name required'),
  staffName: z.string().trim().min(2, 'Staff name required'),
  serviceId: z.string(),
});

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigate,
}) => {
  const {
    firebaseUser,
    profile,
    loading: authLoading,
    signInWithGoogle,
    apiFetch,
    subscribeQueueEvents,
  } = useAuth();

  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number>(0);
  const [workspace, setWorkspace] = useState<AdminWorkspaceData | null>(null);
  const [activeTab, setActiveTab] = useState<
    'operations' | 'analytics' | 'setup'
  >('operations');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyCounterId, setBusyCounterId] = useState<number | null>(null);

  const orgForm = useForm<z.infer<typeof createOrgSchema>>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      category: 'Hospital',
      location: '',
      description: '',
      serviceName: 'General Desk',
      servicePrefix: 'A',
      avgServiceMinutes: 8,
      counterName: 'Counter 01',
      staffName: '',
    },
  });

  const serviceForm = useForm<z.infer<typeof createServiceSchema>>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: '',
      prefix: 'S',
      avgServiceMinutes: 8,
      priorityEnabled: true,
    },
  });

  const counterForm = useForm<z.infer<typeof createCounterSchema>>({
    resolver: zodResolver(createCounterSchema),
    defaultValues: {
      name: '',
      staffName: '',
      serviceId: '',
    },
  });

  const loadOrganizations = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await apiFetch<{ organizations: OrganizationSummary[] }>(
        '/api/admin/organizations'
      );
      const list = res.organizations || [];
      setOrgs(list);
      if (list.length > 0 && !selectedOrgId) {
        const managedFirst = list.find((o) => o.canManage) || list[0];
        setSelectedOrgId(managedFirst.id);
      }
    } catch (err) {
      console.error('Failed to load admin organizations:', err);
    }
  }, [firebaseUser, apiFetch, selectedOrgId]);

  const loadWorkspace = useCallback(
    async (orgId: number) => {
      if (!firebaseUser || !orgId) return;
      const orgMeta = orgs.find((o) => o.id === orgId);
      if (orgMeta && !orgMeta.canManage) {
        setWorkspace(null);
        return;
      }
      try {
        const data = await apiFetch<AdminWorkspaceData>(
          `/api/admin/organizations/${orgId}/workspace`
        );
        setWorkspace(data);
        setActionError(null);
      } catch (err: unknown) {
        setWorkspace(null);
        if (err instanceof Error && !err.message.includes('Forbidden')) {
          setActionError(err.message);
        }
      }
    },
    [firebaseUser, orgs, apiFetch]
  );

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      loadWorkspace(selectedOrgId);
    }
  }, [selectedOrgId, loadWorkspace]);

  useEffect(() => {
    const unsub = subscribeQueueEvents((msg) => {
      if (msg.type === 'connected') return;
      if (selectedOrgId) loadWorkspace(selectedOrgId);
    });
    return unsub;
  }, [subscribeQueueEvents, selectedOrgId, loadWorkspace]);

  const selectedOrgMeta = orgs.find((o) => o.id === selectedOrgId);

  const handleCallNext = async (counterId: number) => {
    if (!selectedOrgId) return;
    setBusyCounterId(counterId);
    setActionError(null);
    try {
      await apiFetch(
        `/api/admin/organizations/${selectedOrgId}/counters/${counterId}/call-next`,
        { method: 'POST' }
      );
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Call next failed.');
    } finally {
      setBusyCounterId(null);
    }
  };

  const handleFinishCounter = async (
    counterId: number,
    outcome: 'completed' | 'no_show'
  ) => {
    if (!selectedOrgId) return;
    setBusyCounterId(counterId);
    setActionError(null);
    try {
      await apiFetch(
        `/api/admin/organizations/${selectedOrgId}/counters/${counterId}/finish`,
        {
          method: 'POST',
          body: JSON.stringify({ outcome }),
        }
      );
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusyCounterId(null);
    }
  };

  const handleToggleCounter = async (
    counterId: number,
    nextStatus: 'active' | 'paused'
  ) => {
    if (!selectedOrgId) return;
    try {
      await apiFetch(
        `/api/admin/organizations/${selectedOrgId}/counters/${counterId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to toggle counter.'
      );
    }
  };

  const handleCreateOrg = async (values: z.infer<typeof createOrgSchema>) => {
    setActionError(null);
    try {
      const res = await apiFetch<{ organization: OrganizationSummary }>(
        '/api/admin/organizations',
        {
          method: 'POST',
          body: JSON.stringify(values),
        }
      );
      setShowNewOrgModal(false);
      orgForm.reset();
      await loadOrganizations();
      setSelectedOrgId(res.organization.id);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to create organization.'
      );
    }
  };

  const handleCreateService = async (
    values: z.infer<typeof createServiceSchema>
  ) => {
    if (!selectedOrgId) return;
    try {
      await apiFetch(`/api/admin/organizations/${selectedOrgId}/services`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      serviceForm.reset();
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to create service.'
      );
    }
  };

  const handleToggleServiceOpen = async (serviceId: number, isOpen: boolean) => {
    if (!selectedOrgId) return;
    try {
      await apiFetch(
        `/api/admin/organizations/${selectedOrgId}/services/${serviceId}/open`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isOpen }),
        }
      );
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update service.'
      );
    }
  };

  const handleCreateCounter = async (
    values: z.infer<typeof createCounterSchema>
  ) => {
    if (!selectedOrgId) return;
    try {
      await apiFetch(`/api/admin/organizations/${selectedOrgId}/counters`, {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          staffName: values.staffName,
          serviceId: values.serviceId ? Number(values.serviceId) : null,
        }),
      });
      counterForm.reset();
      await loadWorkspace(selectedOrgId);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to create counter.'
      );
    }
  };

  if (authLoading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden py-14">
        <AmbientBackdrop />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="h-40 bg-white/75 rounded-3xl border border-white animate-pulse" />
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden py-16">
        <AmbientBackdrop />
        <div className="relative z-10 max-w-[640px] mx-auto px-4 sm:px-6">
          <Card glass className="p-8 text-center rounded-3xl">
            <h1 className="font-display text-2xl font-bold text-[#101828]">
              Organization Admin Console
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Sign in with Google to manage counters, call waiting visitors,
              configure services, and inspect live queue analytics.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => signInWithGoogle()}
              >
                Sign In with Google
              </Button>
              <Button
                variant="glass"
                size="lg"
                onClick={() => onNavigate('/display')}
              >
                View Public Display
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const filteredTokens = (workspace?.tokens || []).filter((tk) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? tk.status === 'waiting' || tk.status === 'serving'
          : tk.status === statusFilter;
    const matchesSearch =
      !searchTerm.trim() ||
      tk.tokenCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tk.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const navTabs = [
    { id: 'operations', label: 'Queue Operations', icon: Layers },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'setup', label: 'Services & Counters', icon: Settings2 },
  ] as const;

  const activeCountersCount =
    workspace?.counters.filter((c) => c.status === 'active').length ?? 0;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex flex-col lg:flex-row">
      <AmbientBackdrop />

      {/* Translucent White Glass Sidebar */}
      <aside className="relative z-10 lg:w-68 shrink-0 bg-white/74 backdrop-blur-2xl border-b lg:border-b-0 lg:border-r border-white/85 shadow-[0_10px_34px_rgba(53,109,243,0.08)] p-5 flex flex-col justify-between gap-6">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent">
              {profile?.role === 'admin' ? 'Platform Admin' : 'Workspace'}
            </p>
            <p className="text-xs text-slate-600 truncate mt-0.5">
              {profile?.email}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Active Organization
            </label>
            <Select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.canManage ? '' : '(Read-Only)'}
                </option>
              ))}
            </Select>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white shadow-[0_8px_20px_rgba(53,109,243,0.28)]'
                      : 'text-slate-700 hover:text-[#101828] hover:bg-white/70'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0',
                      active ? 'text-white' : 'text-[#356DF3]'
                    )}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-sky-100/90 space-y-2.5">
          {selectedOrgMeta && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => onNavigate(`/display/${selectedOrgMeta.slug}`)}
            >
              <Monitor className="w-3.5 h-3.5 text-[#356DF3]" />
              Lobby Display
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => setShowNewOrgModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            New Organization
          </Button>
        </div>
      </aside>

      {/* Main Workspace Content */}
      <div className="relative z-10 flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/80">
          <div>
            <p className="text-xs font-semibold text-[#356DF3]">
              {selectedOrgMeta?.category || 'Organization Console'} ·{' '}
              {selectedOrgMeta?.location || ''}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828] mt-0.5">
              {selectedOrgMeta?.name || 'Queue Operations Console'}
            </h1>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50/95 border border-rose-200 text-sm text-rose-700">
            {actionError}
          </div>
        )}

        {selectedOrgMeta && !selectedOrgMeta.canManage && (
          <Card glass className="mt-6 p-8 text-center rounded-3xl">
            <h2 className="font-display text-xl font-bold text-[#101828]">
              You do not have operator permissions for {selectedOrgMeta.name}
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
              Create your own organization workspace in seconds to manage live
              counters, call digital tokens, configure services, and view queue
              analytics.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => setShowNewOrgModal(true)}
              >
                <Plus className="w-4 h-4" />
                Create Your Organization
              </Button>
              <Button
                variant="secondary"
                onClick={() => onNavigate(`/display/${selectedOrgMeta.slug}`)}
              >
                Open Lobby Display
              </Button>
            </div>
          </Card>
        )}

        {workspace && (
          <>
            {/* TAB 1: QUEUE OPERATIONS */}
            {activeTab === 'operations' && (
              <div className="mt-6 space-y-8">
                {/* Quick Operations Stat Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card glass hoverable className="p-4 sm:p-5">
                    <p className="text-xs text-slate-500 font-medium">
                      Total Tokens
                    </p>
                    <p className="font-display text-2xl font-bold text-[#101828] tabular-nums mt-1">
                      {workspace.analytics.totalTokens}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-4 sm:p-5">
                    <p className="text-xs text-slate-500 font-medium">
                      Active Waiting
                    </p>
                    <p className="font-display text-2xl font-bold text-[#356DF3] tabular-nums mt-1">
                      {workspace.analytics.waitingCount}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-4 sm:p-5">
                    <p className="text-xs text-slate-500 font-medium">
                      Completed Today
                    </p>
                    <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                      {workspace.analytics.completedCount}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-4 sm:p-5">
                    <p className="text-xs text-slate-500 font-medium">
                      Open Counters
                    </p>
                    <p className="font-display text-2xl font-bold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent tabular-nums mt-1">
                      {activeCountersCount} / {workspace.counters.length}
                    </p>
                  </Card>
                </div>

                <div>
                  <h2 className="font-display text-base font-semibold text-[#101828] mb-3">
                    Active Service Counters
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {workspace.counters.map((counter) => (
                      <Card
                        glass
                        hoverable
                        key={counter.id}
                        className="p-5 rounded-3xl flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 pb-3 border-b border-sky-100/90">
                            <div>
                              <h3 className="font-display text-base font-semibold text-[#101828]">
                                {counter.name}
                              </h3>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {counter.serviceName} · {counter.staffName}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleCounter(
                                  counter.id,
                                  counter.status === 'active'
                                    ? 'paused'
                                    : 'active'
                                )
                              }
                              className={cn(
                                'inline-flex items-center gap-1 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80',
                                counter.status === 'active'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              )}
                            >
                              {counter.status === 'active' ? (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5" />
                                  Paused
                                </>
                              )}
                            </button>
                          </div>

                          <div className="py-5">
                            <p className="text-xs text-slate-500">
                              Currently Serving
                            </p>
                            {counter.currentToken ? (
                              <div className="mt-1">
                                <p className="font-mono text-3xl font-bold text-[#101828] tabular-nums">
                                  {counter.currentToken.tokenCode}
                                </p>
                                <p className="text-sm text-slate-700 font-medium mt-0.5">
                                  {counter.currentToken.customerName}
                                </p>
                              </div>
                            ) : (
                              <p className="font-mono text-2xl font-semibold text-slate-400 mt-1">
                                Idle
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-sky-100/90">
                          <Button
                            variant="primary"
                            className="w-full"
                            disabled={
                              busyCounterId === counter.id ||
                              counter.status !== 'active'
                            }
                            onClick={() => handleCallNext(counter.id)}
                          >
                            <UserCheck className="w-4 h-4" />
                            {busyCounterId === counter.id
                              ? 'Calling...'
                              : 'Call Next Token'}
                          </Button>

                          {counter.currentToken && (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleFinishCounter(counter.id, 'completed')
                                }
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Complete
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  handleFinishCounter(counter.id, 'no_show')
                                }
                              >
                                <XCircle className="w-3.5 h-3.5 text-amber-600" />
                                No-Show
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Live Queue Table */}
                <Card glass className="overflow-hidden rounded-3xl">
                  <div className="p-5 border-b border-sky-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-base font-semibold text-[#101828]">
                        Queue Ledger
                      </h2>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {filteredTokens.length} tokens
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search code or name..."
                          className="pl-9 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1 p-1 bg-white/75 border border-[#9BD7FA]/75 rounded-xl">
                        {(['active', 'completed', 'all'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={cn(
                              'px-2.5 py-1 text-xs font-medium rounded-lg capitalize cursor-pointer transition-all',
                              statusFilter === st
                                ? 'bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white shadow-xs'
                                : 'text-slate-600 hover:text-[#101828]'
                            )}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-sky-100/90 text-xs font-semibold text-slate-600 bg-white/60">
                          <th className="py-3 px-5">Token</th>
                          <th className="py-3 px-4">Visitor</th>
                          <th className="py-3 px-4">Service</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-5 text-right">Booked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100/70 text-sm">
                        {filteredTokens.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-10 text-center text-xs text-slate-500"
                            >
                              No matching tokens in this view.
                            </td>
                          </tr>
                        ) : (
                          filteredTokens.map((tk) => (
                            <tr
                              key={tk.id}
                              className="hover:bg-white/60 transition-colors"
                            >
                              <td className="py-3 px-5 font-mono font-bold text-[#101828] tabular-nums">
                                {tk.tokenCode}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-[#101828]">
                                  {tk.customerName}
                                </p>
                                {tk.customerPhone && (
                                  <p className="text-xs text-slate-500 font-mono">
                                    {tk.customerPhone}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-xs">
                                {tk.serviceName}
                              </td>
                              <td className="py-3 px-4">
                                <StatusLabel
                                  status={tk.status}
                                  isPriority={tk.isPriority}
                                />
                              </td>
                              <td className="py-3 px-5 text-right font-mono text-xs text-slate-500 tabular-nums">
                                {format(new Date(tk.bookedAt), 'HH:mm')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 2: ANALYTICS */}
            {activeTab === 'analytics' && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card glass hoverable className="p-5">
                    <p className="text-xs text-slate-500">Total Tokens</p>
                    <p className="font-display text-2xl font-bold text-[#101828] tabular-nums mt-1">
                      {workspace.analytics.totalTokens}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-5">
                    <p className="text-xs text-slate-500">Completed Visits</p>
                    <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                      {workspace.analytics.completedCount}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-5">
                    <p className="text-xs text-slate-500">Currently Waiting</p>
                    <p className="font-display text-2xl font-bold text-[#356DF3] tabular-nums mt-1">
                      {workspace.analytics.waitingCount}
                    </p>
                  </Card>
                  <Card glass hoverable className="p-5">
                    <p className="text-xs text-slate-500">Avg Wait Time</p>
                    <p className="font-display text-2xl font-bold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent tabular-nums mt-1">
                      {workspace.analytics.avgActualWaitMinutes} min
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card glass className="p-6 rounded-3xl">
                    <h3 className="font-display text-base font-semibold text-[#101828] mb-1">
                      Hourly Token Volume
                    </h3>
                    <p className="text-xs text-slate-600 mb-6">
                      Booked vs completed tokens across active hours
                    </p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workspace.analytics.hourlySeries}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#CBE7FA"
                          />
                          <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 12, fill: '#475569' }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: '#475569' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255,255,255,0.92)',
                              borderRadius: '12px',
                              border: '1px solid #9BD7FA',
                              boxShadow: '0 12px 30px rgba(53,109,243,0.12)',
                            }}
                          />
                          <Bar
                            dataKey="booked"
                            name="Booked"
                            fill="#356DF3"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="completed"
                            name="Completed"
                            fill="#7859ED"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card glass className="p-6 rounded-3xl">
                    <h3 className="font-display text-base font-semibold text-[#101828] mb-1">
                      Department Demand
                    </h3>
                    <p className="text-xs text-slate-600 mb-6">
                      Total queue volume by service department
                    </p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workspace.analytics.serviceBreakdown}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#CBE7FA"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#475569' }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 12, fill: '#475569' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255,255,255,0.92)',
                              borderRadius: '12px',
                              border: '1px solid #9BD7FA',
                              boxShadow: '0 12px 30px rgba(53,109,243,0.12)',
                            }}
                          />
                          <Bar
                            dataKey="completed"
                            name="Completed"
                            fill="#0EA5E9"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="waiting"
                            name="Waiting"
                            fill="#7859ED"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 3: SERVICES & COUNTERS SETUP */}
            {activeTab === 'setup' && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card glass className="p-6 space-y-6 rounded-3xl">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#101828]">
                      Services & Queues
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Configure departments, token prefixes, and average service
                      duration.
                    </p>
                  </div>

                  <div className="divide-y divide-sky-100/90">
                    {workspace.services.map((svc) => (
                      <div
                        key={svc.id}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#101828]">
                            {svc.name}{' '}
                            <span className="font-mono text-xs text-slate-500">
                              ({svc.prefix})
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            Avg {svc.avgServiceMinutes} min · Priority{' '}
                            {svc.priorityEnabled ? 'Enabled' : 'Disabled'}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleToggleServiceOpen(svc.id, !svc.isOpen)
                          }
                        >
                          {svc.isOpen ? 'Open' : 'Paused'}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={serviceForm.handleSubmit(handleCreateService)}
                    className="pt-4 border-t border-sky-100/90 space-y-3"
                  >
                    <p className="text-xs font-semibold text-[#101828]">
                      Add Service Department
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Service Name"
                          {...serviceForm.register('name')}
                        />
                      </div>
                      <Input
                        placeholder="Prefix (e.g. X)"
                        maxLength={2}
                        {...serviceForm.register('prefix')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <Input
                        type="number"
                        placeholder="Avg Minutes"
                        {...serviceForm.register('avgServiceMinutes', {
                          valueAsNumber: true,
                        })}
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          {...serviceForm.register('priorityEnabled')}
                          className="rounded border-slate-300 text-[#356DF3]"
                        />
                        Priority lane enabled
                      </label>
                    </div>
                    <Button type="submit" variant="accent" size="sm">
                      <Plus className="w-3.5 h-3.5" />
                      Add Service
                    </Button>
                  </form>
                </Card>

                <Card glass className="p-6 space-y-6 rounded-3xl">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#101828]">
                      Service Counters
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Assign staff desks to specific queues or all services.
                    </p>
                  </div>

                  <div className="divide-y divide-sky-100/90">
                    {workspace.counters.map((ct) => (
                      <div
                        key={ct.id}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#101828]">
                            {ct.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {ct.staffName} · {ct.serviceName}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            ct.status === 'active'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          )}
                        >
                          {ct.status === 'active' ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={counterForm.handleSubmit(handleCreateCounter)}
                    className="pt-4 border-t border-sky-100/90 space-y-3"
                  >
                    <p className="text-xs font-semibold text-[#101828]">
                      Add Service Counter
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Counter Name (e.g. Desk 04)"
                        {...counterForm.register('name')}
                      />
                      <Input
                        placeholder="Staff Name"
                        {...counterForm.register('staffName')}
                      />
                    </div>
                    <Select {...counterForm.register('serviceId')}>
                      <option value="">All Services</option>
                      {workspace.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.prefix})
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="accent" size="sm">
                      <Plus className="w-3.5 h-3.5" />
                      Add Counter
                    </Button>
                  </form>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create New Organization Modal */}
      {showNewOrgModal && (
        <div
          className="fixed inset-0 z-50 bg-[#101828]/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewOrgModal(false)}
        >
          <Card
            glass
            className="max-w-lg w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-[#101828]">
              Create Organization Workspace
            </h2>
            <p className="text-xs text-slate-600 mt-1 mb-5">
              Set up your hospital, bank, office, college, or service centre with
              an initial queue and counter.
            </p>

            <form
              onSubmit={orgForm.handleSubmit(handleCreateOrg)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Organization Name
                  </label>
                  <Input
                    placeholder="e.g. City Care Clinic"
                    {...orgForm.register('name')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Sector
                  </label>
                  <Select {...orgForm.register('category')}>
                    <option value="Hospital">Hospital</option>
                    <option value="Bank">Bank</option>
                    <option value="Government">Government</option>
                    <option value="College">College</option>
                    <option value="Service Centre">Service Centre</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101828] mb-1">
                  Location
                </label>
                <Input
                  placeholder="e.g. Midtown Avenue, Suite 100"
                  {...orgForm.register('location')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101828] mb-1">
                  Description
                </label>
                <Textarea
                  rows={2}
                  placeholder="Short description of available services..."
                  {...orgForm.register('description')}
                />
              </div>

              <div className="pt-2 border-t border-sky-100/90 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    First Service
                  </label>
                  <Input {...orgForm.register('serviceName')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Prefix
                  </label>
                  <Input maxLength={2} {...orgForm.register('servicePrefix')} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Avg Min
                  </label>
                  <Input
                    type="number"
                    {...orgForm.register('avgServiceMinutes', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Counter Name
                  </label>
                  <Input {...orgForm.register('counterName')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1">
                    Staff Name
                  </label>
                  <Input
                    placeholder="Operator Name"
                    {...orgForm.register('staffName')}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowNewOrgModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={orgForm.formState.isSubmitting}
                >
                  {orgForm.formState.isSubmitting
                    ? 'Creating...'
                    : 'Create Organization'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
