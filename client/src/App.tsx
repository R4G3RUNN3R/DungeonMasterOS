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
        <CampaignCharacterSheetLauncher />
        <Suspense fallback={null}>
          <AppRouter />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
