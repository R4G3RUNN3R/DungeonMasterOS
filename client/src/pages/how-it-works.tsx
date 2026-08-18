import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Globe,
  Users,
  Swords,
  Scroll,
  Zap,
  Lock,
  Repeat,
  Star,
  Hash,
  Shield,
} from "lucide-react";
import { TIERS, SQUIRE_PASS, formatPrice } from "@shared/tiers";
import logoImg from "@assets/logo.png";

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          {icon}
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img
              src={logoImg}
              alt="Dungeon Master OS"
              className="w-8 h-8 rounded-lg"
              style={{ border: "1px solid #c4a26544" }}
            />
            <span className="font-serif font-bold text-foreground tracking-tight text-sm">
              Dungeon Master OS
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/pricing">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Pricing
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-xs">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="text-xs">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center border-b border-border relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 30%, hsl(35 75% 52% / 0.06) 0%, transparent 65%)",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <img
            src={logoImg}
            alt="Dungeon Master OS"
            className="mx-auto w-28 h-28 rounded-2xl mb-8 shadow-2xl"
            style={{ border: "2px solid #c4a265" }}
          />
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-5">
            What is Dungeon Master OS?
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Dungeon Master OS is a browser-based, multiplayer AI tabletop RPG. An AI Dungeon Master
            — running on advanced language models — narrates your campaign, controls NPCs, adjudicates
            rules, and drives a persistent, living world. You and your party just play.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <FeaturePill icon={<Users className="w-3.5 h-3.5" />} label="2–6 Players" />
            <FeaturePill icon={<Globe className="w-3.5 h-3.5" />} label="Any System" />
            <FeaturePill icon={<Brain className="w-3.5 h-3.5" />} label="AI DM" />
            <FeaturePill icon={<Zap className="w-3.5 h-3.5" />} label="Real-time" />
            <FeaturePill icon={<Hash className="w-3.5 h-3.5" />} label="No downloads" />
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-20 space-y-24">

        {/* The AI DM */}
        <section>
          <SectionHeader
            icon={<Brain className="w-5 h-5 text-primary" />}
            title="The AI Dungeon Master"
            subtitle="The DM is a consistent, rules-aware character that runs your entire campaign. It narrates the world, voices every NPC, adjudicates actions, and maintains continuity across every session."
          />

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                <Scroll className="w-4 h-4 text-primary" /> What it remembers
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• Every NPC name, personality, and relationship</li>
                <li>• Every location you've visited and its state</li>
                <li>• Every decision you made and its consequences</li>
                <li>• Your character's abilities, backstory, and arc</li>
                <li>• The political climate of the world as it evolves</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-primary" /> What it never does
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• Retcon events without consent</li>
                <li>• Control player characters</li>
                <li>• Cheat you out of a choice you made</li>
                <li>• Forget a major plot point</li>
                <li>• Break from the world's established logic</li>
              </ul>
            </div>
          </div>

          <div className="mt-5 bg-primary/5 border border-primary/20 rounded-xl p-5">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              <span className="text-primary font-semibold not-italic">Example narration:</span>{" "}
              "The market falls silent as you enter. Guildmaster Aldric, who last saw you burn his
              warehouse to the ground, locks eyes with you from across the square. His hand drifts
              toward his belt — not his sword. His coin purse."
            </p>
          </div>
        </section>

        {/* Character System */}
        <section>
          <SectionHeader
            icon={<Scroll className="w-5 h-5 text-primary" />}
            title="Character System"
            subtitle="Every player gets a full character sheet, visible to the whole party. Build from scratch, roll stats, or import your sheet from anywhere."
          />

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: "Build & Roll",
                desc: "Point buy, standard array, or roll 4d6 drop lowest. Pick class, background, and abilities. The DM reads everything.",
              },
              {
                title: "Import Any Sheet",
                desc: "Paste a D&D Beyond URL or any text character sheet. The DM extracts abilities, backstory, and stats automatically.",
              },
              {
                title: "Live Tracking",
                desc: "HP, spell slots, active effects, concentration, exhaustion — tracked live and visible to all players.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-2 text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Campaign Customisation */}
        <section>
          <SectionHeader
            icon={<Globe className="w-5 h-5 text-primary" />}
            title="Campaign Customisation"
            subtitle="Before the first scene, you configure the campaign. Every setting shapes how the DM runs the game."
          />

          <div className="space-y-3">
            {[
              {
                label: "Tone",
                desc: "Dark & Grim, Heroic & Epic, Comedic, or Realistic. The DM's narration style, NPC attitudes, and consequences all shift accordingly.",
              },
              {
                label: "Combat Style",
                desc: "Cinematic prose (no numbers), Tactical (clear positioning, no dice), or Full Dice (D&D 5e initiative, AC, saving throws, spell slots).",
              },
              {
                label: "Power Level",
                desc: "Low Fantasy to God-Tier. Affects what challenges the world presents and the scale of player abilities.",
              },
              {
                label: "Anime Worlds",
                desc: "Set the source anime (Naruto, One Piece, etc.) and mode: Inspired (tone and aesthetics) or Canonical (full lore accuracy).",
              },
              {
                label: "Epic Mode",
                desc: "Legendary encounters, world-scale stakes, boss battles with phases. For parties who want cinematic climaxes.",
              },
              {
                label: "Homebrew Rules",
                desc: "Write any custom rule in plain English. 'Magic users sacrifice 1 HP per spell level.' The DM enforces it every session.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex gap-4 items-start p-4 rounded-lg bg-card border border-border"
              >
                <div className="w-28 shrink-0">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Multiplayer */}
        <section>
          <SectionHeader
            icon={<Users className="w-5 h-5 text-primary" />}
            title="Multiplayer"
            subtitle="Designed for real groups. Real-time, session-persistent, and transparent — every player sees the same world."
          />

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" /> Invite Codes
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Share your 8-character invite code. Players paste it and land directly in your
                session with no account required. 2–6 players per campaign.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Real-time
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                WebSocket-driven session log. Every DM message, player action, and dice roll
                appears instantly for all players simultaneously.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Scroll className="w-4 h-4 text-primary" /> Parchment Sheets
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every player's character sheet is visible in the sidebar. The DM references them
                constantly. No hidden stats — a transparent shared table.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" /> Persistent Sessions
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Campaigns persist indefinitely. Disconnect mid-session, reconnect later. The world
                is exactly where you left it.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing CTA */}
        <section className="text-center py-16 border-t border-border">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-4">
            <Star className="w-4 h-4" /> Simple pricing
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to start your campaign?
          </h2>
          <p className="text-muted-foreground text-lg mb-2">
            One-time Squire Pass or subscribe — no free trial needed
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Squire Pass {formatPrice(SQUIRE_PASS.price)} · Subscriptions from {formatPrice(TIERS.adventurer.priceWeekly)}/wk · Players join free
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 gap-2">
                <Swords className="w-4 h-4" />
                Get Started
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="px-8 border-border">
                See Pricing Details
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
