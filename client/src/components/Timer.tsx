import { useEffect, useRef, useState } from "react";

// Countdown timer used by Stage A (HireVue). Calls onDone exactly once at zero.
export function Timer({ seconds, label, onDone, running = true }: {
  seconds: number; label: string; onDone: () => void; running?: boolean;
}) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(false);

  useEffect(() => { setLeft(seconds); done.current = false; }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          if (!done.current) { done.current = true; onDone(); }
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onDone]);

  const pct = (left / seconds) * 100;
  const danger = left <= 10;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={danger ? "font-bold text-red-600" : "font-semibold text-slate-700"}>{left}s</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200">
        <div className={`h-full transition-all ${danger ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
