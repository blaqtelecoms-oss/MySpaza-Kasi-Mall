import { useState, useRef, useCallback, useEffect } from "react";

export function usePullToRefresh({ onRefresh, threshold = 70, maxPull = 120 }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const scrollRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || refreshing) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const distance = e.touches[0].clientY - startY.current;
    if (distance > 0) {
      e.preventDefault();
      const dampened = Math.min(distance * 0.5, maxPull);
      setPullDistance(dampened);
    }
  }, [refreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        window.dispatchEvent(new CustomEvent("pull-to-refresh"));
        if (onRefresh) await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { scrollRef, pullDistance, refreshing };
}