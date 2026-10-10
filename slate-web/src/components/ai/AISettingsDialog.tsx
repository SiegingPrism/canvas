import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAISettings } from "@/lib/ai/aiSettingsStore";
import { GEMINI_MODEL } from "@/lib/ai/aiEngine";
import { Key, Sparkles, CheckCircle2, Wifi } from "lucide-react";
import { toast } from "sonner";

export function AISettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const geminiKey = useAISettings((s) => s.geminiKey);
  const setGeminiKey = useAISettings((s) => s.setGeminiKey);
  const hasBuiltInKey = useAISettings((s) => s.hasBuiltInKey());

  const [tempKey, setTempKey] = useState(geminiKey);

  useEffect(() => {
    if (open) setTempKey(geminiKey);
  }, [open, geminiKey]);

  function handleSave() {
    setGeminiKey(tempKey);
    toast.success("AI settings saved");
    onOpenChange(false);
  }

  const usingBuiltIn = !tempKey.trim() && hasBuiltInKey;
  const notConfigured = !tempKey.trim() && !hasBuiltInKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Settings
          </DialogTitle>
          <DialogDescription>
            Slate AI runs online with Google Gemini ({GEMINI_MODEL}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Personal Gemini API key (optional)</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline"
              >
                Get a free key
              </a>
            </label>
            <div className="relative">
              <Input
                type="password"
                placeholder={
                  hasBuiltInKey
                    ? "Leave blank to use Slate's built-in AI"
                    : "Paste your Gemini API key"
                }
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                className="pr-8 text-xs font-mono"
                autoComplete="off"
              />
              <Key className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your key is stored only on this device and used for chat, handwriting, math, quizzes
              and flashcards.
            </p>
          </div>

          <div
            className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
              notConfigured
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-primary/20 bg-primary/5 text-muted-foreground"
            }`}
          >
            <Wifi className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {notConfigured
                ? "No API key is configured yet, so AI features are turned off. Add a key above."
                : usingBuiltIn
                  ? "Using Slate's built-in AI. AI features need an internet connection."
                  : "Using your personal key. AI features need an internet connection."}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
