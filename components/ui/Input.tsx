import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const BASE =
  'w-full bg-[var(--bg)] text-[var(--text)] rounded-lg px-4 py-3 border-2 border-[var(--text)] text-sm font-semibold outline-none transition-colors duration-150 focus:border-[var(--accent)] placeholder:text-[var(--text-40)] placeholder:font-normal';

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
