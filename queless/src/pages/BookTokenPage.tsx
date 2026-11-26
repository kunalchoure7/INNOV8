import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addMinutes, format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { Button, Card, Input, Select, Textarea } from '../components/ui';
import { cn, formatWaitLabel, PRIORITY_REASON_LABELS } from '../lib/utils';
import type { OrganizationSummary, TokenRecord } from '../types/queue';

interface BookTokenPageProps {
  onNavigate: (path: string) => void;
}

const bookingSchema = z.object({
  organizationId: z.number().int().positive('Select an organization'),
  serviceId: z.number().int().positive('Select a service queue'),
  customerName: z.string().trim().min(2, 'Enter full name (min 2 characters)'),
  customerPhone: z
    .string()
    .trim()
    .min(6, 'Enter a valid phone number for turn alerts'),
  customerEmail: z
    .string()
    .trim()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  isPriority: z.boolean(),
  priorityReason: z.enum([
    'standard',
    'senior',
    'disability',
    'emergency',
    'vip',
  ]),
  notes: z.string().trim().max(240).optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookedConfirmation {
  token: TokenRecord;
  organizationName: string;
  organizationSlug: string;
  serviceName: string;
  positionInQueue: number;
  estimatedWaitMinutes: number;
}

export const BookTokenPage: React.FC<BookTokenPageProps> = ({ onNavigate }) => {
  const { firebaseUser, profile, apiFetch, signInWithGoogle } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookedConfirmation | null>(
    null
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      organizationId: 0,
      serviceId: 0,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      isPriority: false,
      priorityReason: 'standard',
      notes: '',
    },
  });

  const watchedOrgId = watch('organizationId');
  const watchedSvcId = watch('serviceId');
  const watchedIsPriority = watch('isPriority');

  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const res = await fetch('/api/public/organizations');
        if (res.ok) {
          const data = await res.json();
          const list: OrganizationSummary[] = data.organizations || [];
          setOrganizations(list);

          const params = new URLSearchParams(window.location.search);
          const orgSlug = params.get('org');
          const svcParam = Number(params.get('service'));

          const matchedOrg =
            list.find((o) => o.slug === orgSlug) || list[0];
          if (matchedOrg) {
            setValue('organizationId', matchedOrg.id);
            const matchedSvc =
              matchedOrg.services.find((s) => s.id === svcParam) ||
              matchedOrg.services.find((s) => s.isOpen) ||
              matchedOrg.services[0];
            if (matchedSvc) {
              setValue('serviceId', matchedSvc.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    };
    loadOrgs();
  }, [setValue]);

  useEffect(() => {
    if (profile) {
      setValue('customerName', profile.name || '');
      if (profile.phone) setValue('customerPhone', profile.phone);
      if (profile.email) setValue('customerEmail', profile.email);
    } else if (firebaseUser) {
      if (firebaseUser.displayName)
        setValue('customerName', firebaseUser.displayName);
      if (firebaseUser.email) setValue('customerEmail', firebaseUser.email);
    }
  }, [profile, firebaseUser, setValue]);

  const selectedOrg = organizations.find((o) => o.id === Number(watchedOrgId));
  const selectedService = selectedOrg?.services.find(
    (s) => s.id === Number(watchedSvcId)
  );

  const handleOrgChange = (orgId: number) => {
    setValue('organizationId', orgId);
    const org = organizations.find((o) => o.id === orgId);
    const firstOpen = org?.services.find((s) => s.isOpen) || org?.services[0];
    setValue('serviceId', firstOpen ? firstOpen.id : 0);
  };

  const onSubmit = async (values: BookingFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        ...values,
        priorityReason: values.isPriority
          ? values.priorityReason === 'standard'
            ? 'senior'
            : values.priorityReason
          : 'standard',
      };
      const result = await apiFetch<BookedConfirmation>('/api/tokens', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setConfirmation(result);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to book token right now.'
      );
    }
  };

  if (confirmation) {
    const estTime = addMinutes(
      new Date(confirmation.token.bookedAt),
      confirmation.estimatedWaitMinutes
    );

    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden py-10 lg:py-14">
        <AmbientBackdrop />
        <div className="relative z-10 max-w-[720px] mx-auto px-4 sm:px-6">
          <Card glass className="p-6 sm:p-8 rounded-3xl">
            <div className="flex items-center gap-3 pb-6 border-b border-sky-100/90">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-[#101828]">
                  Digital Token Confirmed
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {confirmation.organizationName} · {confirmation.serviceName}
                </p>
              </div>
            </div>

            <div className="py-8 grid grid-cols-1 sm:grid-cols-12 gap-8 items-center">
              <div className="sm:col-span-7 space-y-5">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Token Code</p>
                  <p className="font-mono text-5xl font-bold text-[#101828] tabular-nums tracking-tight mt-1">
                    {confirmation.token.tokenCode}
                  </p>
                  {confirmation.token.isPriority && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7859ED] mt-2">
                      <ShieldAlert className="w-4 h-4 text-[#7859ED]" />
                      {PRIORITY_REASON_LABELS[confirmation.token.priorityReason] ||
                        'Priority Lane'}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-sky-100/90">
                  <div>
                    <p className="text-xs text-slate-500">Queue Position</p>
                    <p className="font-mono text-2xl font-bold bg-gradient-to-r from-[#356DF3] to-[#7859ED] bg-clip-text text-transparent tabular-nums mt-0.5">
                      #{confirmation.positionInQueue}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Estimated Turn</p>
                    <p className="font-mono text-2xl font-bold text-[#101828] tabular-nums mt-0.5">
                      {format(estTime, 'HH:mm')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatWaitLabel(confirmation.estimatedWaitMinutes)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-5 flex flex-col items-center justify-center p-5 bg-white/90 rounded-2xl border border-[#9BD7FA]/75 shadow-[0_12px_30px_rgba(53,109,243,0.1)]">
                <QRCodeSVG
                  value={`queueless://token/${confirmation.token.tokenCode}?org=${confirmation.organizationSlug}`}
                  size={148}
                  bgColor="#FFFFFF"
                  fgColor="#101828"
                  level="M"
                />
                <p className="text-xs text-slate-500 mt-3 text-center">
                  Scan at kiosk or counter upon arrival
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-sky-100/90 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmation(null);
                }}
              >
                Book Another Token
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="glass"
                  onClick={() =>
                    onNavigate(`/display/${confirmation.organizationSlug}`)
                  }
                >
                  Lobby Display
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    onNavigate(`/my-tokens?code=${confirmation.token.tokenCode}`)
                  }
                >
                  Track Live Position
                  <ArrowRight className="w-4 h-4 ql-btn-arrow" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <AmbientBackdrop />
      <div className="relative z-10 max-w-[1040px] mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-[#356DF3] transition-colors mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to overview
            </button>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]">
              Book a Digital Token
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              Reserve your spot remotely and receive real-time queue updates.
            </p>
          </div>

          {!firebaseUser && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => signInWithGoogle()}
            >
              Sign in with Google to save history
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card glass className="lg:col-span-8 p-6 sm:p-8 rounded-3xl">
            {loadingOrgs ? (
              <div className="space-y-4">
                <div className="h-12 bg-white/70 rounded-xl animate-pulse" />
                <div className="h-12 bg-white/70 rounded-xl animate-pulse" />
                <div className="h-24 bg-white/70 rounded-xl animate-pulse" />
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-sm text-rose-700">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                      Organization
                    </label>
                    <Select
                      value={watchedOrgId || ''}
                      onChange={(e) => handleOrgChange(Number(e.target.value))}
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.category})
                        </option>
                      ))}
                    </Select>
                    {errors.organizationId && (
                      <p className="text-xs text-rose-600 mt-1">
                        {errors.organizationId.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                      Service / Department
                    </label>
                    <Select {...register('serviceId', { valueAsNumber: true })}>
                      {selectedOrg?.services.map((svc) => (
                        <option
                          key={svc.id}
                          value={svc.id}
                          disabled={!svc.isOpen}
                        >
                          {svc.name} ({svc.waitingCount} waiting ·{' '}
                          {formatWaitLabel(svc.estimatedWaitMinutes)})
                          {!svc.isOpen ? ' [Paused]' : ''}
                        </option>
                      ))}
                    </Select>
                    {errors.serviceId && (
                      <p className="text-xs text-rose-600 mt-1">
                        {errors.serviceId.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-sky-100/90">
                  <div>
                    <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                      Full Name
                    </label>
                    <Input
                      placeholder="e.g. Ananya Verma"
                      {...register('customerName')}
                    />
                    {errors.customerName && (
                      <p className="text-xs text-rose-600 mt-1">
                        {errors.customerName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                      Mobile Number (for lookup & turn alerts)
                    </label>
                    <Input
                      placeholder="+1 555 019 2834"
                      {...register('customerPhone')}
                    />
                    {errors.customerPhone && (
                      <p className="text-xs text-rose-600 mt-1">
                        {errors.customerPhone.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                      Email Address (Optional)
                    </label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...register('customerEmail')}
                    />
                    {errors.customerEmail && (
                      <p className="text-xs text-rose-600 mt-1">
                        {errors.customerEmail.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-sky-100/90 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#101828]">
                        Queue Tier
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Priority lanes support senior citizens, accessibility
                        needs, and urgent medical visits.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white/75 border border-[#9BD7FA]/80 rounded-xl shrink-0 w-fit">
                      <button
                        type="button"
                        onClick={() => {
                          setValue('isPriority', false);
                          setValue('priorityReason', 'standard');
                        }}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap',
                          !watchedIsPriority
                            ? 'bg-gradient-to-r from-[#0EA5E9] to-[#356DF3] text-white shadow-xs'
                            : 'text-slate-600 hover:text-[#101828]'
                        )}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setValue('isPriority', true);
                          setValue('priorityReason', 'senior');
                        }}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap',
                          watchedIsPriority
                            ? 'bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white shadow-xs'
                            : 'text-slate-600 hover:text-[#101828]'
                        )}
                      >
                        Priority Lane
                      </button>
                    </div>
                  </div>

                  {watchedIsPriority && (
                    <div>
                      <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                        Priority Eligibility
                      </label>
                      <Select {...register('priorityReason')}>
                        <option value="senior">Senior Citizen (65+)</option>
                        <option value="disability">
                          Accessibility / Differently-Abled Support
                        </option>
                        <option value="emergency">Urgent Medical Care</option>
                        <option value="vip">
                          Scheduled Priority Appointment
                        </option>
                      </Select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101828] mb-1.5">
                    Visit Notes (Optional)
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Optional reference number or assistance request..."
                    {...register('notes')}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting || !selectedService?.isOpen}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting
                      ? 'Issuing Token...'
                      : 'Confirm & Issue Token'}
                    <ArrowRight className="w-4 h-4 ql-btn-arrow" />
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card glass className="lg:col-span-4 p-6 space-y-5 rounded-3xl">
            <div>
              <p className="text-xs font-semibold text-[#356DF3]">
                Live Queue Snapshot
              </p>
              <h3 className="font-display text-lg font-bold text-[#101828] mt-1">
                {selectedOrg?.name || 'Select Facility'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedOrg?.location}
              </p>
            </div>

            {selectedService && (
              <div className="pt-4 border-t border-sky-100/90 space-y-4">
                <div>
                  <p className="text-xs text-slate-500">Selected Service</p>
                  <p className="text-sm font-semibold text-[#101828] mt-0.5">
                    {selectedService.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/85 border border-white shadow-[0_8px_20px_rgba(53,109,243,0.06)]">
                    <p className="text-xs text-slate-500">People Waiting</p>
                    <p className="font-mono text-2xl font-bold text-[#101828] tabular-nums mt-1">
                      {selectedService.waitingCount}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/85 border border-white shadow-[0_8px_20px_rgba(53,109,243,0.06)]">
                    <p className="text-xs text-slate-500">Est. Wait</p>
                    <p className="font-mono text-2xl font-bold text-[#356DF3] tabular-nums mt-1">
                      {selectedService.estimatedWaitMinutes}m
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#356DF3]" />
                    Avg {selectedService.avgServiceMinutes} min / visitor
                  </span>
                  <span className="font-mono font-medium text-[#101828]">
                    Now: {selectedService.servingTokens[0]?.tokenCode || 'Ready'}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
