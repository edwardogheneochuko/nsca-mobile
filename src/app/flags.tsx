// Saved "possible new disease" cases: list, evidence and reviewer decision. Same screen on phone and web.
import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";

import { Badge, Button, Card, Chip, ErrorBox, Field, H2, KV, Loading, P, Row, Screen, Section, Wrap } from "@/components/ui";
import { api, ApiError, type FlagCase, type FlagList, type ReviewStatus } from "@/lib/api";
import { shortLabel } from "@/lib/labels";
import { DATASET_LABELS, useSettings } from "@/lib/settings";
import { colors, space } from "@/lib/theme";

const STATUS: Record<ReviewStatus, { label: string; tone: "new" | "known" | "warn" | "plain" }> = {
  pending_review: { label: "Awaiting review", tone: "warn" },
  confirmed_new: { label: "Confirmed new", tone: "new" },
  known_disease: { label: "Known disease", tone: "known" },
  dismissed: { label: "Dismissed", tone: "plain" },
};
const FILTERS: (ReviewStatus | "all")[] = ["all", "pending_review", "confirmed_new", "known_disease", "dismissed"];

function CaseCard({ c, onReviewed, onDeleted }: { c: FlagCase; onReviewed: (c: FlagCase) => void; onDeleted: () => void }) {
  const { apiUrl, dataset } = useSettings();
  const [note, setNote] = useState(c.review.note ?? "");
  const [disease, setDisease] = useState(c.review.disease ?? "");
  const [busy, setBusy] = useState<ReviewStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const st = STATUS[c.review.status];

  // Two taps: the first asks for confirmation (works the same on phone and web, no pop-up needed)
  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true); setErr(null);
    try {
      await api.deleteFlag(apiUrl, dataset, c.case_id);
      onDeleted();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
      setDeleting(false); setConfirmDelete(false);
    }
  };

  const review = async (status: ReviewStatus) => {
    if (status === "known_disease" && !disease.trim()) { setErr("Type the disease name first."); return; }
    setBusy(status); setErr(null);
    try {
      onReviewed(await api.reviewFlag(apiUrl, dataset, c.case_id, status, note, status === "known_disease" ? disease : undefined));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title={`${c.case_id} · ${c.created_at.replace("T", " ").slice(0, 16)}`}
      subtitle={`${st.label} · nearest known: ${c.nearest_known ?? "none"} · ${c.similar_cases.length} similar`}>
      <Row><Badge label={st.label} tone={st.tone} />
        {c.review.disease ? <P small>→ {c.review.disease}</P> : null}</Row>
      {c.free_text ? <P small>“{c.free_text}”</P> : null}

      <Text style={{ fontWeight: "600", color: colors.text }}>Symptoms</Text>
      <Wrap>{c.symptoms.map((s) => <Chip key={s} label={shortLabel(s)} tone="info" />)}</Wrap>
      <Text style={{ fontWeight: "600", color: colors.text }}>HPO terms</Text>
      <Wrap>{c.hpo_terms.map((h) => <Chip key={h.term} label={`${h.label} · ${h.term}`} tone="info" />)}</Wrap>

      <KV k="Stage 1 · nearest group" v={c.stage1.cluster_name ?? `#${c.stage1.cluster_id}`} />
      <KV k="Stage 1 · distance / radius" v={`${c.stage1.distance.toFixed(2)} / ${c.stage1.cluster_radius.toFixed(2)}${c.stage1.outlier ? " (outlier)" : ""}`} />
      <KV k="Stage 2 · explanation" v={c.stage2.reliable ? "Reliable" : "Unreliable"} />
      {c.stage2.unreliable_reasons.map((u) => <P small muted key={u}>• {u}</P>)}
      <Text style={{ fontWeight: "600", color: colors.text }}>Stage 3 · why each known disease was ruled out</Text>
      {c.candidates.map((k) => (
        <P small key={k.disease}>✗ {k.disease} ({Math.round(k.score * 100)}%): {k.failed_checks.join("; ") || "—"}</P>
      ))}
      {c.similar_cases.length > 0 ? (
        <P small>Similar saved cases: {c.similar_cases.map((s) => `${s.case_id} (${Math.round((1 - s.distance) * 100)}% overlap)`).join(", ")}</P>
      ) : null}

      <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
        <Text style={{ fontWeight: "600", color: colors.text }}>Reviewer decision</Text>
        <Field placeholder="Note (optional)" value={note} onChangeText={setNote} />
        <Field placeholder="Disease name, if it turned out to be a known one" value={disease} onChangeText={setDisease} />
        {err ? <P small style={{ color: colors.newFlag }}>{err}</P> : null}
        <Row style={{ flexWrap: "wrap" }}>
          <Button title="Confirm new" onPress={() => review("confirmed_new")} loading={busy === "confirmed_new"} style={{ flexGrow: 1 }} />
          <Button title="Known disease" variant="secondary" onPress={() => review("known_disease")} loading={busy === "known_disease"} style={{ flexGrow: 1 }} />
          <Button title="Dismiss" variant="secondary" onPress={() => review("dismissed")} loading={busy === "dismissed"} style={{ flexGrow: 1 }} />
          {c.review.status !== "pending_review" ? (
            <Button title="Reopen" variant="ghost" onPress={() => review("pending_review")} loading={busy === "pending_review"} />
          ) : null}
        </Row>
        <Row>
          <Button title={confirmDelete ? `Tap again to delete ${c.case_id}` : "Delete this case"} variant="secondary"
            onPress={remove} loading={deleting} style={{ flex: 1, borderColor: colors.danger }} />
          {confirmDelete && !deleting ? <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} /> : null}
        </Row>
      </View>
    </Section>
  );
}

export default function Flags() {
  const { apiUrl, dataset } = useSettings();
  const [data, setData] = useState<FlagList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [confirmAll, setConfirmAll] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.flags(apiUrl, dataset).then(setData).catch((e: Error) => setError(e.message));
  }, [apiUrl, dataset]);
  useEffect(load, [load]);

  if (error) return <Screen><ErrorBox message={error} onRetry={load} /></Screen>;
  if (!data) return <Screen><Loading label="Loading saved cases…" /></Screen>;

  const replace = () => load();
  // Delete every case shown under the current filter (two taps)
  const clearShown = async () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setClearing(true);
    try {
      await api.clearFlags(apiUrl, dataset, filter === "all" ? undefined : filter);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setClearing(false); setConfirmAll(false);
    }
  };
  const shown = data.cases.filter((c) => filter === "all" || c.review.status === filter);

  return (
    <Screen>
      <Card style={{ gap: space.sm }}>
        <H2>Possible new diseases</H2>
        <P small muted>
          {DATASET_LABELS[dataset].name}. Every patient whose symptoms matched no known disease is saved here with
          its evidence from all three stages, and stays saved when the server restarts.
        </P>
        <Row style={{ flexWrap: "wrap" }}>
          <KV k="Saved" v={data.counts.total} />
          <KV k="Awaiting review" v={data.counts.pending_review} />
          <KV k="Confirmed new" v={data.counts.confirmed_new} />
        </Row>
        <Row>
          <Button title="Refresh" variant="secondary" onPress={load} style={{ flex: 1 }} />
          <Button title="Download CSV" variant="secondary" style={{ flex: 1 }}
            onPress={() => Linking.openURL(api.flagsExportUrl(apiUrl, dataset))} />
        </Row>
        {shown.length > 0 ? (
          <Row>
            <Button
              title={confirmAll
                ? `Tap again to delete ${shown.length} case(s)`
                : filter === "all" ? "Delete all cases" : `Delete all "${STATUS[filter].label}" cases`}
              variant="secondary" onPress={clearShown} loading={clearing}
              style={{ flex: 1, borderColor: colors.danger }} />
            {confirmAll && !clearing ? <Button title="Cancel" variant="ghost" onPress={() => setConfirmAll(false)} /> : null}
          </Row>
        ) : null}
      </Card>

      {data.groups_of_similar_cases.length > 0 ? (
        <Card tone="new" style={{ gap: space.xs }}>
          <Text style={{ fontWeight: "600", color: colors.newFlag }}>Groups of similar cases</Text>
          <P small>Cases that share at least half their symptoms. A growing group is the strongest sign of a new disease.</P>
          {data.groups_of_similar_cases.map((g) => <P small key={g.join()}>• {g.length} cases: {g.join(", ")}</P>)}
        </Card>
      ) : null}

      <Wrap>
        {FILTERS.map((f) => (
          <Chip key={f} label={f === "all" ? `All (${data.counts.total})` : `${STATUS[f].label} (${data.counts[f]})`}
            selected={filter === f} onPress={() => { setFilter(f); setConfirmAll(false); }} />
        ))}
      </Wrap>

      {shown.length === 0 ? <P muted>No saved cases here yet.</P> :
        shown.map((c) => <CaseCard key={c.case_id} c={c} onReviewed={replace} onDeleted={load} />)}
    </Screen>
  );
}
