import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API isn't in TypeScript's DOM lib; just the parts used here.
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

/**
 * Dictation through the browser's speech recognition (Chrome, Edge, Safari;
 * not Firefox). Each finished phrase goes to onText. Audio is handled by the
 * browser — Chrome sends it to Google — never by our API.
 */
export function useSpeechRecognition({
  lang,
  onText,
  onError,
}: {
  lang: string;
  onText: (text: string) => void;
  onError?: (error: string) => void;
}) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!getCtor(), () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  // Latest callbacks, so a running session doesn't call stale ones.
  const callbacks = useRef({ onText, onError });
  useEffect(() => {
    callbacks.current = { onText, onError };
  });

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognition.current) return;

    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal && text) callbacks.current.onText(text);
      }
    };
    // "no-speech" and "aborted" just mean it stopped; not worth reporting.
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") callbacks.current.onError?.(e.error);
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };

    recognition.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, start, stop };
}
