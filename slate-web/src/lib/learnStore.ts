import { create } from "zustand";

export type CardRating = "again" | "hard" | "good" | "easy";

export type CardProgress = {
  ease: number;
  intervalDays: number;
  due: number;
  reps: number;
  lapses: number;
  correct: number;
  total: number;
  lastReviewed: number;
};

export type QuizAttempt = {
  id: string;
  boardId: string;
  title: string;
  correct: number;
  total: number;
  at: number;
};

export type DailyActivity = {
  date: string;
  cardsReviewed: number;
  cardsCorrect: number;
  quizQuestions: number;
  quizCorrect: number;
};

type LearningData = {
  progress: Record<string, CardProgress>;
  attempts: QuizAttempt[];
  activity: Record<string, DailyActivity>;
};

const STORAGE_KEY = "learning.v1";
const DAY_MS = 86400000;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyData(): LearningData {
  return { progress: {}, attempts: [], activity: {} };
}

function loadStorage(): LearningData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyData(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyData();
}

function saveStorage(data: LearningData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function calculateNextReview(current: CardProgress | undefined, rating: CardRating): CardProgress {
  const p: CardProgress = current ?? {
    ease: 2.5,
    intervalDays: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    correct: 0,
    total: 0,
    lastReviewed: 0,
  };

  let ease = p.ease;
  let interval = p.intervalDays;
  let lapses = p.lapses;
  const isCorrect = rating !== "again";
  const correct = isCorrect ? p.correct + 1 : p.correct;

  if (rating === "again") {
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0;
  } else if (rating === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    interval = Math.max(1, interval * 1.2 || 1);
  } else if (rating === "good") {
    interval = interval > 0 ? interval * ease : 1;
  } else {
    // easy
    ease = Math.min(3.0, ease + 0.15);
    interval = (interval > 0 ? interval * ease : 2) * 1.3;
  }

  interval = Math.min(365, interval);
  const due = Date.now() + (rating === "again" ? 10 * 60000 : interval * DAY_MS);

  return {
    ease,
    intervalDays: interval,
    due,
    reps: p.reps + 1,
    lapses,
    correct,
    total: p.total + 1,
    lastReviewed: Date.now(),
  };
}

export function isCardDue(progress?: CardProgress): boolean {
  return !progress || progress.due <= Date.now();
}

export function calculateStreak(activity: Record<string, DailyActivity>): number {
  let streak = 0;
  const d = new Date();
  const todayAct = activity[todayKey(d)];
  if (!todayAct || todayAct.cardsReviewed + todayAct.quizQuestions === 0) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const act = activity[todayKey(d)];
    if (!act || act.cardsReviewed + act.quizQuestions === 0) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

type LearnState = LearningData & {
  hydrated: boolean;
  reviewCard: (cardKey: string, rating: CardRating) => void;
  recordQuizAttempt: (attempt: Omit<QuizAttempt, "id" | "at">) => void;
  resetProgress: () => void;
};

export const useLearn = create<LearnState>((set, get) => {
  return {
    ...emptyData(),
    hydrated: false,

    reviewCard: (cardKey, rating) => {
      const state = get();
      const updatedProgress = calculateNextReview(state.progress[cardKey], rating);
      const progress = { ...state.progress, [cardKey]: updatedProgress };
      const today = todayKey();
      const currentAct = state.activity[today] ?? {
        date: today,
        cardsReviewed: 0,
        cardsCorrect: 0,
        quizQuestions: 0,
        quizCorrect: 0,
      };
      const activity = {
        ...state.activity,
        [today]: {
          ...currentAct,
          cardsReviewed: currentAct.cardsReviewed + 1,
          cardsCorrect: currentAct.cardsCorrect + (rating === "again" ? 0 : 1),
        },
      };
      const data: LearningData = { progress, attempts: state.attempts, activity };
      saveStorage(data);
      set(data);
    },

    recordQuizAttempt: (attempt) => {
      const state = get();
      const fullAttempt: QuizAttempt = { ...attempt, id: uid(), at: Date.now() };
      const attempts = [fullAttempt, ...state.attempts].slice(0, 50);
      const today = todayKey();
      const currentAct = state.activity[today] ?? {
        date: today,
        cardsReviewed: 0,
        cardsCorrect: 0,
        quizQuestions: 0,
        quizCorrect: 0,
      };
      const activity = {
        ...state.activity,
        [today]: {
          ...currentAct,
          quizQuestions: currentAct.quizQuestions + attempt.total,
          quizCorrect: currentAct.quizCorrect + attempt.correct,
        },
      };
      const data: LearningData = { progress: state.progress, attempts, activity };
      saveStorage(data);
      set(data);
    },

    resetProgress: () => {
      const data = emptyData();
      saveStorage(data);
      set(data);
    },
  };
});

if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const loaded = loadStorage();
    useLearn.setState({ ...loaded, hydrated: true });
  });
}
