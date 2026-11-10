import { useCallback, useEffect, useState } from "react";

// Day Term (light) or Night Study (dark), or whatever the phone is set to. The choice is a per-device
// convenience, so it lives in localStorage; the page still works if storage is unavailable.

export type TermChoice = "day" | "night" | "system";
const KEY = "academy.term";

function readChoice(): TermChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "day" || value === "night" ? value : "system";
  } catch {
    return "system";
  }
}

const systemTerm = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day");

export function applyTerm(choice: TermChoice) {
  const term = choice === "system" ? systemTerm() : choice;
  document.documentElement.dataset.term = term;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", term === "night" ? "#0b1020" : "#141d33");
}

export function useTerm(): [TermChoice, (choice: TermChoice) => void] {
  const [choice, setChoice] = useState<TermChoice>(readChoice);

  useEffect(() => {
    applyTerm(choice);
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTerm("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  const update = useCallback((next: TermChoice) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved; the choice still applies until the app closes.
    }
    setChoice(next);
  }, []);

  return [choice, update];
}

// Before React renders, so the first frame is already in the right term.
applyTerm(readChoice());
