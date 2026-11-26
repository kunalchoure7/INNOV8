import React from 'react';
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'glass'
    | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const variants = {
    primary:
      'ql-btn ql-btn-primary bg-gradient-to-r from-[#356DF3] to-[#7859ED] text-white border border-white/25 shadow-[0_10px_26px_rgba(53,109,243,0.28),0_4px_12px_rgba(120,89,237,0.18)]',
    secondary:
      'ql-btn ql-btn-secondary bg-white/78 backdrop-blur-md text-[#101828] border border-[#9BD7FA]/85 shadow-[0_8px_22px_rgba(53,109,243,0.08)]',
    outline:
      'ql-btn ql-btn-secondary bg-white/75 backdrop-blur-md text-[#101828] border border-[#9BD7FA]/80 shadow-[0_6px_18px_rgba(53,109,243,0.07)]',
    glass:
      'ql-btn ql-btn-secondary bg-white/72 backdrop-blur-xl text-[#101828] border border-white/90 shadow-[0_10px_26px_rgba(53,109,243,0.10)]',
    accent:
      'ql-btn ql-btn-accent bg-gradient-to-r from-[#0EA5E9] via-[#22B8EE] to-[#356DF3] text-white border border-white/30 shadow-[0_10px_24px_rgba(14,165,233,0.26)]',
    ghost:
      'ql-btn bg-transparent text-slate-600 hover:text-[#101828] hover:bg-white/60 border border-transparent',
    danger:
      'ql-btn ql-btn-danger bg-gradient-to-r from-[#F43F5E] to-[#EC4899] text-white border border-white/25 shadow-[0_8px_22px_rgba(244,63,94,0.24)]',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4.5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#356DF3]/45',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glass = true,
  hoverable = false,
  ...props
}) => (
  <div
    className={cn(
      'rounded-2xl transition-all duration-200',
      glass
        ? 'bg-white/76 backdrop-blur-xl border border-white/90 shadow-[0_18px_48px_rgba(53,109,243,0.10),0_4px_16px_rgba(120,89,237,0.06)]'
        : 'bg-white/92 backdrop-blur-md border border-white shadow-[0_10px_30px_rgba(53,109,243,0.07)]',
      hoverable &&
        'hover:-translate-y-1 hover:bg-white/88 hover:border-[#9BD7FA] hover:shadow-[0_24px_56px_rgba(53,109,243,0.16),0_8px_22px_rgba(120,89,237,0.10)]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full px-3.5 py-2.5 text-sm bg-white/85 backdrop-blur-sm text-[#101828] placeholder:text-slate-400 border border-[#9BD7FA]/75 rounded-xl transition-all duration-150 focus:outline-none focus:bg-white focus:border-[#356DF3] focus:ring-2 focus:ring-[#7859ED]/20',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full px-3.5 py-2.5 text-sm bg-white/85 backdrop-blur-sm text-[#101828] border border-[#9BD7FA]/75 rounded-xl transition-all duration-150 focus:outline-none focus:bg-white focus:border-[#356DF3] focus:ring-2 focus:ring-[#7859ED]/20',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full px-3.5 py-2.5 text-sm bg-white/85 backdrop-blur-sm text-[#101828] placeholder:text-slate-400 border border-[#9BD7FA]/75 rounded-xl transition-all duration-150 focus:outline-none focus:bg-white focus:border-[#356DF3] focus:ring-2 focus:ring-[#7859ED]/20',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const StatusLabel: React.FC<{
  status: string;
  isPriority?: boolean;
}> = ({ status, isPriority }) => {
  const configs: Record<
    string,
    { label: string; colorClass: string; icon: React.ReactNode }
  > = {
    serving: {
      label: 'Serving Now',
      colorClass: 'text-emerald-700',
      icon: <PlayCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
    },
    waiting: {
      label: 'Waiting',
      colorClass: 'text-[#356DF3]',
      icon: <Clock className="w-3.5 h-3.5 text-[#356DF3] shrink-0" />,
    },
    completed: {
      label: 'Completed',
      colorClass: 'text-slate-600',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
    },
    cancelled: {
      label: 'Cancelled',
      colorClass: 'text-slate-500',
      icon: <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
    },
    no_show: {
      label: 'No-Show',
      colorClass: 'text-amber-700',
      icon: <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
    },
  };

  const cfg = configs[status] || configs.waiting;

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap">
      <span className={cn('inline-flex items-center gap-1.5', cfg.colorClass)}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </span>
      {isPriority && (
        <>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="inline-flex items-center gap-1 text-[#7859ED] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-[#7859ED] shrink-0" />
            <span>Priority</span>
          </span>
        </>
      )}
    </span>
  );
};
