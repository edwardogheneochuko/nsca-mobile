// App-wide settings (server address, dataset) and the last result, persisted on device / in the browser.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import type { Dataset, IdentifyResult } from "./api";

const KEY = "nsca.settings.v1";

/** Hosted backend, used by a deployed website built without EXPO_PUBLIC_API_URL. */
const HOSTED_API_URL = "https://nsca.onrender.com";

/** Best guess for the backend address before the user sets one. */
export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env;
  if (Platform.OS === "web") {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    if (host && !isLocalUrl(`http://${host}`)) return HOSTED_API_URL;
    return `http://${host || "localhost"}:8000`;
  }
  // In Expo Go the dev server runs on the laptop; the backend is usually on the same machine.
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host) return `http://${host}:8000`;
  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}

/** A laptop / emulator address saved during local development. */
const isLocalUrl = (u: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?\/?$/i.test(u.trim());

/** Saved address, unless it is a stale local one and the default is a hosted backend. */
function savedApiUrl(saved: unknown): string | null {
  if (typeof saved !== "string" || !saved.trim()) return null;
  if (isLocalUrl(saved) && !isLocalUrl(defaultApiUrl())) return null;
  return saved.trim();
}

interface Settings {
  apiUrl: string;
  dataset: Dataset;
}

interface Ctx extends Settings {
  ready: boolean;
  setApiUrl: (u: string) => void;
  setDataset: (d: Dataset) => void;
  lastResult: {
    result: IdentifyResult;
    answers: string[];
    labels: string[];
    // Stage 1 input record, shown on the result screen
    text?: string;
    extracted?: { phrase: string | null; label: string }[];   // phrase = null when ticked by hand
    absent?: { phrase: string; label: string }[];
    unrecognised?: string[];
    defaults?: string[];
  } | null;
  setLastResult: (r: Ctx["lastResult"]) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>({ apiUrl: defaultApiUrl(), dataset: "ddxplus" });
  const [ready, setReady] = useState(false);
  const [lastResult, setLastResult] = useState<Ctx["lastResult"]>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setS((cur) => ({
            apiUrl: savedApiUrl(saved.apiUrl) ?? cur.apiUrl,
            dataset: saved.dataset ?? cur.dataset,
          }));
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  // Only an address the user typed is saved; otherwise the build's default (.env) keeps applying.
  const save = (next: Settings) => {
    setS(next);
    const apiUrl = next.apiUrl === defaultApiUrl() ? undefined : next.apiUrl;
    AsyncStorage.setItem(KEY, JSON.stringify({ dataset: next.dataset, apiUrl })).catch(() => {});
  };

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      ready,
      setApiUrl: (apiUrl) => save({ ...s, apiUrl: apiUrl.trim() }),
      setDataset: (dataset) => save({ ...s, dataset }),
      lastResult,
      setLastResult,
    }),
    [s, ready, lastResult],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings must be used inside SettingsProvider");
  return c;
}

export const DATASET_LABELS: Record<Dataset, { name: string; note: string }> = {
  ddxplus: { name: "DDXPlus", note: "Everyday conditions, 46 known diseases (synthetic patients)" },
  mendeley: { name: "Disease–symptom 2023", note: "40 known diseases (synthetic patients)" },
  phenopackets: { name: "Phenopacket-store", note: "Rare genetic diseases from real case reports" },
};
