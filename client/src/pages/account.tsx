import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, User, Lock, AlertCircle, CheckCircle, LogOut } from "lucide-react";
import logoImg from "@assets/logo.png";

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

  if (!isLoading && !user) { navigate("/login"); return null; }
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

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
