import { useEffect, useState } from "react";

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Check if shown in this tab session
    const hasShown = sessionStorage.getItem("slate_splash_shown");
    if (hasShown) {
      setVisible(false);
      onFinish?.();
      return;
    }

    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem("slate_splash_shown", "1");
        onFinish?.();
      }, 500);
    }, 1400);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!visible) return null;

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("slate_splash_shown", "1");
      onFinish?.();
    }, 300);
  };

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white select-none transition-opacity duration-500 cursor-pointer ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center max-w-sm px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        {/* Logo Card */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute -inset-4 rounded-3xl bg-amber-400/10 blur-xl animate-pulse" />
          <img
            src="/sti-logo.png"
            alt="SNANS TECH"
            className="relative h-28 w-28 rounded-3xl object-cover shadow-2xl ring-2 ring-[#B48528]/40"
          />
        </div>

        {/* Company Title */}
        <h2 className="text-sm font-bold tracking-widest text-[#B48528] uppercase drop-shadow-2xs">
          SNANS TECH INDIA PVT LTD
        </h2>

        {/* App Title */}
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1E255E]">
          Slate Whiteboard
        </h1>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Next-Gen Interactive Digital Classroom & Canvas
        </p>

        {/* Loading Progress Bar */}
        <div className="mt-8 h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-full bg-gradient-to-r from-[#1E255E] via-[#B48528] to-[#1E255E] animate-[shimmer_1.5s_infinite_linear]" />
        </div>

        <p className="mt-3 text-[10px] text-slate-400">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
