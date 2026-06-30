import { useEffect, useRef, useState } from "react";

// Text answer + optional mic transcription via the browser Web Speech API.
// HireVue realism: practice speaking, not typing. Falls back to text-only if
// the browser doesn't support SpeechRecognition.
export function AnswerInput({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (final) baseRef.current = (baseRef.current + " " + final).trim();
      onChange((baseRef.current + " " + interim).trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (disabled || !recRef.current) return;
    if (listening) { recRef.current.stop(); setListening(false); }
    else { baseRef.current = value; try { recRef.current.start(); setListening(true); } catch { /* already started */ } }
  }

  return (
    <div>
      <textarea
        className="h-40 w-full rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "Speak (mic) or type your answer…"}
        onChange={(e) => { baseRef.current = e.target.value; onChange(e.target.value); }}
      />
      <div className="mt-2 flex items-center gap-3">
        {supported ? (
          <button
            type="button" onClick={toggle} disabled={disabled}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${listening ? "bg-red-600 text-white animate-pulse" : "bg-slate-800 text-white"} disabled:opacity-40`}
          >
            {listening ? "● Recording — stop" : "🎤 Speak"}
          </button>
        ) : (
          <span className="text-xs text-slate-400">Mic transcription not supported in this browser — type instead.</span>
        )}
        <span className="text-xs text-slate-400">{value.trim() ? `${value.trim().split(/\s+/).length} words` : ""}</span>
      </div>
    </div>
  );
}
