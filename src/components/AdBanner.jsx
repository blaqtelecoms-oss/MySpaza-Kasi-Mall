import { useState, useEffect } from "react";
import { X } from "lucide-react";
import SedfaBanner from "@/components/ads/SedfaBanner";
import NewcastleLedBanner from "@/components/ads/NewcastleLedBanner";
import AmajubaBanner from "@/components/ads/AmajubaBanner";
import ValueCityBanner from "@/components/ads/ValueCityBanner";

const BANNERS = [
  { id: "sedfa", Component: SedfaBanner },
  { id: "newcastle", Component: NewcastleLedBanner },
  { id: "amajuba", Component: AmajubaBanner },
  { id: "valuecity", Component: ValueCityBanner },
];

export default function AdBanner() {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % BANNERS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [dismissed]);

  if (dismissed) return null;

  const { Component } = BANNERS[index];

  return (
    <div className="relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-white/30 hover:bg-white/50 transition"
        aria-label="Dismiss"
      >
        <X size={12} className="text-white" />
      </button>
      <Component />
      <div className="flex gap-1 mt-2 justify-center">
        {BANNERS.map((b, i) => (
          <div
            key={b.id}
            className={`h-1 rounded-full transition-all ${i === index ? "w-5 bg-foreground/60" : "w-1.5 bg-foreground/20"}`}
          />
        ))}
      </div>
    </div>
  );
}