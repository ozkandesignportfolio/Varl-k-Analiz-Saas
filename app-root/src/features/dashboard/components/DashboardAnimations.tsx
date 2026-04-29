"use client";

import { type ReactNode, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type FadeInUpProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
};

export const FadeInUp = memo(function FadeInUp({
  children,
  delay = 0,
  duration = 0.25,
  className,
}: FadeInUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

type StaggerContainerProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
};

export const StaggerContainer = memo(function StaggerContainer({
  children,
  className,
  staggerDelay = 0.03,
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
};

export const StaggerItem = memo(function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 4 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
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
  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});

export { AnimatePresence, motion };
