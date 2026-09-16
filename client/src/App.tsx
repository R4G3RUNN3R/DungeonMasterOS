import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const CampaignPage = lazy(() => import("@/pages/campaign"));
const CharacterSheetPage = lazy(() => import("@/pages/character-sheet"));
const Landing = lazy(() => import("@/pages/landing"));
const AuthPage = lazy(() => import("@/pages/auth"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Pricing = lazy(() => import("@/pages/pricing"));
const HowItWorks = lazy(() => import("@/pages/how-it-works"));
const Billing = lazy(() => import("@/pages/billing"));
const Account = lazy(() => import("@/pages/account"));

const PUBLIC_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "DungeonMasterOS | Persistent AI Dungeon Master RPG",
    description:
      "DungeonMasterOS is a persistent multiplayer tabletop RPG experience powered by an AI Dungeon Master, built for ongoing campaigns in the browser.",
  },
  "/how-it-works": {
    title: "How DungeonMasterOS Works | Persistent AI RPG Campaigns",
    description:
      "Learn how DungeonMasterOS runs persistent AI-guided tabletop RPG campaigns with campaign memory, character systems, multiplayer sessions, and lasting world consequences.",
  },
  "/pricing": {
    title: "DungeonMasterOS Pricing | AI Dungeon Master Plans",
    description:
      "Compare DungeonMasterOS plans for persistent AI Dungeon Master campaigns, multiplayer play, campaign memory, and browser-based tabletop RPG sessions.",
  },
};

const ATTRIBUTION_PATHS = new Set([
  "/",
  "/how-it-works",
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

function upsertMeta(selector: string, attribute: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  if (element) element.setAttribute(attribute, value);
}

function SeoHead() {
  const [location] = useLocation();

  useEffect(() => {
    const publicMeta = PUBLIC_SEO[location];
    const canonical = `https://dungeonmaster-os.com${location === "/" ? "/" : location}`;

    if (publicMeta) {
      document.title = publicMeta.title;
      upsertMeta('meta[name="description"]', "content", publicMeta.description);
      upsertMeta('meta[name="robots"]', "content", "index, follow, max-image-preview:large");
      upsertMeta('meta[property="og:title"]', "content", publicMeta.title);
      upsertMeta('meta[property="og:description"]', "content", publicMeta.description);
      upsertMeta('meta[property="og:url"]', "content", canonical);
      upsertMeta('meta[name="twitter:title"]', "content", publicMeta.title);
      upsertMeta('meta[name="twitter:description"]', "content", publicMeta.description);

      const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      canonicalLink?.setAttribute("href", canonical);
      return;
    }

    upsertMeta('meta[name="robots"]', "content", "noindex, follow");
  }, [location]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Component />;
}

function LegacyHashRedirect() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const legacyPath = window.location.hash.startsWith("#/")
      ? window.location.hash.slice(1)
      : "";

    if (!legacyPath) return;

    window.history.replaceState(null, "", legacyPath);
    navigate(legacyPath, { replace: true });
  }, [navigate]);

  return null;
}

function VoidsmithAttribution() {
  const [location] = useLocation();
  if (!ATTRIBUTION_PATHS.has(location)) return null;

  return (
    <footer className="border-t border-border bg-background px-6 py-6 text-center text-xs text-muted-foreground">
      <span>Powered by </span>
      <a
        href="https://voidsmithindustries.com/"
        className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
      >
        Voidsmith Industries
      </a>
    </footer>
  );
}

function CampaignCharacterSheetLauncher() {
  const [location] = useLocation();
  const match = location.match(/^\/campaign\/(\d+)$/);
  if (!match) return null;

  const campaignId = match[1];
  const openCharacterSheet = () => {
    const popup = window.open(
      `/character-sheet/${campaignId}`,
      `dmos-character-sheet-${campaignId}`,
      "popup=yes,width=1500,height=950,resizable=yes,scrollbars=yes",
    );
    popup?.focus();
  };

  return (
    <div className="fixed right-5 top-20 z-[70]">
      <Button type="button" variant="secondary" className="shadow-lg" onClick={openCharacterSheet}>
        Character Sheet
      </Button>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/pricing" component={Pricing} />

      {/* Auth */}
      <Route path="/login">{() => <AuthPage defaultTab="login" />}</Route>
      <Route path="/register">{() => <AuthPage defaultTab="register" />}</Route>
      <Route path="/forgot-password">{() => <AuthPage mode="forgot" />}</Route>
      <Route path="/reset-password">{() => <AuthPage mode="reset" />}</Route>

      {/* Protected */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/billing">{() => <ProtectedRoute component={Billing} />}</Route>
      <Route path="/account">{() => <ProtectedRoute component={Account} />}</Route>
      <Route path="/home">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/character-sheet/:id">{() => <ProtectedRoute component={CharacterSheetPage} />}</Route>
      <Route path="/campaign/:id" component={CampaignPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <LegacyHashRedirect />
        <SeoHead />
        <CampaignCharacterSheetLauncher />
        <Suspense fallback={null}>
          <AppRouter />
        </Suspense>
        <VoidsmithAttribution />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
