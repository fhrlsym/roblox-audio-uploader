'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
}

const COLORS = [
  '#f5d06f', '#d4af37', '#e6c15c', // gold
  '#2fbf8f', '#4ddfa9', // emerald
  '#8b7bf7', '#a99dff', // purple
  '#ff6b7f', '#f472b6', // pink/rose
  '#22d3ee', '#67e8f9', // cyan
];

export default function Confetti({ onComplete }: { onComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 80;
    const GRAVITY = 0.15;
    const FRICTION = 0.99;

    // Spawn particles from top center area
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: canvas.width * 0.3 + Math.random() * canvas.width * 0.4,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 1,
      });
    }

    let animFrame: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive++;

        p.vy += GRAVITY;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height + 20) {
          p.life = 0;
          continue;
        }

        // Fade out in the last 30% of screen
        const fadeZone = canvas.height * 0.7;
        if (p.y > fadeZone) {
          p.life = Math.max(0, 1 - (p.y - fadeZone) / (canvas.height - fadeZone + 20));
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (alive > 0) {
        animFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[300] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
