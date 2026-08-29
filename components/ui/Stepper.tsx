'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ComponentType } from 'react';

export interface StepConfig {
  id: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
}

interface StepperProps {
  steps: StepConfig[];
  activeStep: number;
  onStepClick: (id: number) => void;
}

const CIRCLE = 38; // px — circle diameter
const GAP = 8; // px — breathing room between circle edge and line

export function Stepper({ steps, activeStep, onStepClick }: StepperProps) {
  const n = steps.length;
  const half = CIRCLE / 2 + GAP; // distance from circle center to line start

  return (
    <div className="relative flex items-start justify-between">
      {/* Line segments between circles — never crosses a circle */}
      {steps.slice(0, -1).map((step, i) => {
        // center of step i sits at ((2i+1) / (2n)) * 100%
        const centerPct = ((2 * i + 1) / (2 * n)) * 100;
        const spanPct = 100 / n;
        const filled = activeStep > step.id;

        return (
          <span
            key={`seg-${step.id}`}
            aria-hidden="true"
            className={`pointer-events-none absolute z-0 h-[2px] transition-colors duration-300 ${
              filled ? 'bg-[var(--accent)]' : 'bg-[var(--text)]/20'
            }`}
            style={{
              left: `calc(${centerPct}% + ${half}px)`,
              width: `calc(${spanPct}% - ${half * 2}px)`,
              top: `${CIRCLE / 2}px`,
              transform: 'translateY(-50%)',
            }}
          />
        );
      })}

      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = activeStep === step.id;
        const isDone = step.id < activeStep;
        return (
          <button
            key={step.id}
            onClick={() => onStepClick(step.id)}
            aria-current={isActive ? 'step' : undefined}
            className="relative z-10 flex flex-1 select-none flex-col items-center gap-2 rounded-lg py-1"
          >
            <motion.span
              animate={{ scale: isActive ? 1 : 0.94 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className={`flex items-center justify-center rounded-full border-2 border-[var(--text)] text-[11px] font-bold transition-colors duration-200 ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-[3px_3px_0_0_var(--text)]'
                  : isDone
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--panel)] text-[var(--text-50)]'
              }`}
              style={{ width: CIRCLE, height: CIRCLE }}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </motion.span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide transition-colors ${
                isActive ? 'text-[var(--text)]' : isDone ? 'text-[var(--text-70)]' : 'text-[var(--text-40)]'
              }`}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
