import { useState, useEffect } from "react";
import { useSubscription } from "@/lib/SubscriptionContext";
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
  // Premium and Ultra are ad-free; only the Free plan shows sponsored banners.
  const { planInfo } = useSubscription();

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % BANNERS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!planInfo.ads) return null;

  const { Component } = BANNERS[index];

  return (
    <div className="relative">
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