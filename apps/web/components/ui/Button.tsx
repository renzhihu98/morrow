import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'link' | 'danger-link';
export type ButtonSize = 'lg' | 'md';

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2.5 font-sans font-medium transition-opacity disabled:cursor-default disabled:opacity-50';

const SIZE: Record<ButtonSize, string> = {
  /** 56px pill (SPEC §4.F). */
  lg: 'h-14 rounded-button px-7 text-[16px] leading-5',
  /** 44px pill (sealed bar, inline actions). */
  md: 'h-11 rounded-[22px] pl-5 pr-[18px] text-[15px] leading-[18px]',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'border border-accent text-accent hover:bg-accent/5',
  danger: 'bg-danger text-on-danger hover:opacity-90',
  'danger-outline': 'border border-danger-border text-danger hover:bg-danger/5',
  link: 'text-accent hover:underline underline-offset-4',
  'danger-link': 'text-danger hover:underline underline-offset-4',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', className = '') {
  const isLink = variant === 'link' || variant === 'danger-link';
  return `${BASE} ${isLink ? 'text-[15px] leading-[18px]' : SIZE[size]} ${VARIANT[variant]} ${className}`;
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };

/** v4 button: primary (Oxblood pill), secondary (Oxblood outline), danger (Brick), link. */
export function Button({ variant, size, className, children, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

/** Same styles as `Button`, rendered as a Next link. */
export function ButtonLink({ href, variant, size, className, children }: Common & { href: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/** → arrow used in buttons and links. */
export function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <path d="M3.5 8 H12 M8.5 4.5 L12 8 L8.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
