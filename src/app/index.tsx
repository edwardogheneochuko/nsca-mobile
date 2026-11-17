import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Badge, Button, Card, H1, H2, P, Row, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { DATASET_LABELS, useSettings } from "@/lib/settings";
import { colors, space } from "@/lib/theme";

const STAGES = [
  { n: "1", title: "Neural clustering", text: "ESOINN groups your symptoms with similar past patients and checks whether you fit any group." },
  { n: "2", title: "Explanation", text: "A decision-tree rule, a symptom-by-symptom comparison and similar real cases explain the grouping." },
  { n: "3", title: "Symbolic reasoning", text: "Symptoms are mapped to medical ontology terms (HPO) and each candidate disease is checked against them." },
];

export default function Home() {
  const router = useRouter();
  const { apiUrl, dataset, ready } = useSettings();
  const [server, setServer] = useState<"checking" | "ok" | "down">("checking");
  const [loaded, setLoaded] = useState<string[]>([]);

  const check = useCallback(() => {
    setServer("checking");
    api.health(apiUrl)
      .then((h) => { setLoaded(h.models_loaded); setServer("ok"); })
      .catch(() => setServer("down"));
  }, [apiUrl]);

  useEffect(() => { if (ready) check(); }, [ready, check]);

  const modelMissing = server === "ok" && !loaded.includes(dataset);

  return (
    <Screen>
      <View style={{ gap: space.sm, paddingVertical: space.sm }}>
        <H1>Check your symptoms</H1>
        <P muted>
          A research prototype that suggests which known disease matches your symptoms, explains why,
          and flags patterns that match no known disease.
        </P>
      </View>

      <Card tone="warn">
        <P small>
          Not a medical diagnosis. This tool is for research and education. If you feel unwell, see a
          health worker.
        </P>
      </Card>

      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "600", color: colors.text }}>Server</Text>
          {server === "checking" ? <Badge label="Checking…" /> :
            server === "ok" ? <Badge label="Connected" tone="known" /> : <Badge label="Not reachable" tone="new" />}
        </Row>
        <P small muted>{apiUrl}</P>
        <P small muted>Disease set: {DATASET_LABELS[dataset].name} — {DATASET_LABELS[dataset].note}</P>
        {server === "down" ? (
          <P small>Start the backend on your computer, then check the address in Settings.</P>
        ) : null}
        {modelMissing ? <P small>This disease set is not loaded on the server. Pick another in Settings.</P> : null}
        <Row>
          <Button title="Retry" variant="secondary" onPress={check} style={{ flex: 1 }} />
          <Button title="Settings" variant="secondary" onPress={() => router.push("/settings")} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Button
        title="Start symptom check"
        onPress={() => router.push("/assess")}
        disabled={server !== "ok" || modelMissing}
      />

      <H2>How it works</H2>
      {STAGES.map((s) => (
        <Card key={s.n} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.primaryDark, fontWeight: "700" }}>{s.n}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: "600", color: colors.text, fontSize: 15 }}>{s.title}</Text>
            <P small muted>{s.text}</P>
          </View>
        </Card>
      ))}
      <Button title="Saved new-disease cases" variant="secondary" onPress={() => router.push("/flags")} />
      <Button title="About the model" variant="ghost" onPress={() => router.push("/model")} />
    </Screen>
  );
}
