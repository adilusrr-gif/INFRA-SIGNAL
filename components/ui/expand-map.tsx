"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";

type ExpandMapProps = {
  children: React.ReactNode;
  location?: string;
  coordinates?: string;
  className?: string;
  stableCanvas?: boolean;
};

export function ExpandMap({
  children,
  location = "Астана · инженерная сеть",
  coordinates = "51.13° N · 71.43° E",
  className = "",
  stableCanvas = false,
}: ExpandMapProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-50, 50], [2.4, -2.4]);
  const rotateY = useTransform(mouseX, [-50, 50], [-2.4, 2.4]);
  const springRotateX = useSpring(rotateX, { stiffness: 280, damping: 32 });
  const springRotateY = useSpring(rotateY, { stiffness: 280, damping: 32 });
  const surfaceStyle = stableCanvas
    ? { transformStyle: "flat" as const }
    : { rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" as const };

  useEffect(() => {
    if (!isExpanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const normalizedX = ((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 50;
    const normalizedY = ((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 50;
    mouseX.set(Math.max(-50, Math.min(50, normalizedX)));
    mouseY.set(Math.max(-50, Math.min(50, normalizedY)));
  }

  function resetTilt() {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  }

  const mapChrome = (expanded: boolean) => <>
    <div className="expand-map-meta">
      <span className="expand-map-pin">⌖</span>
      <div><b>{location}</b><small>{coordinates}</small></div>
    </div>
    <div className="expand-map-live"><i /> LIVE</div>
    <button
      className="expand-map-toggle"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setIsExpanded(!expanded);
      }}
      aria-label={expanded ? "Закрыть полноэкранную карту" : "Развернуть карту"}
    >
      {expanded ? "×" : "⛶"}<span>{expanded ? "Закрыть" : "На весь экран"}</span>
    </button>
  </>;

  const expandedMap = isExpanded && typeof document !== "undefined" ? createPortal(
    <AnimatePresence>
      <motion.div
        className="expand-map-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) setIsExpanded(false);
        }}
      >
        <motion.section
          className="expand-map-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`Карта: ${location}`}
          initial={{ opacity: 0, scale: .94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: .96, y: 18 }}
          transition={{ type: "spring", stiffness: 330, damping: 31 }}
        >
          <header>{mapChrome(true)}</header>
          <div className="expand-map-dialog-content">{children}</div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  ) : null;

  return <>
    <motion.div
      ref={containerRef}
      className={`expand-map-shell ${stableCanvas ? "expand-map-stable-canvas" : ""} ${className}`}
      style={{ perspective: stableCanvas ? "none" : 1200 }}
      onMouseMove={stableCanvas ? undefined : handleMouseMove}
      onMouseEnter={stableCanvas ? undefined : () => setIsHovered(true)}
      onMouseLeave={stableCanvas ? undefined : resetTilt}
    >
      <motion.div
        className="expand-map-surface"
        style={surfaceStyle}
        animate={{ y: stableCanvas ? 0 : isHovered ? -2 : 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        <div className="expand-map-inline-content">{isExpanded ? <div className="expand-map-placeholder" /> : children}</div>
        <div className="expand-map-inline-chrome">{mapChrome(false)}</div>
        <motion.p className="expand-map-hint" animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 5 }}>Наведите для обзора · нажмите ⛶ для раскрытия</motion.p>
      </motion.div>
    </motion.div>
    {expandedMap}
  </>;
}
