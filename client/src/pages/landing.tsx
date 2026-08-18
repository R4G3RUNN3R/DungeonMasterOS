import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Globe, Users, Swords, Star, ChevronRight,
  Scroll, Zap, Lock, Repeat, Shield, Dices, Sparkles,
  BookOpen, Tv, Wand2, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { TIERS, SQUIRE_PASS, formatPrice } from "@shared/tiers";
import logoImg from "@assets/logo.png";

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const colors = ["#c4a265", "#e8c47a", "#a07040", "#d4b070"];
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.6 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.opacity -= 0.0008;
        if (p.y < -10 || p.opacity <= 0) { p.x = Math.random() * canvas.width; p.y = canvas.height + 10; p.opacity = Math.random() * 0.6 + 0.1; }
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ opacity: 0.7 }} />;
}

const features = [
  {
    icon: <Brain className="w-7 h-7 text-primary" />,
    title: "AI Dungeon Master",
    description: "A consistent, rules-aware DM that never forgets. Cinematic narration, NPC dialogue, world consequences — always coherent, always in character.",
  },
  {
    icon: <Globe className="w-7 h-7 text-primary" />,
    title: "Any World, Any System",
    description: "D&D 5e, Naruto's shinobi world, One Piece, isekai, homebrew — paste your character sheet and the DM handles the rest. Every system, every genre.",
  },
  {
    icon: <Users className="w-7 h-7 text-primary" />,
    title: "Real Multiplayer",
    description: "2–6 players. Real-time WebSocket sessions. Parchment character sheets. Live buff tracking. Dice roller. Your party, your campaign, your legend.",
  },
  {
    icon: <Scroll className="w-7 h-7 text-primary" />,
    title: "Full Character System",
    description: "Build from scratch with D&D stat gen, or paste any character sheet. The AI extracts abilities, backstory, and stats from any format automatically.",
  },
  {
    icon: <Tv className="w-7 h-7 text-primary" />,
    title: "Anime Worlds",
    description: "Play in Naruto, Bleach, One Piece, and more. Inspired mode draws from the aesthetic. Canonical mode places you inside the actual story.",
  },
  {
    icon: <Wand2 className="w-7 h-7 text-primary" />,
    title: "Epic Mode",
    description: "No level cap. Mythic threats. Reality-scale stakes. Epic spell slots. Legacy actions. The line between mortal and god is what Epic Mode is about.",
  },
];

const steps = [
  {
    num: "01",
    title: "Create a Campaign",
    desc: "Choose tone, world, and combat style. Heroic epic, dark grim, anime power system — you decide the canvas.",
  },
  {
    num: "02",
    title: "Build Your Character",
    desc: "Roll stats, choose abilities, write your backstory. Or paste any character sheet — the DM reads it all.",
  },
  {
    num: "03",
    title: "The DM Sets the Scene",
    desc: "Enter a living world that reacts to your choices. NPCs remember you. Actions have consequences.",
  },
];

const testimonials = [
  { text: "Feels like having a real DM available 24/7. The AI actually remembers what happened three sessions ago.", name: "Marcus H.", role: "D&D Veteran" },
  { text: "I imported my Naruto character and it was treated with full respect for the power system. Incredible.", name: "Yuki T.", role: "Anime RPG Player" },
  { text: "My group plays across time zones. This solved our scheduling problem completely.", name: "Sarah M.", role: "Campaign Host" },
];

const faqs = [
  { q: "Is there a free trial?", a: `No — but a one-time ${formatPrice(SQUIRE_PASS.price)} Squire Pass gets you ${SQUIRE_PASS.turns} AI DM turns with no subscription, so you can try a full session before committing.` },
  { q: "D&D only?", a: "Any system. Anime, homebrew, narrative-only — it adapts to whatever you paste in." },
  { q: "Does every player need to subscribe?", a: "Only the host. Players join campaigns for free using an invite code." },
  { q: "Can I cancel anytime?", a: "Yes — cancel anytime with no fees. Access continues until the end of your paid period." },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Dungeon Master OS" className="w-8 h-8 rounded-lg" style={{ border: "1px solid #c4a26544" }} />
          <span className="font-serif font-bold text-foreground tracking-tight">Dungeon Master OS</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/compendium" className="hover:text-foreground transition-colors">Compendium</Link>
          <Link href="/updates" className="hover:text-foreground transition-colors">Updates</Link>
          {user ? (
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          ) : (
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          )}
        </div>
        {user ? (
          <Button size="sm" onClick={() => navigate("/dashboard")} className="text-xs font-medium gap-1">
            Dashboard <ChevronRight className="w-3 h-3" />
          </Button>
        ) : (
          <Button size="sm" onClick={() => navigate("/register")} className="text-xs font-medium">
            Get Started
          </Button>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <ParticleCanvas />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, hsl(35 75% 52% / 0.08) 0%, transparent 65%)" }}
        />
        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <img
            src={logoImg}
            alt="Dungeon Master OS"
            className="mx-auto mb-8 rounded-2xl shadow-2xl"
            style={{ width: 120, height: 120, border: "2px solid #c4a265" }}
          />
          <div className="inline-flex items-center gap-2 text-primary text-xs font-semibold mb-6 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Star className="w-3 h-3" /> One-time Squire Pass or subscribe — no free trial needed
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Your AI Dungeon Master<br />
            <span className="text-primary">Never Sleeps</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A persistent, multiplayer tabletop RPG powered by an AI DM. Any world. Any system.
            2–6 players. Real campaigns. Real consequences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate(user ? "/dashboard" : "/register")} className="px-8 h-12 text-base gap-2">
              <Swords className="w-5 h-5" />
              {user ? "Go to Dashboard" : "Get Started"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/how-it-works")} className="px-8 h-12 text-base gap-2">
              <BookOpen className="w-4 h-4" /> How It Works
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Squire Pass {formatPrice(SQUIRE_PASS.price)} one-time · Subscriptions from {formatPrice(TIERS.adventurer.priceWeekly)}/wk · Players join free
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50">
          <span className="text-xs">Scroll to explore</span>
          <div className="w-px h-8 bg-border animate-pulse" />
        </div>
      </section>

      {/* Social proof bar */}
      <section className="py-8 border-y border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Dices className="w-4 h-4 text-primary" /> D&D 5e · Pathfinder · FATE · Any System</div>
          <div className="flex items-center gap-2"><Tv className="w-4 h-4 text-primary" /> Naruto · One Piece · Bleach · Isekai</div>
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> 2–6 Players per Campaign</div>
          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Real-time WebSocket Sessions</div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Campaigns Saved Forever</div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything you need to run a campaign</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Built for players who take their games seriously, and DMs who deserve a break.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
                <div className="mb-4">{f.icon}</div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-card/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-4">From zero to adventure in minutes</h2>
            <p className="text-muted-foreground">No setup. No software. No scheduling a human DM.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="font-mono text-primary font-bold text-sm">{step.num}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DM example narration */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" /> Example DM narration
          </div>
          <blockquote className="bg-card border border-border rounded-2xl p-8 text-left relative">
            <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
              Dungeon Master
            </div>
            <p className="text-foreground leading-relaxed italic">
              "The market falls silent as you enter. Guildmaster Aldric, who last saw you burn his warehouse to the ground three weeks ago,
              locks eyes with you from across the square. His hand drifts toward his belt — not his sword.{" "}
              <span className="text-primary font-semibold not-italic">His coin purse.</span> He smiles, slowly. Whatever this is, it isn't revenge.
              A young messenger at his elbow whispers something urgent, and his expression shifts — from amusement to something harder.
              He mouths two words at you across the crowd: <span className="text-primary font-semibold not-italic">'Meet me.'</span>"
            </p>
          </blockquote>
          <p className="text-sm text-muted-foreground mt-4">The DM remembers everything. NPCs have their own agendas. The world moves whether you do or not.</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-card/30 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-3xl font-bold text-center mb-12">Players who never stopped</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card border border-border rounded-xl p-6">
                <div className="flex mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 text-primary fill-primary" />)}
                </div>
                <p className="text-sm text-muted-foreground italic mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, honest pricing</h2>
          <p className="text-muted-foreground mb-10">A one-time pass or a subscription. Cancel anytime.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: SQUIRE_PASS.displayName, price: formatPrice(SQUIRE_PASS.price), note: "one-time, no subscription" },
              { label: TIERS.adventurer.displayName, price: `${formatPrice(TIERS.adventurer.priceWeekly)}/wk`, note: `from ${formatPrice(TIERS.adventurer.priceWeekly)}/week` },
              { label: TIERS.master.displayName, price: `${formatPrice(TIERS.master.priceWeekly)}/wk`, note: "Most Popular" },
              { label: TIERS.legend.displayName, price: `${formatPrice(TIERS.legend.priceWeekly)}/wk`, note: "our top tier" },
            ].map((p) => (
              <div key={p.label} className="bg-card border border-border rounded-xl p-6">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{p.label}</p>
                <p className="font-serif text-3xl font-bold text-foreground mb-1">{p.price}</p>
                <p className="text-xs text-muted-foreground">{p.note}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mb-6">Players join campaigns free. Only the host needs to pay.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate(user ? "/dashboard" : "/register")} className="px-8 gap-2">
              <Swords className="w-4 h-4" />
              {user ? "Go to Dashboard" : "Get Started"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="px-8">
              View Full Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 border-t border-border bg-card/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl font-bold text-center mb-8">Common questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {faq.q}
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, hsl(35 75% 52% / 0.05) 0%, transparent 65%)" }} />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Your next campaign starts now
          </h2>
          <p className="text-muted-foreground mb-8">No subscription required to start. No software to install.</p>
          <Button size="lg" onClick={() => navigate(user ? "/dashboard" : "/register")} className="px-10 h-14 text-base gap-2">
            <Swords className="w-5 h-5" />
            {user ? "Continue Your Adventure" : "Get Started"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="DMOS" className="w-5 h-5 rounded" style={{ border: "1px solid #c4a26544" }} />
            <span>Dungeon Master OS</span>
          </div>
          <div className="flex gap-5">
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/compendium" className="hover:text-foreground transition-colors">Compendium</Link>
            <Link href="/updates" className="hover:text-foreground transition-colors">Updates</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
