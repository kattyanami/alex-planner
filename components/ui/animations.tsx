"use client";

import { useEffect, useRef, useState } from "react";

/**
 * FadeIn — animates children in on mount with a slide-up + fade-in transition.
 * Use `delay` to stagger sibling animations (in ms).
 */
export function FadeIn({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const Component = Tag as React.ElementType;
  return (
    <Component
      className={`${className} transition-all duration-500 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </Component>
  );
}

/**
 * Stagger — wraps a list of children, fades each in with N ms delay between them.
 */
export function Stagger({
  children,
  step = 60,
  initialDelay = 0,
  className = "",
}: {
  children: React.ReactNode[];
  step?: number;
  initialDelay?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <FadeIn key={i} delay={initialDelay + i * step}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

/**
 * CountUp — animates a number from 0 (or `from`) to `value` over `duration` ms.
 * Renders the formatted current value via the `format` prop.
 */
export function CountUp({
  value,
  from = 0,
  duration = 800,
  format = (n) => Math.round(n).toLocaleString(),
  className = "",
}: {
  value: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [current, setCurrent] = useState(from);
  const startedAt = useRef<number | null>(null);
  const initial = useRef(from);
  const target = useRef(value);

  useEffect(() => {
    initial.current = current;
    target.current = value;
    startedAt.current = null;

    let raf = 0;
    const tick = (t: number) => {
      if (startedAt.current == null) startedAt.current = t;
      const progress = Math.min(1, (t - startedAt.current) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = initial.current + (target.current - initial.current) * eased;
      setCurrent(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(current)}</span>;
}
