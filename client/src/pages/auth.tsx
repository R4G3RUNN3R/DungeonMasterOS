import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/appBase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Swords, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import logoImg from "@assets/logo.png";

interface AuthPageProps {
  defaultTab?: "login" | "register";
  mode?: "login" | "register" | "forgot" | "reset";
}

export default function AuthPage({ defaultTab = "register", mode }: AuthPageProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine current view
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const resetToken = params.get("token");
  const currentMode = mode || (resetToken ? "reset" : defaultTab === "login" ? "login" : "register");

  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Register
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [view, setView] = useState<"auth" | "forgot" | "reset">(
    resetToken ? "reset" : "auth",
  );

  const googleStatusQuery = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/auth/google/status"), { credentials: "include" });
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  const googleEnabled = !!googleStatusQuery.data?.enabled;

  const startGoogleAuth = () => {
    window.location.href = apiUrl("/api/auth/google");
  };

  useEffect(() => { setFormError(""); }, [activeTab, view]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (regPassword !== regConfirm) throw new Error("Passwords do not match.");
      if (regPassword.length < 8) throw new Error("Password must be at least 8 characters.");
      const res = await apiRequest("POST", "/api/auth/register", {
        email: regEmail,
        username: regUsername,
        password: regPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/dashboard");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/dashboard");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: forgotEmail });
      return res.json();
    },
    onSuccess: () => setForgotSent(true),
    onError: () => setForgotSent(true), // Don't reveal whether email exists
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmNewPassword) throw new Error("Passwords do not match.");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token: resetToken,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => setResetDone(true),
    onError: (err: Error) => setFormError(err.message),
  });

  const bgGradient = {
    background: "radial-gradient(ellipse 80% 60% at 50% 30%, hsl(35 75% 52% / 0.05) 0%, transparent 60%)",
  };

  const googleAuthBlock = googleEnabled ? (
    <div className="space-y-4 mb-6">
      <Button type="button" variant="outline" className="w-full h-10 gap-2" onClick={startGoogleAuth}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border font-bold text-sm">
          G
        </span>
        Continue with Google
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or use email</span>
        </div>
      </div>
    </div>
  ) : null;

  const gridPattern = {
    backgroundImage: "linear-gradient(hsl(35 75% 52%) 1px, transparent 1px), linear-gradient(90deg, hsl(35 75% 52%) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
  };

  if (view === "reset" || resetToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" style={bgGradient}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={gridPattern} />
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/">
              <img src={logoImg} alt="DMOS" className="mx-auto w-20 h-20 rounded-2xl mb-4 cursor-pointer" style={{ border: "2px solid #c4a265" }} />
            </Link>
            <h1 className="font-serif text-2xl font-bold">Reset Password</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your new password below</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
            {resetDone ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                <p className="text-sm font-semibold text-foreground">Password reset successfully</p>
                <p className="text-xs text-muted-foreground">You can now sign in with your new password.</p>
                <Button className="w-full" onClick={() => navigate("/login")}>Sign In</Button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setFormError(""); resetMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Input id="new-password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password" className="text-xs text-muted-foreground">Confirm New Password</Label>
                  <Input id="confirm-new-password" type="password" placeholder="Repeat your password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-destructive text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{formError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
                  {resetMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Resetting...</> : "Reset Password"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "forgot") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" style={bgGradient}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={gridPattern} />
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/">
              <img src={logoImg} alt="DMOS" className="mx-auto w-20 h-20 rounded-2xl mb-4 cursor-pointer" style={{ border: "2px solid #c4a265" }} />
            </Link>
            <h1 className="font-serif text-2xl font-bold">Forgot Password</h1>
            <p className="text-muted-foreground text-sm mt-1">We'll send you a reset link</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
            {forgotSent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-primary mx-auto" />
                <p className="text-sm font-semibold text-foreground">Check your email</p>
                <p className="text-xs text-muted-foreground">If that email exists, a reset link has been sent.</p>
                <Button variant="outline" className="w-full" onClick={() => setView("auth")}>Back to Sign In</Button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); forgotMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-xs text-muted-foreground">Email Address</Label>
                  <Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" />
                </div>
                <Button type="submit" className="w-full" disabled={forgotMutation.isPending}>
                  {forgotMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</> : "Send Reset Link"}
                </Button>
                <button type="button" onClick={() => setView("auth")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" style={bgGradient}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={gridPattern} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <img src={logoImg} alt="Dungeon Master OS" className="mx-auto w-20 h-20 rounded-2xl mb-4 cursor-pointer hover:opacity-90 transition-opacity" style={{ border: "2px solid #c4a265" }} />
          </Link>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">Dungeon Master OS</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeTab === "register" ? "Begin your adventure" : "Welcome back, adventurer"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setFormError(""); }}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="register" className="flex-1 text-sm">Create Account</TabsTrigger>
              <TabsTrigger value="login" className="flex-1 text-sm">Sign In</TabsTrigger>
            </TabsList>
            {googleAuthBlock}

            {/* Register */}
            <TabsContent value="register">
              <form onSubmit={(e) => { e.preventDefault(); setFormError(""); registerMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="reg-email" type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-xs text-muted-foreground">Username</Label>
                  <Input id="reg-username" type="text" placeholder="YourHeroName" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required autoComplete="username" />
                  <p className="text-xs text-muted-foreground">Letters, numbers, underscores, hyphens only</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input id="reg-password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required autoComplete="new-password" className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-confirm" className="text-xs text-muted-foreground">Confirm Password</Label>
                  <Input id="reg-confirm" type="password" placeholder="Repeat your password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required autoComplete="new-password" />
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-destructive text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{formError}
                  </div>
                )}
                <Button type="submit" className="w-full gap-2 h-10" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : <><Swords className="w-4 h-4" />Create Account</>}
                </Button>
                <p className="text-center text-xs text-muted-foreground">No free trial — a one-time Squire Pass or subscription gets you playing.</p>
                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setActiveTab("login")} className="text-primary hover:underline">Sign in</button>
                </p>
              </form>
            </TabsContent>

            {/* Login */}
            <TabsContent value="login">
              <form onSubmit={(e) => { e.preventDefault(); setFormError(""); loginMutation.mutate(); }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input id="login-password" type={showConfirm ? "text" : "password"} placeholder="Your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" className="pr-10" />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => setView("forgot")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Forgot password?
                  </button>
                </div>
                {formError && (
                  <div className="flex items-start gap-2 text-destructive text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{formError}
                  </div>
                )}
                <Button type="submit" className="w-full h-10" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in...</> : "Sign In"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setActiveTab("register")} className="text-primary hover:underline">Create one free</button>
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
