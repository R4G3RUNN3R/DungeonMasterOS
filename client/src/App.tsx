import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CampaignPage from "@/pages/campaign";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Pricing from "@/pages/pricing";
import HowItWorks from "@/pages/how-it-works";
import Billing from "@/pages/billing";
import Account from "@/pages/account";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Component />;
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
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
