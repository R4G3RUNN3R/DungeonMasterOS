// client/src/pages/credits.tsx
//
// Permanent Credits / Asset Attributions view (research report clearance
// checklist: "Add required attribution to a permanent Credits / Asset
// Attributions view and preserve attribution even where optional when
// doing so is inexpensive"). Lists every scene-background asset in the
// registry with its source, creator, license and attribution text —
// including entries still pending technical verification, so the page
// stays accurate as assets move through clearance rather than only
// reflecting whichever ones have shipped so far.

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import logoImg from "@assets/logo.png";
import { SCENE_ASSET_REGISTRY } from "@shared/scene-asset-registry";
import type { ClearanceStatus } from "@shared/scene-assets";

const STATUS_LABEL: Record<ClearanceStatus, string> = {
  cleared: "Cleared",
  "pending-technical-verification": "Pending technical verification",
  "pending-permission": "Pending permission",
  blocked: "Blocked",
};

const STATUS_ORDER: ClearanceStatus[] = ["cleared", "pending-technical-verification", "pending-permission", "blocked"];

export default function Credits() {
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    assets: SCENE_ASSET_REGISTRY.filter((a) => a.clearanceStatus === status),
  })).filter((g) => g.assets.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logoImg} alt="Dungeon Master OS" className="w-8 h-8 rounded-lg" style={{ border: "1px solid #c4a26544" }} />
            <span className="font-serif font-bold text-foreground tracking-tight text-sm">Dungeon Master OS</span>
          </div>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-xs">
            Back to home
          </Button>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-3">Credits &amp; Asset Attributions</h1>
        <p className="text-muted-foreground leading-relaxed mb-10">
          DungeonMasterOS's scene backgrounds and textures are sourced from free and Creative
          Commons–licensed work. Every asset the app can select is recorded here with its source,
          creator and license — including assets not yet in active use, so this page stays accurate
          as new backgrounds clear review rather than reflecting only what has already shipped.
          No image is used or bundled until it has been individually verified against DungeonMasterOS's
          own clearance checklist.
        </p>

        {grouped.map((group) => (
          <section key={group.status} className="mb-10">
            <h2 className="font-serif text-lg font-semibold mb-1">{STATUS_LABEL[group.status]}</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {group.status === "cleared" && "Rights, modification and bundling confirmed. Selectable once a real file is acquired and verified."}
              {group.status === "pending-technical-verification" && "License terms are acceptable, but native resolution/checksum has not yet been confirmed at acquisition. Not selectable yet."}
              {group.status === "pending-permission" && "Awaiting explicit written permission from the creator. Not selectable."}
              {group.status === "blocked" && "Rejected or unresolved — recorded so these are never silently reproposed. Not selectable."}
            </p>
            <div className="space-y-3">
              {group.assets.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{asset.creator}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {asset.license.type}
                        {asset.license.attributionRequired ? " · attribution required" : " · attribution optional"}
                      </div>
                      {asset.license.attributionText && (
                        <div className="text-xs text-muted-foreground mt-1 italic">{asset.license.attributionText}</div>
                      )}
                    </div>
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
