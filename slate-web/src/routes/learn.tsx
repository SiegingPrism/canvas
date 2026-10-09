import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useWhiteboard } from "@/lib/whiteboard/store";
import { useLearn, isCardDue, calculateStreak, type CardRating } from "@/lib/learnStore";
import { useNotes } from "@/lib/notesStore";
import { AIEngine } from "@/lib/ai/aiEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  GraduationCap,
  Flame,
  Layers,
  RotateCcw,
  Sparkles,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  Calendar,
  Clock,
  Copy,
  FileText,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learning Hub — Slate" },
      {
        name: "description",
        content: "Study flashcards and test your knowledge with spaced repetition.",
      },
    ],
  }),
  component: LearningHubPage,
});

type FlashcardItem = {
  key: string;
  front: string;
  back: string;
};

type QuizItem = {
  question: string;
  options: string[];
  answerIndex: number;
};

type Deck = {
  boardId: string;
  title: string;
  cards: FlashcardItem[];
  due: number;
};

type QuizGroup = {
  boardId: string;
  title: string;
  questions: QuizItem[];
};

// Starter decks so users have rich content out-of-the-box
const STARTER_DECKS: Deck[] = [
  {
    boardId: "starter-math",
    title: "Essential Math & Formulas",
    due: 3,
    cards: [
      {
        key: "starter-math-1",
        front: "Pythagorean Theorem",
        back: "a² + b² = c² (for right triangles)",
      },
      { key: "starter-math-2", front: "Quadratic Formula", back: "x = (-b ± √(b² - 4ac)) / (2a)" },
      { key: "starter-math-3", front: "Area of a Circle", back: "A = πr²" },
      { key: "starter-math-4", front: "Euler's Formula", back: "e^(iπ) + 1 = 0" },
    ],
  },
  {
    boardId: "starter-science",
    title: "Science & Biology Basics",
    due: 3,
    cards: [
      {
        key: "starter-sci-1",
        front: "Powerhouse of the Cell",
        back: "Mitochondria (generates ATP)",
      },
      { key: "starter-sci-2", front: "Speed of Light (c)", back: "~3.0 × 10⁸ m/s in vacuum" },
      {
        key: "starter-sci-3",
        front: "Newton's Second Law",
        back: "F = m · a (Force = mass × acceleration)",
      },
      {
        key: "starter-sci-4",
        front: "DNA Base Pairs",
        back: "Adenine-Thymine (A-T), Guanine-Cytosine (G-C)",
      },
    ],
  },
];

const STARTER_QUIZZES: QuizGroup[] = [
  {
    boardId: "starter-quiz-1",
    title: "Science & Math Quick Quiz",
    questions: [
      {
        question: "What is the chemical symbol for Gold?",
        options: ["Au", "Ag", "Fe", "Gd"],
        answerIndex: 0,
      },
      {
        question: "How many degrees are in the angles of a triangle?",
        options: ["90°", "180°", "270°", "360°"],
        answerIndex: 1,
      },
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Jupiter", "Mars", "Saturn"],
        answerIndex: 2,
      },
      {
        question: "What is the derivative of sin(x)?",
        options: ["-cos(x)", "cos(x)", "-sin(x)", "tan(x)"],
        answerIndex: 1,
      },
    ],
  },
];

function LearningHubPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { boards, boardOrder, boardData } = useWhiteboard();
  const { progress, attempts, activity, reviewCard, recordQuizAttempt } = useLearn();
  const { createNote, addBlock } = useNotes();

  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [studyCardIndex, setStudyCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const [activeQuiz, setActiveQuiz] = useState<QuizGroup | null>(null);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // AI Study Planner State
  const [plannerGoal, setPlannerGoal] = useState("");
  const [plannerDays, setPlannerDays] = useState("14");
  const [plannerHours, setPlannerHours] = useState("2");
  const [generatedPlan, setGeneratedPlan] = useState<{
    title: string;
    phases: { title: string; tasks: string[] }[];
    dailyRoutine: string;
  } | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Collect custom decks from whiteboards
  const { decks, quizzes } = useMemo(() => {
    if (!mounted) return { decks: STARTER_DECKS, quizzes: STARTER_QUIZZES };

    const customDecks: Deck[] = [];
    const customQuizzes: QuizGroup[] = [];

    for (const id of boardOrder) {
      const b = boards[id];
      const bd = boardData[id];
      if (!b || b.archived || !bd) continue;

      const cards: FlashcardItem[] = [];
      const questions: QuizItem[] = [];

      for (const p of bd.pages) {
        for (const obj of p.objects) {
          if (obj.kind === "flashcard") {
            cards.push({
              key: `${id}:${obj.id}`,
              front: obj.front || "Card Front",
              back: obj.back || "Card Back",
            });
          } else if (obj.kind === "quiz") {
            if (obj.question && Array.isArray(obj.options)) {
              questions.push({
                question: obj.question,
                options: obj.options,
                answerIndex: obj.answerIndex ?? 0,
              });
            }
          }
        }
      }

      if (cards.length > 0) {
        const dueCount = cards.filter((c) => isCardDue(progress[c.key])).length;
        customDecks.push({ boardId: id, title: b.title, cards, due: dueCount });
      }
      if (questions.length > 0) {
        customQuizzes.push({ boardId: id, title: b.title, questions });
      }
    }

    return {
      decks: customDecks.length > 0 ? customDecks : STARTER_DECKS,
      quizzes: customQuizzes.length > 0 ? customQuizzes : STARTER_QUIZZES,
    };
  }, [mounted, boards, boardOrder, boardData, progress]);

  // High-level stats
  const stats = useMemo(() => {
    if (!mounted) return { streak: 0, dueTotal: 0, reviewed: 0, accuracy: null };
    const streak = calculateStreak(activity);
    const dueTotal = decks.reduce((sum, d) => sum + d.due, 0);
    let totalRev = 0;
    let correctRev = 0;
    for (const p of Object.values(progress)) {
      totalRev += p.total;
      correctRev += p.correct;
    }
    const quizTot = attempts.reduce((sum, a) => sum + a.total, 0);
    const quizCor = attempts.reduce((sum, a) => sum + a.correct, 0);
    const accuracy =
      totalRev + quizTot > 0
        ? Math.round(((correctRev + quizCor) / (totalRev + quizTot)) * 100)
        : null;

    return { streak, dueTotal, reviewed: totalRev, accuracy };
  }, [mounted, decks, progress, attempts, activity]);

  // 7-Day Upcoming Review Forecast
  const forecast = useMemo(() => {
    if (!mounted) return [];
    const days: { label: string; count: number; dateStr: string }[] = [];
    const now = new Date();
    const DAY_MS = 86400000;

    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * DAY_MS);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + DAY_MS;

      let count = 0;
      for (const dck of decks) {
        for (const c of dck.cards) {
          const p = progress[c.key];
          const dueTime = p ? p.due : 0;
          if (i === 0) {
            if (dueTime <= dayEnd) count++;
          } else {
            if (dueTime > dayStart && dueTime <= dayEnd) count++;
          }
        }
      }

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const label = i === 0 ? "Today" : i === 1 ? "Tmrw" : dayNames[d.getDay()];
      days.push({
        label,
        count,
        dateStr: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }
    return days;
  }, [mounted, decks, progress]);

  const maxForecastCount = useMemo(() => {
    return Math.max(1, ...forecast.map((f) => f.count));
  }, [forecast]);

  // Flashcard study interaction
  function startStudy(deck: Deck) {
    setActiveDeck(deck);
    setStudyCardIndex(0);
    setCardFlipped(false);
  }

  function handleRate(rating: CardRating) {
    if (!activeDeck) return;
    const card = activeDeck.cards[studyCardIndex];
    reviewCard(card.key, rating);
    if (studyCardIndex < activeDeck.cards.length - 1) {
      setStudyCardIndex((i) => i + 1);
      setCardFlipped(false);
    } else {
      toast.success("Deck completed for now! Great job!");
      setActiveDeck(null);
    }
  }

  // Quiz interaction
  function startQuiz(qg: QuizGroup) {
    setActiveQuiz(qg);
    setQuizQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  }

  function handleAnswerSelect(idx: number) {
    if (selectedAnswer !== null || !activeQuiz) return;
    setSelectedAnswer(idx);
    const currentQ = activeQuiz.questions[quizQuestionIndex];
    const isCorrect = idx === currentQ.answerIndex;
    if (isCorrect) setQuizScore((s) => s + 1);

    setTimeout(() => {
      if (quizQuestionIndex < activeQuiz.questions.length - 1) {
        setQuizQuestionIndex((i) => i + 1);
        setSelectedAnswer(null);
      } else {
        const finalScore = isCorrect ? quizScore + 1 : quizScore;
        recordQuizAttempt({
          boardId: activeQuiz.boardId,
          title: activeQuiz.title,
          correct: finalScore,
          total: activeQuiz.questions.length,
        });
        setQuizFinished(true);
      }
    }, 1100);
  }

  // Generate Study Plan
  async function handleGenerateStudyPlan() {
    if (!plannerGoal.trim()) {
      toast.error("Please enter a subject or study goal");
      return;
    }
    setIsGeneratingPlan(true);
    const days = parseInt(plannerDays, 10) || 14;
    const hours = plannerHours || "2";
    const goal = plannerGoal.trim();

    try {
      const prompt = `You are an expert curriculum and active recall study planner.
Create a structured study plan for: "${goal}".
Duration: ${days} days, studying ${hours} hours daily.
Return valid JSON only in this exact structure:
{
  "title": "${goal} Study Roadmap",
  "dailyRoutine": "${hours}h daily: 45m Focused Study + 10m Spaced Recall + 45m Practice Problems + 20m Review.",
  "phases": [
    {
      "title": "Phase 1: Concept Foundations (Days 1–${Math.max(2, Math.round(days * 0.35))})",
      "tasks": ["Task 1...", "Task 2...", "Task 3..."]
    },
    {
      "title": "Phase 2: Active Recall & Problem Drills (Days ${Math.max(2, Math.round(days * 0.35)) + 1}–${Math.max(4, Math.round(days * 0.75))})",
      "tasks": ["Task 1...", "Task 2...", "Task 3..."]
    },
    {
      "title": "Phase 3: Mock Testing & Synthesis (Days ${Math.max(4, Math.round(days * 0.75)) + 1}–${days})",
      "tasks": ["Task 1...", "Task 2...", "Task 3..."]
    }
  ]
}
Output valid JSON only.`;

      const aiText = await AIEngine.askAssistant(prompt);
      const jsonMatch = aiText?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title && Array.isArray(parsed.phases)) {
          setGeneratedPlan(parsed);
          setIsGeneratingPlan(false);
          toast.success("AI Study plan generated!");
          return;
        }
      }
    } catch {
      // Fallback to local heuristic
    }

    const phase1Days = Math.max(2, Math.round(days * 0.35));
    const phase2Days = Math.max(2, Math.round(days * 0.4));
    setGeneratedPlan({
      title: `${goal} Master Plan`,
      phases: [
        {
          title: `Phase 1: Concept Mastery (Days 1–${phase1Days})`,
          tasks: [
            `Deconstruct core syllabus and map fundamental principles`,
            `Create visual whiteboard mind maps and Feynman summaries`,
            `Extract high-yield definitions into spaced-repetition flashcards`,
          ],
        },
        {
          title: `Phase 2: Active Recall & Problem Sets (Days ${phase1Days + 1}–${phase1Days + phase2Days})`,
          tasks: [
            `Daily flashcard interval drills (${hours}h daily focus)`,
            `Solve practice quizzes under timed exam conditions`,
            `Identify lapse topics and refine Cornell cue notes`,
          ],
        },
        {
          title: `Phase 3: Mock Testing & Final Polish (Days ${phase1Days + phase2Days + 1}–${days})`,
          tasks: [
            `Full-length mock exam with error journal analysis`,
            `Targeted review of lowest-scoring concepts`,
            `Final memory consolidation and formula sheet recap`,
          ],
        },
      ],
      dailyRoutine: `${hours} hours daily: 45m Focused Study + 10m Spaced Recall + 45m Practice Problems + 20m Review.`,
    });
    setIsGeneratingPlan(false);
    toast.success("Study plan generated!");
  }

  function handleSavePlanToNotes() {
    if (!generatedPlan) return;
    const noteId = createNote({
      title: generatedPlan.title,
      type: "standard",
    });

    addBlock(noteId, "h2", undefined, "Daily Routine & Strategy");
    addBlock(noteId, "callout", undefined, generatedPlan.dailyRoutine);
    for (const phase of generatedPlan.phases) {
      addBlock(noteId, "h3", undefined, phase.title);
      for (const task of phase.tasks) {
        addBlock(noteId, "checklist", undefined, task);
      }
    }

    toast.success("Study plan saved to Notes!", {
      action: {
        label: "Open Note",
        onClick: () => navigate({ to: "/note/$noteId", params: { noteId } }),
      },
    });
  }

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-background pb-20">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-6 w-36 rounded bg-muted animate-pulse" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-card border animate-pulse" />
            ))}
          </div>
          <div className="h-44 rounded-2xl bg-card border animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent text-foreground transition"
              title="Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="flex items-center gap-2 font-semibold text-lg text-foreground">
              <GraduationCap className="h-5 w-5 text-primary" /> Learning Hub
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-10">
        {/* Stats Row */}
        <section className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard
            icon={<Flame className="h-5 w-5 text-orange-500" />}
            value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
            label="Study streak"
          />
          <StatCard
            icon={<Layers className="h-5 w-5 text-primary" />}
            value={String(stats.dueTotal)}
            label="Cards due today"
          />
          <StatCard
            icon={<RotateCcw className="h-5 w-5 text-sky-500" />}
            value={String(stats.reviewed)}
            label="Total reviews"
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5 text-emerald-500" />}
            value={stats.accuracy === null ? "—" : `${stats.accuracy}%`}
            label="Accuracy"
          />
        </section>

        {/* 7-Day Upcoming Review Forecast Bar Chart */}
        <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" /> 7-Day Revision Forecast
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Spaced repetition review load based on active recall curves
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {stats.dueTotal} cards due
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2 items-end h-36">
            {forecast.map((item, idx) => {
              const heightPct = Math.max(12, Math.round((item.count / maxForecastCount) * 100));
              const isToday = idx === 0;
              return (
                <div
                  key={item.label + idx}
                  className="flex flex-col items-center gap-1.5 h-full justify-end group"
                >
                  <span className="text-[11px] font-semibold text-foreground/80 group-hover:text-primary transition tabular-nums">
                    {item.count}
                  </span>
                  <div className="w-full max-w-[42px] bg-muted rounded-t-lg overflow-hidden flex flex-col justify-end h-20">
                    <div
                      className={`w-full transition-all duration-300 rounded-t-lg ${
                        isToday
                          ? "bg-primary shadow-sm"
                          : item.count > 0
                            ? "bg-primary/50 group-hover:bg-primary/80"
                            : "bg-muted-foreground/20"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}
                    >
                      {item.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">{item.dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Study Planner */}
        <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" /> AI Study Planner
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate an active recall roadmap for upcoming exams or topics
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Subject / Goal</label>
              <Input
                placeholder="e.g. Physics Midterm, Biology Cell"
                value={plannerGoal}
                onChange={(e) => setPlannerGoal(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Preparation Time (Days)
              </label>
              <Input
                type="number"
                min="3"
                max="120"
                value={plannerDays}
                onChange={(e) => setPlannerDays(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Daily Study Hours</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={plannerHours}
                  onChange={(e) => setPlannerHours(e.target.value)}
                  className="h-9"
                />
                <Button
                  onClick={handleGenerateStudyPlan}
                  disabled={isGeneratingPlan}
                  className="shrink-0 h-9"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Plan
                </Button>
              </div>
            </div>
          </div>

          {generatedPlan && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> {generatedPlan.title}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const text =
                        `${generatedPlan.title}\n\nRoutine: ${generatedPlan.dailyRoutine}\n\n` +
                        generatedPlan.phases
                          .map((p) => `${p.title}\n` + p.tasks.map((t) => ` - ${t}`).join("\n"))
                          .join("\n\n");
                      navigator.clipboard.writeText(text);
                      toast.success("Plan copied to clipboard!");
                    }}
                    className="h-8 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                  <Button size="sm" onClick={handleSavePlanToNotes} className="h-8 text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" /> Save to Notes
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground italic">
                {generatedPlan.dailyRoutine}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 pt-1">
                {generatedPlan.phases.map((phase, idx) => (
                  <div key={idx} className="rounded-lg bg-card p-3 border shadow-xs space-y-1.5">
                    <div className="font-semibold text-xs text-primary">{phase.title}</div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {phase.tasks.map((task, tIdx) => (
                        <li key={tIdx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Flashcard Decks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-4 w-4" /> Flashcard Decks
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <div
                key={deck.boardId}
                className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground">{deck.title}</h3>
                    {deck.due > 0 && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {deck.due} due
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} in deck
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Button size="sm" onClick={() => startStudy(deck)} className="w-full">
                    Study deck
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Practice Quizzes */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <HelpCircle className="h-4 w-4" /> Practice Quizzes
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <div
                key={q.boardId}
                className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div>
                  <h3 className="font-semibold text-base text-foreground">{q.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.questions.length} question{q.questions.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startQuiz(q)}
                    className="w-full"
                  >
                    Take quiz
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quiz Attempt History Log */}
        {attempts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Recent Quiz Attempts
              </h2>
              <span className="text-xs text-muted-foreground">{attempts.length} logged</span>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
              <div className="divide-y divide-border">
                {attempts.slice(0, 8).map((att) => {
                  const pct = Math.round((att.correct / att.total) * 100);
                  const isGreat = pct >= 80;
                  return (
                    <div key={att.id} className="flex items-center justify-between p-4 text-sm">
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground">{att.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(att.at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isGreat
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {att.correct} / {att.total} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Flashcard Study Modal */}
      <Dialog open={!!activeDeck} onOpenChange={(open) => !open && setActiveDeck(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>{activeDeck?.title}</span>
              <span>
                {studyCardIndex + 1} / {activeDeck?.cards.length}
              </span>
            </DialogTitle>
          </DialogHeader>

          {activeDeck && (
            <div className="mt-4 space-y-6">
              {/* Card surface */}
              <div
                onClick={() => setCardFlipped(!cardFlipped)}
                className="relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border bg-card/60 p-6 text-center shadow-inner transition hover:border-primary"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {cardFlipped ? "Answer" : "Question (Tap to flip)"}
                </div>
                <p className="text-lg font-medium text-foreground">
                  {cardFlipped
                    ? activeDeck.cards[studyCardIndex]?.back
                    : activeDeck.cards[studyCardIndex]?.front}
                </p>
              </div>

              {/* Rating Buttons */}
              {cardFlipped ? (
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleRate("again")}
                    className="flex flex-col h-auto py-2 border-red-500/40 text-red-600 hover:bg-red-500/10"
                  >
                    <span className="font-bold text-xs">Again</span>
                    <span className="text-[10px] text-muted-foreground">10m</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRate("hard")}
                    className="flex flex-col h-auto py-2 border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
                  >
                    <span className="font-bold text-xs">Hard</span>
                    <span className="text-[10px] text-muted-foreground">1d</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRate("good")}
                    className="flex flex-col h-auto py-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <span className="font-bold text-xs">Good</span>
                    <span className="text-[10px] text-muted-foreground">3d</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRate("easy")}
                    className="flex flex-col h-auto py-2 border-sky-500/40 text-sky-600 hover:bg-sky-500/10"
                  >
                    <span className="font-bold text-xs">Easy</span>
                    <span className="text-[10px] text-muted-foreground">7d</span>
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setCardFlipped(true)} className="w-full">
                  Show answer
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quiz Modal */}
      <Dialog open={!!activeQuiz} onOpenChange={(open) => !open && setActiveQuiz(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>{activeQuiz?.title}</span>
              {!quizFinished && activeQuiz && (
                <span>
                  {quizQuestionIndex + 1} / {activeQuiz.questions.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {activeQuiz && (
            <div className="mt-4">
              {quizFinished ? (
                <div className="space-y-4 text-center py-6">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                  <h3 className="text-xl font-bold">Quiz Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    You scored {quizScore} out of {activeQuiz.questions.length} (
                    {Math.round((quizScore / activeQuiz.questions.length) * 100)}%)
                  </p>
                  <Button onClick={() => setActiveQuiz(null)} className="mt-4">
                    Back to Learning Hub
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-foreground leading-relaxed">
                    {activeQuiz.questions[quizQuestionIndex]?.question}
                  </h3>

                  <div className="space-y-2">
                    {activeQuiz.questions[quizQuestionIndex]?.options.map((opt, i) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrect = i === activeQuiz.questions[quizQuestionIndex].answerIndex;
                      let btnStyle = "border-border hover:bg-accent text-foreground";
                      if (selectedAnswer !== null) {
                        if (isCorrect) {
                          btnStyle =
                            "border-emerald-500 bg-emerald-500/10 text-emerald-600 font-semibold";
                        } else if (isSelected) {
                          btnStyle = "border-red-500 bg-red-500/10 text-red-600";
                        }
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleAnswerSelect(i)}
                          disabled={selectedAnswer !== null}
                          className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-sm transition ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {selectedAnswer !== null && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                          {selectedAnswer !== null && isSelected && !isCorrect && (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">{icon}</span>
        <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
      </div>
      <span className="mt-2 text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
