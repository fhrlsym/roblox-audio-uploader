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

export function Stepper({ steps, activeStep, onStepClick }: StepperProps) {
  return (
    <div className="relative flex items-center justify-between">
      <div className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[19px] z-0 h-[2px] -translate-y-1/2 rounded-full bg-[var(--surface-strong)]" />
      <motion.div
        className="pointer-events-none absolute top-[19px] z-0 h-[2px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
        style={{ left: '16.66%' }}
        animate={{ width: `${(activeStep - 1) * 33.33}%` }}
        transition={{ type: 'spring', stiffness: 220, damping: 30 }}
      />
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
            <span
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors duration-200 ${
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                  : isDone
                    ? 'border-[var(--accent)] bg-[var(--accent-15)] text-[var(--accent-strong)]'
                    : 'border-[var(--line)] bg-[var(--panel)] text-[var(--text-40)]'
              }`}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-[var(--text)]' : isDone ? 'text-[var(--text-70)]' : 'text-[var(--text-40)]'}`}>
              <span>{step.label}</span>
              {step.badge && step.badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${isActive || isDone ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]' : 'bg-[var(--surface-strong)] text-[var(--text-40)]'}`}>
                  {step.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
