import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Card, ErrorBox, H2, KV, Loading, P, Screen, Section } from "@/components/ui";
import { api, type ClusterInfo, type ModelStatus } from "@/lib/api";
import { DATASET_LABELS, useSettings } from "@/lib/settings";
import { colors, space } from "@/lib/theme";

export default function Model() {
  const { apiUrl, dataset } = useSettings();
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [clusters, setClusters] = useState<ClusterInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.status(apiUrl, dataset), api.clusters(apiUrl, dataset)])
      .then(([s, c]) => { setStatus(s); setClusters(c); })
      .catch((e: Error) => setError(e.message));
  }, [apiUrl, dataset]);
  useEffect(load, [load]);

  if (error) return <Screen><ErrorBox message={error} onRetry={load} /></Screen>;
  if (!status || !clusters) return <Screen><Loading label="Loading model details…" /></Screen>;

  const s1 = status.stage1_esoinn;
  return (
    <Screen>
      <Card>
        <H2>{DATASET_LABELS[dataset].name}</H2>
        <P small muted>{DATASET_LABELS[dataset].note}</P>
        <KV k="Trained" v={status.trained_at.replace("T", " ")} />
        <KV k="Known diseases" v={status.stage3.known_diseases} />
        <KV k="Saved possible-new cases" v={`${status.flagged_cases.total} (${status.flagged_cases.pending_review} awaiting review)`} />
      </Card>

      <Section title="Stage 1 · ESOINN" subtitle={`${s1.clusters} patient groups from ${s1.samples_seen.toLocaleString()} patients`} initiallyOpen>
        <KV k="Nodes" v={s1.nodes} />
        <KV k="Edges" v={s1.edges} />
        <KV k="Patient groups (clusters)" v={s1.clusters} />
        <KV k="Patients in noise buffer" v={s1.noise_buffer_patients} />
        {Object.entries(s1.params).map(([k, v]) => <KV key={k} k={`Parameter ${k}`} v={String(v)} />)}
      </Section>

      <Section title="Stage 2 · Explanation" subtitle={`Surrogate fidelity ${Math.round(status.stage2_surrogate.fidelity * 100)}%`}>
        <KV k="Decision-tree leaves (rules)" v={status.stage2_surrogate.leaves} />
        <KV k="Fidelity to ESOINN" v={status.stage2_surrogate.fidelity.toFixed(3)} />
        <P small muted>
          {status.stage2_surrogate.fidelity < 0.9
            ? "Below the 0.90 threshold, so every explanation record is marked unreliable and decisions rest on the ontology checks."
            : "Above the 0.90 threshold."}
        </P>
      </Section>

      <Section title="Stage 3 · Symbolic reasoning" subtitle={`HPO ${status.stage3.hpo_release.replace("hp/releases/", "")}`}>
        <KV k="Symptoms mapped to HPO" v={`${status.stage3.grounded_symptoms} of ${status.stage3.symptom_columns}`} />
        <KV k="Candidates examined" v={`top ${status.stage3.top_k}`} />
        {Object.entries(status.stage3.thresholds).map(([k, v]) => <KV key={k} k={k.replace(/_/g, " ")} v={String(v)} />)}
      </Section>

      <Section title="Patient groups" subtitle={`${clusters.length} groups with their strongest rule`}>
        {clusters.map((c) => (
          <View key={c.cluster_id} style={{ gap: 2, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>
              Group {c.cluster_id}{c.name ? ` · mostly ${c.name}` : ""}
            </Text>
            <P small muted>{c.training_patients} training patients</P>
            {c.rules[0] ? <P small>{c.rules[0].text}</P> : null}
          </View>
        ))}
      </Section>
    </Screen>
  );
}
