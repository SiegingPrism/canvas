import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAISettings, type AIProvider } from "@/lib/ai/aiSettingsStore";
import { Key, Sparkles, WifiOff, CheckCircle2, ShieldCheck, Cpu } from "lucide-react";
import { toast } from "sonner";

export function AISettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    provider,
    geminiKey,
    openAiKey,
    forceOffline,
    setProvider,
    setGeminiKey,
    setOpenAiKey,
    setForceOffline,
  } = useAISettings();

  const [tempGemini, setTempGemini] = useState(geminiKey);
  const [tempOpenAi, setTempOpenAi] = useState(openAiKey);

  useEffect(() => {
    if (open) {
      setTempGemini(geminiKey);
      setTempOpenAi(openAiKey);
    }
  }, [open, geminiKey, openAiKey]);

  function handleSave() {
    setGeminiKey(tempGemini.trim());
    setOpenAiKey(tempOpenAi.trim());
    toast.success("AI settings saved successfully!");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Intelligence & Offline Settings
          </DialogTitle>
          <DialogDescription>
            Configure your direct AI keys or enable 100% autonomous offline mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Engine
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider("gemini")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition ${
                  provider === "gemini" && !forceOffline
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border hover:bg-accent text-foreground/80"
                }`}
              >
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span>Google Gemini</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider("openai")}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition ${
                  provider === "openai" && !forceOffline
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border hover:bg-accent text-foreground/80"
                }`}
              >
                <Cpu className="h-4 w-4 text-emerald-500" />
                <span>OpenAI</span>
              </button>

              <button
                type="button"
                onClick={() => setForceOffline(!forceOffline)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition ${
                  forceOffline
                    ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    : "border-border hover:bg-accent text-foreground/80"
                }`}
              >
                <WifiOff className="h-4 w-4 text-amber-500" />
                <span>100% Offline</span>
              </button>
            </div>
          </div>

          {/* Gemini Key Input */}
          {!forceOffline && provider === "gemini" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Google Gemini API Key</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  Get free key
                </a>
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="AQ... or AIzaSy..."
                  value={tempGemini}
                  onChange={(e) => setTempGemini(e.target.value)}
                  className="pr-8 text-xs font-mono"
                />
                <Key className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Powers handwriting vision, multimodal board explanation, math formula recognition, and study quizzes.
              </p>
            </div>
          )}

          {/* OpenAI Key Input */}
          {!forceOffline && provider === "openai" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>OpenAI API Key</span>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  Get key
                </a>
              </label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={tempOpenAi}
                  onChange={(e) => setTempOpenAi(e.target.value)}
                  className="pr-8 text-xs font-mono"
                />
                <Key className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Offline Engine Callout */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Autonomous On-Device Fallback
            </div>
            <p className="text-muted-foreground leading-relaxed">
              If an API key is absent or you are disconnected from the internet, Slate automatically switches to the built-in local heuristic engine so handwriting snapping, note summaries, mind maps, quizzes, and semantic search always work.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
