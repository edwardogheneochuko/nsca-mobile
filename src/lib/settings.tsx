// App-wide settings (server address, dataset) and the last result, persisted on device / in the browser.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import type { Dataset, IdentifyResult } from "./api";

const KEY = "nsca.settings.v1";

/** Best guess for the backend address before the user sets one. */
export function defaultApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env;
  if (Platform.OS === "web") {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `http://${host || "localhost"}:8000`;
  }
  // In Expo Go the dev server runs on the laptop; the backend is usually on the same machine.
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host) return `http://${host}:8000`;
  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
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
        if (raw) setS((cur) => ({ ...cur, ...JSON.parse(raw) }));
      } catch {}
      setReady(true);
    })();
  }, []);

  const save = (next: Settings) => {
    setS(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
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
