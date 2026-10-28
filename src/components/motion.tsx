"use client";

import { useEffect, useRef, useState } from "react";
import { animate, domMax, LazyMotion, m, MotionConfig, useReducedMotion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

// The app's motion vocabulary. One curve everywhere: a quick start and a long, gentle settle.
// People who ask their system for less motion get opacity fades only (MotionConfig drops the
// movement), and numbers and charts simply appear at their final values.

export const EASE = [0.22, 1, 0.36, 1] as const;

export const MotionProvider = ({ children }: { children: React.ReactNode }) => (
    // domMax: shared-layout animations (the sliding nav highlight) need it
    <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: EASE }}>
            {children}
        </MotionConfig>
    </LazyMotion>
);

const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// A page's cards rising into place one after another, once, when it first renders
export const Stagger = ({ className, children, as = "div" }: { className?: string; children: React.ReactNode; as?: "div" | "ul" | "section" }) => {
    const Tag = m[as];
    return (
        <Tag className={className} variants={container} initial="hidden" animate="show">
            {children}
        </Tag>
    );
};

export const StaggerItem = ({ className, children, as = "div" }: { className?: string; children: React.ReactNode; as?: "div" | "li" | "section" }) => {
    const Tag = m[as];
    return (
        <Tag className={className} variants={item}>
            {children}
        </Tag>
    );
};

// A title sliding up from behind a mask; give it a key to replay on change
export const HeadingReveal = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={cn("block overflow-hidden pb-[0.08em]", className)}>
        <m.span className="block" initial={{ y: "110%" }} animate={{ y: "0%" }} transition={{ duration: 0.8, ease: EASE }}>
            {children}
        </m.span>
    </span>
);

const formatNumber = (value: number) => Math.round(value).toLocaleString();

// Counts up to a number, and on later changes counts from the old value to the new one
export const CountUp = ({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) => {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLSpanElement>(null);
    const from = useRef(reduce ? value : 0);
    // Rendered once; afterwards the animation owns the digits (a re-render mustn't reset them)
    const [initial] = useState(() => formatNumber(from.current));

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (reduce) {
            node.textContent = formatNumber(value);
            from.current = value;
            return;
        }
        const controls = animate(from.current, value, {
            duration,
            ease: EASE,
            onUpdate: (current) => { node.textContent = formatNumber(current); },
        });
        from.current = value;
        return () => controls.stop();
    }, [value, reduce, duration]);

    return (
        // The final number for assistive tech; the ticking digits are decoration
        <span className={cn("tabular-nums", className)} aria-label={formatNumber(value)}>
            <span ref={ref} aria-hidden>{initial}</span>
        </span>
    );
};

// Rises a little under the pointer; for cards that are links or buttons
export const Lift = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <m.div
        className={cn("transition-shadow duration-300 ease-out hover:shadow-lift focus-within:shadow-lift", className)}
        whileHover={{ y: -4 }}
        whileFocus={{ y: -4 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
        {children}
    </m.div>
);

// A progress bar filling from the left to `value` (0 to 1)
export const Meter = ({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label: string }) => (
    <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
        <m.div
            className={cn("h-full origin-left rounded-full bg-primary", barClassName)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
        />
    </div>
);

export { m };
