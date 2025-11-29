// frontend/app/components/NavigationView.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Route } from "../types";
import {
  Wind,
  Droplet,
  Award,
  Navigation as NavigationIcon,
  Clock,
  CloudSun,
  ArrowLeft,
  Crosshair,
} from "lucide-react";
import dynamic from "next/dynamic";

const RealMapClient = dynamic(
  () => import("./RealMap").then((m) => m.RealMap),
  { ssr: false }
);

interface NavigationViewProps {
  route: Route;
  onComplete: () => void;
  onExit?: () => void;
}

const breathNudges = [
  {
    id: 1,
    icon: "🌿",
    text: "Passing a greener segment, try a deep breath in 4s, out 4s.",
  },
  {
    id: 2,
    icon: "🧘",
    text: "Relax your shoulders and unclench your jaw.",
  },
  {
    id: 3,
    icon: "🚶",
    text: "Notice your steps: right, left, right, left.",
  },
];

export const NavigationView: React.FC<NavigationViewProps> = ({
  route,
  onComplete,
  onExit,
}) => {
  const [progress, setProgress] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(route.duration);
  const [remainingDistance, setRemainingDistance] = useState(
    route.distance || 0.8
  );
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentNudge] = useState(0);
  const [hydrationLogged, setHydrationLogged] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);

  const totalDuration = route.duration;
  const startTime = React.useMemo(() => new Date(), []);
  const eta = React.useMemo(() => {
    const t = new Date(startTime);
    t.setMinutes(t.getMinutes() + totalDuration);
    return t;
  }, [startTime, totalDuration]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const segments =
    route.walkingSegments && route.walkingSegments.length > 0
      ? route.walkingSegments
      : [
          {
            distance: route.distance || 0.8,
            duration: route.duration,
            startPoint: "Start",
            endPoint: "Destination",
            isLastMile: true,
          },
        ];

  useEffect(() => {
    const durationMs = route.duration * 60 * 1000;
    const start = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;
      const fraction = Math.min(elapsed / durationMs, 1);

      setProgress(fraction);
      setRemainingMinutes(
        Math.max(Math.round(route.duration * (1 - fraction)), 0)
      );
      setRemainingDistance(
        Math.max(
          Number(((route.distance || 0.8) * (1 - fraction)).toFixed(2)),
          0
        )
      );

      let cum = 0;
      const totalDur = segments.reduce((s, seg) => s + seg.duration, 0);
      const target = totalDur * fraction;
      for (let i = 0; i < segments.length; i++) {
        cum += segments[i].duration;
        if (target <= cum) {
          setCurrentSegmentIndex(i);
          break;
        }
      }

      if (fraction < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [onComplete, route.distance, route.duration, segments]);

  const currentSegment = segments[currentSegmentIndex];
  const isLastSegment = currentSegmentIndex === segments.length - 1;
  const nudge = breathNudges[currentNudge];

  const formatSegmentLabel = () => {
    if (!currentSegment) return "";
    if (isLastSegment && currentSegment.isLastMile) {
      return "Last mile walk to destination";
    }
    return `${currentSegment.startPoint} → ${currentSegment.endPoint}`;
  };

  const weather = {
    temp: 29,
    condition: "Partly cloudy",
    aqi: route.aqi,
    aqiLabel: route.aqi <= 50 ? "Good" : route.aqi <= 100 ? "Moderate" : "Unhealthy",
  };

  const formatRemaining = () =>
    `${remainingMinutes} min · ${remainingDistance.toFixed(2)} km walk`;

  return (
    // Note: We keep min-h-screen for initial layout but scrolling is now handled by fixed/sticky elements
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#E6F7F7] to-white"> 
      {/* 顶部 header - STICKY (Fixed at the top of the content flow) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
            <div>
              <div className="text-xs text-slate-500">Remaining </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-semibold">
                  {remainingMinutes} min
                </div>
                <div className="text-sm text-slate-600">
                  · {remainingDistance.toFixed(2)} km walk
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>
                  ETA {formatTime(eta)} 
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2C7A7B] px-3 py-1 text-xs text-white">
              <NavigationIcon className="w-4 h-4" />
              <span>{isLastSegment ? "Walk segment" : "MRT segment"}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Next: {isLastSegment ? "—" : "Walk"}
            </div>
          </div>
        </div>

        {/* 顶部文案卡片 */}
        <div className="px-6 pb-4 max-w-6xl mx-auto">
          <div className="flex items-start gap-3 rounded-3xl bg-white px-4 py-3 shadow-sm">
            <div className="mt-1 text-lg">〰️</div>
            <div>
              <p className="text-sm">
                {nudge.text} 
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Segment: {formatSegmentLabel()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* FIXED MAP CARD SECTION - 地图固定在这里！高度动态调整！*/}
      {/* top-[180px] is fixed. We use calc(100vh - 180px - 110px) to set the remaining height dynamically. 110px is an estimate of the footer height plus its margins. */}
      <div 
        className="fixed top-[180px] left-1/2 -translate-x-1/2 z-10 w-full max-w-6xl px-6"
        style={{ 
          pointerEvents: 'none',
          height: 'calc(100vh - 180px - 110px)', // Dynamic height calculation
        }}
      >
        {/* Map Card Wrapper */}
        <div 
          className="rounded-3xl bg-white shadow-md px-4 pt-4 pb-5 h-full flex flex-col" // Use flex-col and h-full
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Live route map </span>
            <span>
              {remainingMinutes} min · {remainingDistance.toFixed(2)} km
            </span>
          </div>

          {/* 真正的地图区域 - FLEX-1 now makes it fill the remaining space! */}
          <div className="relative mt-3 flex-1 rounded-2xl overflow-hidden bg-slate-100">
            <RealMapClient
              selectedRoute={route}
              destinationCoords={route.destinationCoords}
              destinationLabel={route.name}
              recenterToken={recenterToken}
            />

            {/* Center map 按钮（绑在卡片右下角） */}
            <button
              type="button"
              onClick={() => setRecenterToken((t) => t + 1)}
              className="absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs shadow hover:bg-white"
            >
              <Crosshair className="w-3 h-3" />
              <span>Center map</span>
            </button>

            {/* Hydration 按钮（同样只在地图卡片内部） */}
            <button
              onClick={() => setHydrationLogged(!hydrationLogged)}
              className="absolute right-3 bottom-16 z-20 w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[var(--color-secondary)] hover:opacity-90 transition"
            >
              <Droplet className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
      {/* END FIXED MAP CARD SECTION */}

      {/* 中间：地图卡片（现在已经固定，MAIN is empty of content and scroll-related classes) */}
      <main className="flex-1"></main> 

      {/* 底部固定 summary 卡片 - STICKY */}
      <footer className="sticky bottom-0 z-20 px-6 pb-6 pt-4 bg-gradient-to-t from-white via-white/95 to-transparent">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white shadow-md px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#E6F7F7] p-2">
                <Award className="w-5 h-5 text-[#2C7A7B]" />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {progress < 1
                    ? "Stay with your breath, you’re doing great."
                    : "Arrived mindfully. Nice work!"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatRemaining()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <CloudSun className="w-4 h-4" />
                <span>
                  {weather.temp}°C · {weather.condition}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Wind className="w-4 h-4" />
                <span>
                  AQI {weather.aqi} · {weather.aqiLabel}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Droplet className="w-4 h-4" />
                <span>
                  Hydration: {hydrationLogged ? "✔ logged" : "tap to log"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-[11px] text-slate-400">
            Tap an option to adjust your route 
          </div>
        </div>
      </footer>
    </div>
  );
};