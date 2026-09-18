import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, User, Lock, AlertCircle, CheckCircle, LogOut, Monitor, ShieldCheck } from "lucide-react";
import logoImg from "@assets/logo.png";

type AuthSessionSummary = {
  id: number;
  authMethod: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
};

type AuthSessionsResponse = {
  sessions: AuthSessionSummary[];
};

function describeSessionClient(userAgent: string | null): string {
  if (!userAgent) return "Unknown browser or device";

  const browser =
    userAgent.includes("Firefox/") ? "Firefox" :
    userAgent.includes("Edg/") ? "Edge" :
    userAgent.includes("Chrome/") ? "Chrome" :
    userAgent.includes("Safari/") ? "Safari" :
    "Browser";

  const platform =
    userAgent.includes("Windows") ? "Windows" :
    userAgent.includes("Android") ? "Android" :
    /iPhone|iPad/.test(userAgent) ? "iOS/iPadOS" :
    /Macintosh|Mac OS X/.test(userAgent) ? "macOS" :
    userAgent.includes("Linux") ? "Linux" :
    "unknown device";

  return `${browser} on ${platform}`;
}

function authMethodLabel(method: string): string {
  switch (method) {
    case "google": return "Google";
    case "password": return "Password";
    case "register": return "Registration";
    case "legacy-jwt": return "Migrated session";
    default: return "Session";
  }
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function Account() {
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match.");
      if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      return res.json();
    },
    onSuccess: () => {
      setPwSuccess(true);
      setPwError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
    },
    onError: (err: Error) => {
      setPwError(err.message);
      setPwSuccess(false);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess: () => { queryClient.clear(); navigate("/"); },
  });

  const sessionsQuery = useQuery<AuthSessionsResponse>({
    queryKey: ["/api/auth/sessions"],
    enabled: !!user,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest("DELETE", `/api/auth/sessions/${sessionId}`);
      return await res.json() as { ok: true; signedOutCurrentSession: boolean };
    },
    onSuccess: (result) => {
      if (result.signedOutCurrentSession) {
        queryClient.clear();
        navigate("/login");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
      toast({
        title: "Session revoked",
        description: "That signed-in session can no longer access your account.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not revoke session",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, user, navigate]);

  if (!isLoading && !user) return null;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border px-6 py-3 flex items-center justify-between bg-background/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 text-xs"><ChevronLeft className="w-4 h-4" /> Dashboard</Button>
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Account Settings</span>
        </div>
        <Link href="/">
          <img src={logoImg} alt="DMOS" className="w-7 h-7 rounded-lg" style={{ border: "1px solid #c4a26544" }} />
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Profile info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Profile
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Username</Label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-muted text-sm text-foreground font-mono">
                {user?.username}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email Address</Label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                {user?.email}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Member Since</Label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">To change your username or email, contact support.</p>
        </div>

        {/* Active sessions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Active Sessions
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Review browsers and devices currently signed in to your account. Revoke anything you do not recognize.
          </p>

          {sessionsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions...
            </div>
          )}

          {sessionsQuery.isError && (
            <div className="flex items-start gap-2 text-destructive text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Could not load active sessions.
            </div>
          )}

          {!sessionsQuery.isLoading && !sessionsQuery.isError && sessionsQuery.data?.sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions were found.</p>
          )}

          <div className="space-y-3">
            {sessionsQuery.data?.sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-3">
                    <Monitor className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {describeSessionClient(session.userAgent)}
                        </span>
                        {session.current && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {authMethodLabel(session.authMethod)} · Last active {formatSessionTime(session.lastSeenAt)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/80">
                        Signed in {formatSessionTime(session.createdAt)} · Expires {formatSessionTime(session.expiresAt)}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={revokeSessionMutation.isPending}
                    onClick={() => {
                      const prompt = session.current
                        ? "Sign out this current session?"
                        : "Revoke this signed-in session?";
                      if (window.confirm(prompt)) {
                        revokeSessionMutation.mutate(session.id);
                      }
                    }}
                  >
                    {revokeSessionMutation.isPending && revokeSessionMutation.variables === session.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : session.current ? "Sign Out" : "Revoke"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Change Password
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); setPwError(""); setPwSuccess(false); changePasswordMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="current-pw" className="text-xs text-muted-foreground">Current Password</Label>
              <Input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw" className="text-xs text-muted-foreground">New Password</Label>
              <Input id="new-pw" type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw" className="text-xs text-muted-foreground">Confirm New Password</Label>
              <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            {pwError && (
              <div className="flex items-start gap-2 text-destructive text-xs p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 text-green-400 text-xs p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />Password updated successfully.
              </div>
            )}
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating...</> : "Update Password"}
            </Button>
          </form>
        </div>

        {/* Sign out */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <LogOut className="w-4 h-4 text-primary" /> Sign Out
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Sign out of your account on this device.</p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Sign Out
          </Button>
        </div>

        {/* Billing link */}
        <div className="text-center">
          <Link href="/billing" className="text-xs text-primary hover:underline">Manage subscription &amp; billing →</Link>
        </div>
      </main>
    </div>
  );
}
