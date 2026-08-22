"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type FlowKind = "electricity" | "water" | "gas";

type AnimatedFlowPathProps = {
  d: string;
  kind: FlowKind;
  label: string;
  anomaly?: boolean;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
};

const flowConfig: Record<FlowKind, {
  base: string;
  start: string;
  stop: string;
  width: number;
  dash: string;
  duration: number;
}> = {
  electricity: { base: "#5c481d", start: "#fff5a8", stop: "#ffb84d", width: 3.2, dash: ".025 .09", duration: 1.35 },
  water: { base: "#16445f", start: "#a9edff", stop: "#2d9cff", width: 5.2, dash: ".13 .09", duration: 9.5 },
  gas: { base: "#315b45", start: "#c8ffe1", stop: "#42d98f", width: 4.2, dash: ".74 .07", duration: 4.8 },
};

export function AnimatedFlowPath({
  d,
  kind,
  label,
  anomaly = false,
  reverse = false,
  duration,
  delay = 0,
  className = "",
}: AnimatedFlowPathProps) {
  const rawId = useId();
  const gradientId = `flow-${kind}-${rawId.replace(/:/g, "")}`;
  const reducedMotion = useReducedMotion();
  const config = flowConfig[kind];
  const travelDuration = duration ?? config.duration;
  const direction = reverse ? 1 : -1;

  return <g className={`animated-flow animated-flow-${kind} ${anomaly ? "animated-flow-anomaly" : ""} ${className}`}>
    <title>{label}</title>
    <path d={d} className="animated-flow-track" stroke={config.base} strokeWidth={config.width + 3} />
    <motion.path
      d={d}
      className="animated-flow-signal"
      pathLength={1}
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth={config.width}
      strokeLinecap="round"
      strokeDasharray={config.dash}
      initial={false}
      animate={reducedMotion ? { strokeDashoffset: 0, opacity: 1 } : {
        strokeDashoffset: anomaly ? [0, direction * .13, direction * .11, direction * .38, direction] : [0, direction],
        opacity: anomaly ? [1, .32, 1, .5, 1] : 1,
      }}
      transition={{
        strokeDashoffset: { duration: travelDuration, delay, ease: anomaly ? "easeInOut" : "linear", repeat: Infinity },
        opacity: { duration: Math.max(1.1, travelDuration * .45), delay, ease: "easeInOut", repeat: Infinity },
      }}
    />
    <defs>
      <motion.linearGradient
        id={gradientId}
        x1="0%"
        x2="100%"
        y1="0%"
        y2="0%"
        initial={false}
        animate={reducedMotion ? { x1: "0%", x2: "100%" } : { x1: ["-45%", "80%"], x2: ["15%", "140%"] }}
        transition={{ duration: travelDuration, delay, ease: "linear", repeat: Infinity }}
      >
        <stop offset="0%" stopColor={config.start} stopOpacity="0" />
        <stop offset="36%" stopColor={config.start} />
        <stop offset="70%" stopColor={anomaly ? "#ff5c68" : config.stop} />
        <stop offset="100%" stopColor={anomaly ? "#ff5c68" : config.stop} stopOpacity="0" />
      </motion.linearGradient>
    </defs>
  </g>;
}
