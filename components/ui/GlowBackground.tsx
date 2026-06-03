'use client';

import { useSettings } from '@/hooks/useSettings';

interface GlowOrb {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  colorClass: string;
  delay?: number;
  opacity?: number;
}

interface GlowParticle {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  colorClass: string;
  delay?: number;
}

const orbs: GlowOrb[] = [
  { size: 600, top: '10%', left: '10%', colorClass: 'blur-orb-glow-1', opacity: 0.02 },
  { size: 500, top: '40%', right: '5%', colorClass: 'blur-orb-glow-2', delay: 2, opacity: 0.018 },
  { size: 400, bottom: '10%', left: '30%', colorClass: 'blur-orb-glow-3', delay: 4, opacity: 0.015 },
  { size: 350, top: '60%', left: '5%', colorClass: 'blur-orb-glow-4', opacity: 0.012 },
];

const particles: GlowParticle[] = [
  { size: 12, top: '15%', left: '8%', colorClass: 'bg-[var(--glow-1)]' },
  { size: 8, top: '25%', right: '12%', colorClass: 'bg-[var(--glow-2)]', delay: 1 },
  { size: 16, top: '50%', left: '15%', colorClass: 'bg-[var(--glow-3)]', delay: 2 },
  { size: 8, top: '70%', right: '20%', colorClass: 'bg-[var(--glow-4)]', delay: 3 },
  { size: 12, bottom: '20%', left: '25%', colorClass: 'bg-[var(--glow-1)]', delay: 1.5 },
];

export default function GlowBackground() {
  const { settings } = useSettings();

  if (!settings.glowEnabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 大面积光晕 */}
      {orbs.map((orb, i) => (
        <div
          key={`orb-${i}`}
          className={`blur-orb-fixed ${orb.colorClass} animate-pulse-soft`}
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            animationDelay: orb.delay ? `${orb.delay}s` : undefined,
            opacity: orb.opacity,
          }}
        />
      ))}

      {/* 浮动粒子 */}
      {particles.map((p, i) => (
        <div
          key={`particle-${i}`}
          className={`absolute rounded-full ${p.colorClass} animate-float-particle`}
          style={{
            width: p.size,
            height: p.size,
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            animationDelay: p.delay ? `${p.delay}s` : undefined,
            opacity: 0.15,
          }}
        />
      ))}
    </div>
  );
}
