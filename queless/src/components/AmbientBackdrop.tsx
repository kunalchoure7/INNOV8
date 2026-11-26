import React from 'react';
import { cn } from '../lib/utils';

interface AmbientBackdropProps {
  variant?: 'hero' | 'page';
  className?: string;
}

/**
 * Pure-CSS 3D cyan, sky-blue, and lavender atmospheric backdrop with floating
 * translucent spheres, glass bubbles, ambient glow orbs, and subtle particles.
 */
export const AmbientBackdrop: React.FC<AmbientBackdropProps> = ({
  variant = 'page',
  className,
}) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden z-0',
        className
      )}
    >
      {/* Multi-layer luminous cyan / sky-blue / lavender / soft-purple gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'hero'
              ? 'linear-gradient(135deg, #D9F3FF 0%, #A8EAF5 28%, #9BD7FA 58%, #B7A9FF 86%, #D9F3FF 100%)'
              : 'linear-gradient(160deg, #D9F3FF 0%, #EAF8FF 22%, #C9EEFC 48%, #DED7FF 76%, #D9F3FF 100%)',
        }}
      />

      {/* Soft readability veil so foreground glass cards & navy text remain crisp */}
      <div
        className={cn(
          'absolute inset-0',
          variant === 'hero'
            ? 'bg-gradient-to-r from-white/55 via-white/30 to-transparent'
            : 'bg-white/25'
        )}
      />

      {/* Blurred ambient gradient light orbs */}
      <div
        className="absolute -top-28 -left-24 w-[480px] h-[480px] rounded-full blur-3xl animate-ambient-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(168,234,245,0.75) 0%, rgba(155,215,250,0.28) 60%, transparent 100%)',
        }}
      />
      <div
        className="absolute top-[18%] -right-24 w-[520px] h-[520px] rounded-full blur-3xl animate-ambient-drift"
        style={{
          animationDelay: '2.5s',
          background:
            'radial-gradient(circle, rgba(183,169,255,0.68) 0%, rgba(154,145,245,0.26) 58%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-[-120px] left-[22%] w-[540px] h-[540px] rounded-full blur-3xl animate-ambient-drift"
        style={{
          animationDelay: '5s',
          background:
            'radial-gradient(circle, rgba(155,215,250,0.58) 0%, rgba(217,243,255,0.32) 60%, transparent 100%)',
        }}
      />

      {/* Large 3D Spheres with realistic top-left specular lighting */}
      <div
        className="hidden sm:block absolute top-[6%] right-[5%] w-28 h-28 md:w-36 md:h-36 rounded-full border border-white/85 backdrop-blur-md shadow-[inset_8px_10px_22px_rgba(255,255,255,0.95),inset_-10px_-14px_26px_rgba(154,145,245,0.32),0_26px_54px_rgba(53,109,243,0.16)] animate-float-slow"
        style={{
          background:
            'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.96) 0%, rgba(168,234,245,0.7) 42%, rgba(155,215,250,0.52) 72%, rgba(183,169,255,0.45) 100%)',
        }}
      />

      <div
        className="hidden md:block absolute top-[44%] -left-10 w-36 h-36 rounded-full border border-white/80 backdrop-blur-md shadow-[inset_8px_10px_22px_rgba(255,255,255,0.94),inset_-10px_-12px_24px_rgba(120,89,237,0.26),0_24px_48px_rgba(120,89,237,0.14)] animate-float-medium"
        style={{
          background:
            'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0%, rgba(217,243,255,0.72) 45%, rgba(183,169,255,0.52) 82%, rgba(154,145,245,0.42) 100%)',
        }}
      />

      <div
        className="hidden lg:block absolute bottom-[8%] right-[8%] w-24 h-24 rounded-full border border-white/85 backdrop-blur-md shadow-[inset_6px_8px_16px_rgba(255,255,255,0.95),0_22px_44px_rgba(53,109,243,0.15)] animate-float-gentle"
        style={{
          background:
            'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.96) 0%, rgba(168,234,245,0.74) 55%, rgba(155,215,250,0.42) 100%)',
        }}
      />

      {/* Translucent Glass Bubbles & Rings */}
      <div className="hidden sm:block absolute top-[22%] left-[6%] w-16 h-16 rounded-full border border-white/85 bg-white/30 backdrop-blur-md shadow-[inset_4px_4px_12px_rgba(255,255,255,0.9),0_16px_32px_rgba(53,109,243,0.1)] animate-float-gentle" />
      <div className="hidden lg:block absolute top-[62%] right-[3%] w-20 h-20 rounded-full border-[8px] border-white/55 bg-white/15 backdrop-blur-sm shadow-[0_14px_32px_rgba(120,89,237,0.12)] animate-float-slow" />
      <div className="hidden md:block absolute top-[14%] left-[44%] w-10 h-10 rounded-full border border-white/90 bg-gradient-to-br from-white/80 via-[#A8EAF5]/50 to-[#B7A9FF]/40 shadow-[0_12px_24px_rgba(53,109,243,0.14)] animate-float-medium" />

      {/* Abstract Floating Frosted Glass Geometric Elements */}
      <div className="hidden lg:block absolute top-[72%] left-[5%] w-20 h-20 rounded-3xl rotate-12 border border-white/80 bg-gradient-to-br from-white/55 to-[#B7A9FF]/25 backdrop-blur-md shadow-[0_18px_38px_rgba(120,89,237,0.11)] animate-float-slow" />
      <div className="hidden lg:block absolute top-[32%] right-[3%] w-16 h-16 rounded-2xl -rotate-12 border border-white/80 bg-gradient-to-tr from-white/55 to-[#A8EAF5]/30 backdrop-blur-md shadow-[0_16px_34px_rgba(53,109,243,0.11)] animate-float-medium" />

      {/* Subtle Glowing Light Particles */}
      <span className="absolute top-[16%] left-[20%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(168,234,245,0.95)] animate-float-gentle" />
      <span className="absolute top-[36%] left-[35%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(183,169,255,0.9)] animate-float-slow" />
      <span className="absolute top-[52%] right-[24%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_14px_rgba(155,215,250,0.95)] animate-float-medium" />
      <span className="absolute top-[78%] left-[28%] w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_10px_rgba(154,145,245,0.85)] animate-float-gentle" />
      <span className="absolute top-[86%] right-[30%] w-2 h-2 rounded-full bg-white/95 shadow-[0_0_12px_rgba(168,234,245,0.95)] animate-float-slow" />
    </div>
  );
};
