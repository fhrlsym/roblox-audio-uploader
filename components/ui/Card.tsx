import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: 'div' | 'section';
  hover?: boolean;
}

export function Card({ children, as = 'div', hover = false, className = '', ...props }: CardProps) {
  const Tag = as;
  const hoverCls = hover
    ? 'transition duration-150 ease-out hover:border-[var(--accent-25)]'
    : '';
  return (
    <Tag
      className={`rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-card)] ${hoverCls} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
