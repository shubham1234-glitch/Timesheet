import { Variants, MotionProps } from "framer-motion";

export const staggerContainer: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, staggerChildren: 0.08 },
  },
};

export const itemFadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const slideInFromLeft = (
  distance = 40,
  duration = 0.6
): MotionProps => ({
  initial: { opacity: 0, x: -distance },
  animate: { opacity: 1, x: 0 },
  transition: { duration },
});

export const slideInFromRight = (
  distance = 40,
  duration = 0.6
): MotionProps => ({
  initial: { opacity: 0, x: distance },
  animate: { opacity: 1, x: 0 },
  transition: { duration },
});

export const slideUp = (distance = 24, duration = 0.5): MotionProps => ({
  initial: { opacity: 0, y: distance },
  animate: { opacity: 1, y: 0 },
  transition: { duration },
});

export const inViewSlideFromRight = (
  distance = 30,
  duration = 0.4,
  delay = 0
): MotionProps => ({
  initial: { opacity: 0, x: distance },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration, delay },
});

export const inViewSlideUp = (
  distance = 20,
  duration = 0.4,
  delay = 0.15
): MotionProps => ({
  initial: { opacity: 0, y: distance },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration, delay },
});


