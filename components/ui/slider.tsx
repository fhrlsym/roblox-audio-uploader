'use client';

import { useCallback, useState, useRef } from 'react';

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  formatValue?: (value: number) => string;
}

export function Slider({ min, max, step, value, onChange, label, formatValue }: SliderProps) {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = ((value - min) / (max - min)) * 100;

  const handleMove = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = x / rect.width;
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    },
    [min, max, step, onChange]
  );

  return (
    <div className="space-y-2">
      {(label || formatValue) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-xs font-medium text-[var(--text-60)]">{label}</span>}
          {formatValue && (
            <span className="text-xs font-mono text-[var(--accent-strong)]">{formatValue(value)}</span>
          )}
        </div>
      )}
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-[var(--surface-strong)] cursor-pointer group"
        onMouseDown={(e) => {
          setDragging(true);
          handleMove(e.clientX);
          const onMove = (ev: MouseEvent) => handleMove(ev.clientX);
          const onUp = () => {
            setDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--accent-strong)] border-2 border-[var(--panel)] shadow-md transition-transform ${
            dragging ? 'scale-125' : 'scale-100'
          }`}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
}