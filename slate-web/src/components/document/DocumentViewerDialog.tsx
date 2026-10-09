import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AIEngine } from "@/lib/ai/aiEngine";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { useNotes } from "@/lib/notesStore";
import { useLearn } from "@/lib/learnStore";
import {
  FileText,
  Upload,
  Sparkles,
  HelpCircle,
  Layers,
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

export function DocumentViewerDialog({
  open,
  onOpenChange,
  boardId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    overview: string;
    keyPoints: string[];
    actionItems: string[];
  } | null>(null);

  const createNote = useNotes((s) => s.createNote);
  const addBlock = useNotes((s) => s.addBlock);
  const updateBlock = useNotes((s) => s.updateBlock);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    setSummary(null);

    try {
      if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
        // Read text from PDF or raw binary text extraction
        const arrayBuffer = await f.arrayBuffer();
        const decoder = new TextDecoder("utf-8");
        const rawString = decoder.decode(arrayBuffer);
        // Extract printable text chunks
        const extracted = rawString
          .replace(/[^\x20-\x7E\n]/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 5000);
        setDocContent(extracted.trim() || `PDF Document: ${f.name}\nSize: ${Math.round(f.size / 1024)} KB`);
      } else {
        const text = await f.text();
        setDocContent(text.slice(0, 10000));
      }
      toast.success(`Loaded "${f.name}"!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse document");
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize() {
    if (!docContent) return;
    setLoading(true);
    try {
      const res = await AIEngine.summarizeNote(file?.name || "Document", [docContent]);
      setSummary(res);
      toast.success("Document analyzed!");
    } catch (e) {
      console.error(e);
      toast.error("Summarization failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFlashcards() {
    if (!docContent) return;
    setLoading(true);
    try {
      const cards = await AIEngine.generateFlashcards(docContent, file?.name);
      if (boardId && cards.length > 0) {
        // Place flashcard on active board
        const canvasCards = cards.map((c, idx) => ({
          id: Math.random().toString(36).slice(2, 10),
          kind: "flashcard" as const,
          x: 200 + (idx % 3) * 220,
          y: 200 + Math.floor(idx / 3) * 160,
          w: 200,
          h: 130,
          front: c.front,
          back: c.back,
          color: "#fef08a",
        }));
        useWhiteboard.getState().addObjectsToBoard(boardId, canvasCards);
        toast.success(`Generated and placed ${cards.length} flashcards on board!`);
        onOpenChange(false);
      } else {
        toast.success(`Generated ${cards.length} flashcard pairs!`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Flashcard generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateQuiz() {
    if (!docContent) return;
    setLoading(true);
    try {
      const questions = await AIEngine.generateQuiz(docContent, file?.name);
      if (boardId && questions.length > 0) {
        const canvasQuizzes = questions.map((q, idx) => ({
          id: Math.random().toString(36).slice(2, 10),
          kind: "quiz" as const,
          x: 250 + (idx % 2) * 320,
          y: 350 + Math.floor(idx / 2) * 220,
          w: 280,
          h: 180,
          question: q.question,
          options: q.options,
          answerIndex: q.answerIndex,
        }));
        useWhiteboard.getState().addObjectsToBoard(boardId, canvasQuizzes);
        toast.success(`Added ${questions.length} quiz questions to board!`);
        onOpenChange(false);
      } else {
        toast.success(`Generated ${questions.length} questions!`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Quiz generation failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveToNotes() {
    if (!summary) return;
    const noteId = createNote({ title: `${file?.name || "Document"} Summary`, type: "research" });
    const h1 = addBlock(noteId, "h1");
    updateBlock(noteId, h1, { content: summary.overview });

    summary.keyPoints.forEach((p) => {
      const b = addBlock(noteId, "bullet");
      updateBlock(noteId, b, { content: p });
    });

    summary.actionItems.forEach((a) => {
      const c = addBlock(noteId, "checklist");
      updateBlock(noteId, c, { content: a, checked: false });
    });

    toast.success("Document summary saved to Notes!");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            PDF & Document Intelligence
          </DialogTitle>
          <DialogDescription>
            Upload a PDF, presentation, lecture notes, or document for instant AI analysis, quiz & flashcard generation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* File Upload Box */}
          {!file ? (
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl hover:border-primary cursor-pointer transition bg-card hover:bg-accent/40">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-semibold">Choose PDF, PPT, TXT, or Document</span>
              <span className="text-xs text-muted-foreground mt-1">Supports up to 25 MB</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.ppt,.pptx,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs font-semibold">{file.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {Math.round(file.size / 1024)} KB · {docContent.length} chars indexed
                  </div>
                </div>
              </div>
              <label className="text-xs text-primary font-medium hover:underline cursor-pointer">
                Change File
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.ppt,.pptx,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Action Buttons */}
          {file && (
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSummarize}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                Summarize
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateFlashcards}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                <Layers className="h-3.5 w-3.5 text-blue-500" />
                Make Flashcards
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateQuiz}
                disabled={loading}
                className="gap-1.5 text-xs h-9"
              >
                <HelpCircle className="h-3.5 w-3.5 text-emerald-500" />
                Generate Quiz
              </Button>
            </div>
          )}

          {/* Analysis Summary Output */}
          {summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Executive Summary</h4>
                <p className="text-xs text-foreground mt-1 leading-relaxed">{summary.overview}</p>
              </div>

              {summary.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Key Takeaways</h4>
                  <ul className="mt-1 space-y-1">
                    {summary.keyPoints.map((kp, idx) => (
                      <li key={idx} className="text-xs text-foreground/90 flex items-start gap-1.5">
                        <span className="text-primary">•</span> {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-primary/10">
                <Button size="sm" onClick={handleSaveToNotes} className="gap-1 text-xs h-8">
                  <BookOpen className="h-3.5 w-3.5" /> Save as Note
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
