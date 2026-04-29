"use client";

import { type ReactNode, memo } from "react";

/**
 * All dashboard animation wrappers render children IMMEDIATELY VISIBLE.
 * No opacity: 0 initial state. No delay before first paint.
 * These are now thin pass-through wrappers that preserve layout.
 */

type FadeInUpProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
};

export const FadeInUp = memo(function FadeInUp({
  children,
  className,
}: FadeInUpProps) {
  return <div className={className}>{children}</div>;
});

type StaggerContainerProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
};

export const StaggerContainer = memo(function StaggerContainer({
  children,
  className,
}: StaggerContainerProps) {
  return <div className={className}>{children}</div>;
});

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
};

export const StaggerItem = memo(function StaggerItem({ children, className }: StaggerItemProps) {
  return <div className={className}>{children}</div>;
});

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  show?: boolean;
};

export const AnimatedSection = memo(function AnimatedSection({
  children,
  className,
  show = true,
}: AnimatedSectionProps) {
  if (!show) return null;
  return <div className={className}>{children}</div>;
});
