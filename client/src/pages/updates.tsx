import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Calendar } from "lucide-react";
import logoImg from "@assets/logo.png";

type UpdateEntry = {
  product: string;
  date: string;
  title: string;
  description: string;
};

function formatUpdateDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Updates() {
  const { data, isLoading } = useQuery<{ updates: UpdateEntry[] }>({
    queryKey: ["/api/updates"],
  });

  const updates = data?.updates ?? [];

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
          <Link href="/compendium">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Compendium
            </Button>
          </Link>
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

      {/* Header */}
      <section className="py-16 px-6 text-center border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary mb-4">
            <Sparkles className="w-3 h-3" />
            Changelog
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Updates
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            What's new, changed, and improved in Dungeon Master OS, in the order it shipped.
          </p>
        </div>
      </section>

      {/* Updates list */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center">Loading updates...</div>
          ) : updates.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center">
              No updates published yet.
            </div>
          ) : (
            updates.map((entry, index) => (
              <Card key={`${entry.date}-${index}`} className="p-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatUpdateDate(entry.date)}
                </div>
                <h2 className="font-serif text-lg font-semibold mb-2">{entry.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {entry.description}
                </p>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
