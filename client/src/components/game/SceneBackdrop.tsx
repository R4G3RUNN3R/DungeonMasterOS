// client/src/components/game/SceneBackdrop.tsx
//
// The environmental background layer behind the game shell (design spec
// §2.2, §13, §19). Renders whatever image URL it's given (or none) with
// the per-scene-category dimming/vignette/blur treatment from the scene
// asset's suitability data (research report, "Fallbacks, rendering, and
// asset workflow"), and always keeps the warm gradient fallback underneath
// so a missing/broken image never blocks gameplay.

import { useEffect, useState } from "react";

type Vignette = "light" | "medium" | "strong";

type Props = {
  imageUrl?: string | null;
  dimPercent?: number;
  vignette?: Vignette;
  blurPx?: number;
};

const VIGNETTE_SPREAD: Record<Vignette, string> = {
  light: "10vw 2vw",
  medium: "18vw 4vw",
  strong: "24vw 7vw",
};

export default function SceneBackdrop({ imageUrl, dimPercent = 0, vignette = "medium", blurPx = 0 }: Props) {
  // Two-layer crossfade: keep the previous image visible while the new one
  // fades in, so a scene change never flashes to black between images.
  const [layers, setLayers] = useState<{ id: number; url: string | null }[]>([
    { id: 0, url: imageUrl ?? null },
  ]);
  const [activeId, setActiveId] = useState(0);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setLayers((prev) => {
      const current = prev[prev.length - 1];
      if (current?.url === (imageUrl ?? null)) return prev;
      const nextId = current ? current.id + 1 : 0;
      return [...prev.slice(-1), { id: nextId, url: imageUrl ?? null }];
    });
  }, [imageUrl]);

  useEffect(() => {
    const last = layers[layers.length - 1];
    if (!last) return;
    const raf = requestAnimationFrame(() => setActiveId(last.id));
    return () => cancelAnimationFrame(raf);
  }, [layers]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Warm dark fallback — always present underneath, so a missing or
          broken scene image degrades to "moody tavern gradient," never to
          a blank/broken page (spec §19). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -10%, hsl(28 30% 14%) 0%, hsl(24 24% 8%) 55%, hsl(22 22% 5%) 100%)",
        }}
      />

      {layers.map((layer) =>
        layer.url && layer.url !== failedUrl ? (
          <div
            key={layer.id}
            className={`dm-scene-layer${layer.id === activeId ? " dm-scene-active" : ""}`}
            style={{ backgroundImage: `url(${layer.url})`, filter: blurPx ? `blur(${blurPx}px)` : undefined }}
          >
            {/* Preload/error probe — an <img> we never show, purely to
                detect a broken URL and fall back without a visible break. */}
            <img
              src={layer.url}
              alt=""
              className="hidden"
              onError={() => setFailedUrl(layer.url)}
            />
          </div>
        ) : null,
      )}

      {/* Per-scene dimming, driven by the asset's suitability data so text
          stays readable regardless of how bright the source image is. */}
      {dimPercent > 0 && (
        <div className="absolute inset-0" style={{ background: `hsl(22 24% 4% / ${dimPercent / 100})` }} />
      )}

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 ${VIGNETTE_SPREAD[vignette]} hsl(22 24% 4% / 0.75)`,
        }}
      />
    </div>
  );
}
