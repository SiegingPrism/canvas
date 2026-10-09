import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Plus,
  Layers,
  CheckCircle2,
} from "lucide-react";

export type Flashcard = {
  id: string;
  deck: string;
  question: string;
  answer: string;
  hint?: string;
};

const DEFAULT_CARDS: Flashcard[] = [
  // Physics
  {
    id: "p1",
    deck: "Physics Laws",
    question: "What is Newton's Second Law of Motion in equation form?",
    answer: "F = m · a (Force equals mass multiplied by acceleration)",
    hint: "Relates net force and rate of momentum change",
  },
  {
    id: "p2",
    deck: "Physics Laws",
    question: "What is the speed of light in a vacuum (c)?",
    answer: "c ≈ 3.00 × 10⁸ m/s (299,792,458 m/s)",
    hint: "Universal speed limit in relativity",
  },
  {
    id: "p3",
    deck: "Physics Laws",
    question: "State the First Law of Thermodynamics.",
    answer: "Energy cannot be created or destroyed, only transformed (ΔU = Q - W).",
    hint: "Conservation of energy principle",
  },
  // Math
  {
    id: "m1",
    deck: "Math & Trig",
    question: "What is the fundamental Pythagorean trigonometric identity?",
    answer: "sin²(θ) + cos²(θ) = 1",
    hint: "Derived from the unit circle where x=cos(θ) and y=sin(θ)",
  },
  {
    id: "m2",
    deck: "Math & Trig",
    question: "What is the Quadratic Formula for roots of ax² + bx + c = 0?",
    answer: "x = (-b ± √(b² - 4ac)) / (2a)",
    hint: "Uses the discriminant b² - 4ac",
  },
  {
    id: "m3",
    deck: "Math & Trig",
    question: "What is Euler's Formula connecting trig and complex exponentials?",
    answer: "e^(iθ) = cos(θ) + i·sin(θ)",
    hint: "Yields Euler's identity when θ = π",
  },
  // Chemistry
  {
    id: "c1",
    deck: "Chemistry Essentials",
    question: "What is Avogadro's Number (NA)?",
    answer: "NA ≈ 6.022 × 10²³ particles per mole",
    hint: "Number of units in one mole of any substance",
  },
  {
    id: "c2",
    deck: "Chemistry Essentials",
    question: "What is the Ideal Gas Law equation?",
    answer: "PV = nRT (Pressure × Volume = moles × gas constant × Temp)",
    hint: "Combines Boyle's, Charles's, and Avogadro's laws",
  },
  {
    id: "c3",
    deck: "Chemistry Essentials",
    question: "What is the definition of pH mathematically?",
    answer: "pH = -log₁₀[H⁺] (Negative log of hydrogen ion concentration)",
    hint: "Scale ranges from 0 (very acidic) to 14 (very basic)",
  },
];

export function FlashcardsDialog({
  open,
  onOpenChange,
  onInsertCard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertCard?: (card: Flashcard) => void;
}) {
  const [cards, setCards] = useState<Flashcard[]>(DEFAULT_CARDS);
  const [deckFilter, setDeckFilter] = useState<string>("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const decks = ["All", ...Array.from(new Set(cards.map((c) => c.deck)))];

  const filteredCards = deckFilter === "All" ? cards : cards.filter((c) => c.deck === deckFilter);
  const activeCard = filteredCards[currentIndex % Math.max(1, filteredCards.length)];

  const handleNext = () => {
    setFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
  };

  const handlePrev = () => {
    setFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
  };

  const handleShuffle = () => {
    setFlipped(false);
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const newCard: Flashcard = {
      id: "cust_" + Date.now(),
      deck: "Custom Notes",
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
    };
    setCards((prev) => [newCard, ...prev]);
    setDeckFilter("Custom Notes");
    setNewQuestion("");
    setNewAnswer("");
    setIsAdding(false);
    setCurrentIndex(0);
    setFlipped(false);
  };

  const handleInsert = () => {
    if (activeCard) {
      onInsertCard?.(activeCard);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-5 sm:p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Layers className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg">Interactive Study Flashcards</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(!isAdding)}
              className="h-8 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> {isAdding ? "Close" : "New Card"}
            </Button>
          </div>
          <DialogDescription className="text-xs">
            Review key formulas and concepts with interactive flip cards, or paste them onto the whiteboard.
          </DialogDescription>
        </DialogHeader>

        {isAdding ? (
          <form onSubmit={handleAddCustom} className="space-y-3 p-4 rounded-2xl border bg-muted/30">
            <h4 className="text-xs font-semibold text-foreground">Create Custom Card</h4>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Question / Prompt
              </label>
              <Input
                placeholder="e.g. What is the formula for kinetic energy?"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Answer / Explanation
              </label>
              <Input
                placeholder="e.g. KE = 1/2 · m · v²"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs h-8 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Save Card
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Deck Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {decks.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDeckFilter(d);
                    setCurrentIndex(0);
                    setFlipped(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    deckFilter === d
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Flip Card Container */}
            {activeCard ? (
              <div
                onClick={() => setFlipped(!flipped)}
                className="group relative mt-3 h-52 sm:h-56 w-full cursor-pointer select-none rounded-2xl border-2 border-border/80 bg-gradient-to-br from-card to-card/90 p-6 shadow-md transition-all hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-primary text-[10px]">
                    {activeCard.deck}
                  </span>
                  <span className="font-mono text-[11px]">
                    Card {currentIndex + 1} of {filteredCards.length}
                  </span>
                </div>

                <div className="my-auto text-center px-4">
                  {flipped ? (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block mb-1">
                        Answer
                      </span>
                      <p className="text-base sm:text-lg font-bold text-foreground">
                        {activeCard.answer}
                      </p>
                    </div>
                  ) : (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block mb-1">
                        Question
                      </span>
                      <p className="text-base sm:text-lg font-semibold text-foreground">
                        {activeCard.question}
                      </p>
                      {activeCard.hint && (
                        <p className="text-[11px] text-muted-foreground mt-2 italic">
                          Hint: {activeCard.hint}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCw className="h-3.5 w-3.5 transition group-hover:rotate-180 duration-300" />
                  <span className="text-[11px]">Click or tap anywhere to flip</span>
                </div>
              </div>
            ) : null}

            {/* Navigation & Actions */}
            <div className="flex items-center justify-between pt-3 gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="h-8 w-8 p-0"
                  title="Previous Card"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  className="h-8 w-8 p-0"
                  title="Next Card"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShuffle}
                  className="h-8 px-2 text-xs gap-1"
                  title="Shuffle Deck"
                >
                  <Shuffle className="h-3.5 w-3.5" /> Shuffle
                </Button>
              </div>

              <Button
                size="sm"
                onClick={handleInsert}
                className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Insert to Board
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
