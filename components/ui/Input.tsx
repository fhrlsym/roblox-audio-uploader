import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const BASE =
  'w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] placeholder:text-[var(--text-35)]';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${BASE} ${invalid ? 'border-[var(--danger)]' : ''} ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`${BASE} ${invalid ? 'border-[var(--danger)]' : ''} ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
