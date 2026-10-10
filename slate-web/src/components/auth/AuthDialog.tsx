import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/supabase/authStore";
import { toast } from "sonner";
import { Cloud, Lock, LogIn, LogOut, ShieldCheck, UserCheck } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { user, signIn, signUp, signOut, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message || "Failed to sign in.");
    } else {
      toast.success("Signed in successfully! Private cloud sync is now enabled.");
      onOpenChange(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const res = await signUp(email, password);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message || "Failed to create account.");
    } else {
      toast.success("Account created successfully! Welcome to Slate.");
      onOpenChange(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    await signOut();
    setSubmitting(false);
    toast.info("Signed out. Your workspace is now operating locally on this device.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            {user ? (
              <>
                <UserCheck className="h-5 w-5 text-emerald-500" />
                Account & Cloud Sync
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-primary" />
                Sign in to Slate Cloud
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {user
              ? "Your data is securely isolated to your private account."
              : "Keep your boards & notes private. Sign in to enable secure cloud sync across your devices."}
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Signed in as:</span>
                <span className="font-mono text-foreground font-semibold truncate max-w-[220px]">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                <Cloud className="h-4 w-4" />
                <span>Private Cloud Sync Active</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Your boards and notes are encrypted and isolated to your user ID. Only you can view or modify your data.
            </p>

            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
              disabled={submitting}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password" className="text-xs">
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {submitting ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs">
                    Password (min 6 characters)
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm" className="text-xs">
                    Confirm Password
                  </Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {submitting ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            </TabsContent>

            <div className="mt-4 rounded-lg bg-muted/30 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <span>
                Without signing in, your data remains 100% private on this device. Cloud sync is only enabled when you sign in.
              </span>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
