// Result screen, organised exactly like the flow chart. Each stage lists the tools it used; for every tool
// the screen says what the tool does (one line) and what it found for this patient.
//   Stage 1  Neural:          symptom extraction -> binary encoding -> ESOINN
//   Stage 2  XAI and fusion:  CART surrogate -> rule extraction, node difference, exemplars -> fused record
//   Stage 3  Symbolic:        HPO grounding -> candidates (top-k) -> consistency checks -> resolution
//   Conclusion
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Badge, Bar, Button, Card, Chip, H1, P, Row, Screen, Wrap } from "@/components/ui";
import type { Candidate, IdentifyResult, NodeDiffItem } from "@/lib/api";
import { shortLabel } from "@/lib/labels";
import { useSettings } from "@/lib/settings";
import { colors, font, radius, space } from "@/lib/theme";

const CONFIDENCE: Record<string, { label: string; tone: "known" | "warn" | "new" }> = {
  high: { label: "High confidence", tone: "known" },
  medium: { label: "Medium confidence", tone: "warn" },
  low: { label: "Low confidence", tone: "warn" },
  provisional: { label: "Provisional", tone: "new" },
};
const pct = (x: number) => `${Math.round(x * 100)}%`;

// Default and "No" answers (travel = N, pain = nowhere, intensity = 0 …) say little to a reader; hide them in explanations.
const FILLER = /= (N|0|nowhere|NA)$/i;
const meaningful = (items: NodeDiffItem[]) => items.filter((d) => !FILLER.test(d.meaning.trim()));
const list = (xs: string[], n = 4) =>
  xs.length === 0 ? "" : xs.length <= n ? xs.join(", ").replace(/, ([^,]*)$/, " and $1")
    : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`;

// ------------------------------------------------------------------ building blocks
function StageCard({ n, title, tools, children }: { n: string; title: string; tools: string; children: ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ alignItems: "flex-start", gap: space.md }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>{n}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: font.title, fontWeight: "700", color: colors.text }}>{title}</Text>
          <Text style={{ fontSize: font.small, color: colors.textMuted }}>{tools}</Text>
        </View>
      </Row>
      {children}
    </Card>
  );
}

/** One tool of the flow chart: its name, what it does in general, and what it found for this patient. */
function Tool({ name, does, children, last }: { name: string; does: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <View style={{ alignItems: "center", width: 12 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 }} />
        {last ? null : <View style={{ flex: 1, width: 2, backgroundColor: colors.primarySoft, marginTop: 2 }} />}
      </View>
      <View style={{ flex: 1, gap: 6, paddingBottom: last ? 0 : space.lg }}>
        <Text style={{ fontWeight: "700", color: colors.primaryDark, fontSize: font.body }}>{name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.small, fontStyle: "italic" }}>{does}</Text>
        {children}
      </View>
    </View>
  );
}

function Found({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.text, fontSize: font.small, lineHeight: 20 }}>{children}</Text>;
}
const B = ({ children }: { children: ReactNode }) => <Text style={{ fontWeight: "700" }}>{children}</Text>;

function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <View style={{ borderRadius: radius.md, padding: space.md, gap: 4,
      backgroundColor: ok ? colors.knownSoft : colors.newSoft, borderWidth: 1, borderColor: ok ? colors.known : colors.newFlag }}>
      {children}
    </View>
  );
}

function TRow({ left, right, mark, tone }: { left: string; right: string; mark: string; tone: "good" | "bad" | "muted" }) {
  const c = tone === "good" ? colors.known : tone === "bad" ? colors.newFlag : colors.textMuted;
  return (
    <View style={{ flexDirection: "row", gap: space.sm, paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ flex: 1, color: colors.textMuted, fontSize: font.small }}>{left}</Text>
      <Text style={{ flex: 1.3, color: colors.text, fontSize: font.small }}>
        <Text style={{ color: c, fontWeight: "700" }}>{mark} </Text>{right}
      </Text>
    </View>
  );
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "info" }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      <P small muted>{title}</P>
      <Wrap>{items.slice(0, 6).map((t) => <Chip key={t} label={t} tone={tone} />)}</Wrap>
    </View>
  );
}

/** Distance meter: where the patient sits against the group's normal limit. */
function FitMeter({ distance, radius: r }: { distance: number; radius: number }) {
  const scale = Math.max(distance, r) * 1.15;
  const ok = distance <= r;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(r / scale) * 100}%`, backgroundColor: colors.knownSoft }} />
        <View style={{ position: "absolute", left: `${(Math.min(distance, scale) / scale) * 100}%`, top: 0, bottom: 0, width: 4,
          marginLeft: -2, backgroundColor: ok ? colors.known : colors.newFlag }} />
      </View>
      <P small muted>Shaded = the group's normal range (95 % of its patients) · line = you</P>
    </View>
  );
}

function CheckLine({ c, cand }: { c: Candidate["checks"][number]; cand: Candidate }) {
  const text = {
    overall_match: `Overall match ${pct(c.value)} (needs at least ${pct(c.limit)})`,
    usual_symptoms: `${pct(c.value)} of its usual symptoms present (needs ${pct(c.limit)})`,
    nothing_against: c.passed ? "No symptom that rules it out"
      : `Ruled out by: ${cand.excluding_present.join(", ") || `${c.value} symptom(s)`}`,
    symptoms_explained: c.passed ? `Your symptoms are ones seen with it`
      : `${pct(c.value)} of your symptoms are never seen with it (at most ${pct(c.limit)} allowed)`,
  }[c.name];
  return <P small style={{ color: c.passed ? colors.known : colors.newFlag }}>{c.passed ? "✓" : "✗"} {text}</P>;
}

function CandidateBlock({ c, chosen }: { c: Candidate; chosen: boolean }) {
  const fits = [...(c.core_present ?? []), ...(c.typical_present ?? [])];
  return (
    <View style={{ gap: 6, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>{c.disease}</Text>
        {chosen ? <Badge label="Chosen" tone="known" /> :
          c.consistent ? <Badge label="Passed" tone="known" /> : <Badge label="Ruled out" tone="new" />}
      </Row>
      <Bar value={c.score} tone={c.consistent ? "known" : "new"} />
      {fits.length > 0 ? <P small>Fits because you have: {list(fits, 5)}</P> : null}
      {(c.checks ?? []).map((k) => <CheckLine key={k.name} c={k} cand={c} />)}
      {c.missing_core_symptoms.length > 0
        ? <P small muted>Its usual symptoms you did not report: {list(c.missing_core_symptoms, 4)}</P> : null}
    </View>
  );
}

function cleanRule(text: string): { shown: string[]; hidden: number } {
  const body = text.replace(/^IF\s+/, "").replace(/\s+THEN.*$/, "");
  const parts = body.split(/\s+AND\s+/);
  let hidden = 0;
  const pos: string[] = [];
  const neg: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+) other symptoms absent$/);
    if (m) { hidden += Number(m[1]); continue; }
    if (p.startsWith("NOT ")) neg.push(shortLabel(p.slice(4)));
    else if (FILLER.test(p)) hidden += 1;
    else pos.push(shortLabel(p));
  }
  const shown = [...pos, ...neg.slice(0, 3).map((n) => `NOT ${n}`)];
  return { shown, hidden: hidden + Math.max(0, neg.length - 3) };
}

function plainReason(r: string, fidelity: number): string {
  if (r.startsWith("CART predicts")) return "The decision tree and ESOINN put you in different groups, so the explanation does not match the AI's decision.";
  if (r.startsWith("surrogate fidelity")) return `The decision tree copies ESOINN only ${pct(fidelity)} of the time, below the 90 % needed to trust it.`;
  if (r.includes("radius")) return "You lie outside the group's normal range (ESOINN outlier), so the group may be the wrong one.";
  return r;
}

function conclusion(r: IdentifyResult): { short: string; next: string[] } {
  const s = r.stages!;
  const rec = s.stage2_fused_record;
  const group = s.stage1_neural.cluster_name ?? `group ${s.stage1_neural.cluster_id}`;
  const cands = s.stage3_symbolic.candidates;
  if (r.outcome === "flag_as_new") {
    return {
      short: `ESOINN ${s.stage1_neural.outlier ? `could not fit you into any known group (nearest: ${group})` : `placed you nearest the ${group} group`}` +
        `${rec.reliable ? "" : ", and the fused record marked that grouping as not trustworthy"}. ` +
        `Grounded in HPO, your symptoms were tested against ${list(cands.map((c) => c.disease), 3)}, and none passed the consistency checks. ` +
        `The resolution step therefore flagged a possible new disease.`,
      next: [
        r.flag ? `Saved as case ${r.flag.case_id} with all the evidence above, for a reviewer to check.` : "The case was not saved.",
        r.flag && r.flag.similar_cases.length > 0
          ? `It is linked to ${r.flag.similar_cases.length} earlier case(s) with a similar pattern; a growing group is the strongest sign of a new disease.`
          : "If more patients with this pattern appear, they will be grouped with it.",
        "A flag is not a diagnosis. Please see a health worker.",
      ],
    };
  }
  const why = s.stage3_symbolic.candidates.find((c) => c.disease === r.disease);
  const fits = why ? [...(why.core_present ?? []), ...(why.typical_present ?? [])] : [];
  const lead = r.confidence === "high"
    ? `All three stages agree. ESOINN placed you in the ${group} group, the fused record found that explanation reliable, and ${r.disease} passed every HPO consistency check.`
    : r.confidence === "medium"
      ? `ESOINN's grouping was reliable, but its usual disease (${group}) failed the HPO checks. ${r.disease} was the best candidate that passed them.`
      : `ESOINN placed you nearest the ${group} group, but the fused record marked that as unreliable, so it was set aside. ${r.disease} was chosen because it passed every HPO consistency check on its own.`;
  return {
    short: `${lead}${fits.length ? ` Your ${list(fits, 4)} fit it.` : ""}`,
    next: [
      r.confidence === "high" ? "Confidence is high because the neural, explanation and symbolic stages all agree."
        : "Confidence is lower because the stages did not fully agree. Answering the history and risk-factor questions usually helps.",
      why && why.missing_core_symptoms.length ? `A health worker may ask about: ${list(why.missing_core_symptoms, 4)}.` : "",
      "This is not a medical diagnosis. Please see a health worker.",
    ].filter(Boolean),
  };
}

// ------------------------------------------------------------------ screen
export default function Result() {
  const router = useRouter();
  const { lastResult } = useSettings();
  const [showDefaults, setShowDefaults] = useState(false);

  if (!lastResult) {
    return (
      <Screen>
        <P>No result yet.</P>
        <Button title="Start symptom check" onPress={() => router.replace("/assess")} />
      </Screen>
    );
  }
  const { result: r } = lastResult;
  const s = r.stages!;
  const s1 = s.stage1_neural as typeof s.stage1_neural & { features_total?: number; features_present?: number;
    network_nodes?: number; network_clusters?: number };
  const rec = s.stage2_fused_record;
  const s3 = s.stage3_symbolic;
  const isNew = r.outcome === "flag_as_new";
  const conf = CONFIDENCE[r.confidence] ?? { label: r.confidence, tone: "warn" as const };
  const extracted = lastResult.extracted ?? lastResult.labels.map((l) => ({ phrase: null, label: l }));
  const defaults = lastResult.defaults ?? [];
  const group = s1.cluster_name ?? `group ${s1.cluster_id}`;
  const cartGroup = rec.cart_cluster === rec.cluster_id ? group : `group ${rec.cart_cluster}`;
  const rule = cleanRule(rec.rule.text);
  const sup = meaningful(rec.node_difference.supporting).map((d) => shortLabel(d.meaning));
  const unexp = meaningful(rec.node_difference.unexpected).map((d) => shortLabel(d.meaning));
  const miss = meaningful(rec.node_difference.expected_but_missing).map((d) => shortLabel(d.meaning));
  const hinted = s3.candidates.some((c) => c.source !== "ontology top-k");
  const end = conclusion(r);
  const rows = [
    { key: "high", when: "Record reliable and ESOINN's disease passes", gives: "That disease, high confidence" },
    { key: "medium", when: "Record reliable but ESOINN's disease fails", gives: "Best passing candidate, medium confidence" },
    { key: "low", when: "Record unreliable, a candidate passes", gives: "Best passing candidate, low confidence" },
    { key: "provisional", when: "No candidate passes", gives: "Flag as possible new disease" },
  ];

  return (
    <Screen
      footer={
        <Row>
          <Button title="Edit symptoms" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="New check" onPress={() => router.replace("/")} style={{ flex: 1 }} />
        </Row>
      }
    >
      {/* ---------- headline */}
      <Card tone={isNew ? "new" : "known"} style={{ gap: space.sm }}>
        <Text style={{ fontSize: font.small, fontWeight: "700", color: isNew ? colors.newFlag : colors.known }}>
          {isNew ? "⚠ POSSIBLE NEW DISEASE" : "CLOSEST KNOWN DISEASE"}
        </Text>
        <H1>{isNew ? "Does not match any known disease" : r.disease}</H1>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge label={conf.label} tone={conf.tone} />
          {isNew && r.flag ? <Badge label={`Saved · ${r.flag.case_id}`} tone="new" /> : null}
        </Row>
      </Card>

      {/* ---------- Stage 1 */}
      <StageCard n="1" title="Stage 1 · Neural" tools="Symptom extraction → Binary encoding → ESOINN">
        <Tool name="Symptom extraction (text parser)"
          does="Reads what you typed using HPO names and synonyms plus everyday and Nigerian English, detects 'no …' and spelling errors.">
          {lastResult.text ? <Found>You wrote: “{lastResult.text}”</Found> : null}
          <View>
            {extracted.map((e) => <TRow key={e.label} left={e.phrase ?? "(ticked)"} right={shortLabel(e.label)} mark="✔" tone="good" />)}
            {(lastResult.absent ?? []).map((a) => <TRow key={`a-${a.phrase}`} left={a.phrase} right={`${shortLabel(a.label)}, absent`} mark="✘" tone="bad" />)}
            {(lastResult.unrecognised ?? []).map((u) => <TRow key={`u-${u}`} left={u} right="Not recognised" mark="⚠" tone="muted" />)}
          </View>
          {defaults.length > 0 ? (
            <Pressable onPress={() => setShowDefaults(!showDefaults)}>
              <P small muted>{showDefaults ? "▾" : "▸"} {defaults.length} unanswered follow-up question(s) filled with their usual answer{showDefaults ? ":" : " (tap to see)"}</P>
              {showDefaults ? defaults.map((d) => <P small muted key={d}>   • {d}</P>) : null}
            </Pressable>
          ) : null}
        </Tool>

        <Tool name="Binary encoding"
          does="Turns your answers into a row of 1s (yes) and 0s (no), one position per question in the dataset.">
          <Found>
            {s1.features_total
              ? <>Your row has <B>{s1.features_total}</B> positions, <B>{s1.features_present}</B> of them set to 1.</>
              : <>{extracted.length + defaults.length} answers set to 1, all others 0.</>}
          </Found>
        </Tool>

        <Tool name="ESOINN (Enhanced Self-Organising Incremental Neural Network)" last
          does="Unsupervised network that grouped past patients without being told the diseases. Finds the prototype nearest to you (Jaccard distance) and checks you are within that group's normal range.">
          <Found>
            {s1.network_nodes ? <>The trained network has {s1.network_nodes} prototypes in {s1.network_clusters} groups. </> : null}
            Your nearest prototype is node {s1.winner_node}, in a group made up mostly of <B>{group}</B> patients.
          </Found>
          <Found>Distance <B>{s1.distance.toFixed(2)}</B> · group's normal limit <B>{s1.cluster_radius.toFixed(2)}</B></Found>
          <FitMeter distance={s1.distance} radius={s1.cluster_radius} />
          <Verdict ok={!s1.outlier}>
            <P small style={{ fontWeight: "700" }}>{s1.outlier ? "Outlier: you do not fit this group well" : "You fit this group"}</P>
            <P small>{s1.outlier ? "An early sign the disease may be unknown, or that too few answers were given." : "Passed to Stage 2 to be explained."}</P>
          </Verdict>
        </Tool>
      </StageCard>

      {/* ---------- Stage 2 */}
      <StageCard n="2" title="Stage 2 · XAI and fusion" tools="CART surrogate → Rule extraction · Node difference · Exemplars → Fused record">
        <Tool name="CART surrogate (decision tree)"
          does="A decision tree trained to copy ESOINN's grouping, so the grouping can be read as rules. Fidelity = how often it agrees with ESOINN on unseen patients.">
          <Found>Fidelity <B>{pct(rec.fidelity)}</B> ({rec.fidelity >= 0.9 ? "above" : "below"} the 90 % needed).
            For you the tree says <B>{cartGroup}</B>, ESOINN says <B>{group}</B>: {rec.agreement ? "they agree ✓" : "they disagree ✗"}.</Found>
        </Tool>

        <Tool name="Rule extraction"
          does="Reads your path through the tree as an IF … THEN rule.">
          <Found>IF {rule.shown.join(" AND ") || "(only default answers)"}{rule.hidden > 0 ? ` AND ${rule.hidden} other condition(s)` : ""} THEN <B>{group} group</B></Found>
        </Tool>

        <Tool name="Node difference"
          does="Compares your answers with the typical patient of the group (ESOINN's prototype), symptom by symptom.">
          {sup.length + unexp.length + miss.length === 0 ? <Found>No meaningful differences to show.</Found> : null}
          <Chips title="You have, and it is typical of the group" items={sup} tone="good" />
          <Chips title="You have, but it is unusual for the group" items={unexp} tone="bad" />
          <Chips title="Typical of the group, but you do not have it" items={miss} tone="info" />
        </Tool>

        <Tool name="Exemplars (k-medoids)"
          does="Real past patients picked as the most representative of the group; the ones closest to you are shown.">
          {rec.exemplars.length === 0 ? <Found>None available.</Found> : rec.exemplars.slice(0, 2).map((e) => {
            const shared = e.shared_with_patient.filter((x) => !FILLER.test(x)).map(shortLabel);
            return <Found key={e.train_index}>• A <B>{e.diagnosis ?? "unknown"}</B> patient, {pct(1 - e.distance)} similar{shared.length ? `, sharing ${list(shared, 3)}` : ""}.</Found>;
          })}
        </Tool>

        <Tool name="Fused explanation record" last
          does="Combines the four results above and decides whether the explanation can be trusted: the tree must agree with ESOINN, fidelity must be at least 90 %, and you must not be an outlier.">
          <Verdict ok={rec.reliable}>
            <P small style={{ fontWeight: "700" }}>{rec.reliable ? "Reliable explanation" : "Unreliable explanation"}</P>
            {rec.reliable
              ? <P small>All three conditions hold, so the {group} group is passed to Stage 3 as a hint.</P>
              : <>
                  {rec.unreliable_reasons.map((u) => <P small key={u}>• {plainReason(u, rec.fidelity)}</P>)}
                  <P small>So Stage 3 ignores the group and checks every disease on its own.</P>
                </>}
          </Verdict>
        </Tool>
      </StageCard>

      {/* ---------- Stage 3 */}
      <StageCard n="3" title="Stage 3 · Symbolic reasoning" tools="Grounding (HPO) → Candidates (top-k) → Consistency → Resolution">
        <Tool name="Grounding (Human Phenotype Ontology)"
          does={`Translates each symptom into a standard medical term and ID from the HPO${s3.hpo_release ? ` (release ${s3.hpo_release.replace(/^.*releases\//, "")})` : ""}.`}>
          <Wrap>{s3.grounding.map((g) => (
            <Chip key={g.term} label={g.term.startsWith("HP:") ? `${g.label} · ${g.term}` : g.label} tone="info" />
          ))}</Wrap>
        </Tool>

        <Tool name="Candidates (top-k)"
          does="Scores every known disease by how well its profile matches your HPO terms (related terms get half credit) and keeps the best 3.">
          <Found>
            Top {s3.candidates.length}: {s3.candidates.map((c) => `${c.disease} (${c.score.toFixed(2)})`).join(", ")}.
            {hinted ? ` ${group} was added because the Stage 2 record is reliable.` : ""}
          </Found>
        </Tool>

        <Tool name="Consistency (exclusion rules)"
          does="Each candidate must pass four checks, with limits set on known patients: strong overall match, enough of its usual symptoms, nothing that rules it out, and few symptoms never seen with it.">
          {s3.candidates.map((c) => <CandidateBlock key={c.disease} c={c} chosen={!isNew && c.disease === r.disease} />)}
        </Tool>

        <Tool name="Resolution" last
          does="Combines the checks with the Stage 2 reliability to give the final answer.">
          <View>
            {rows.map((row) => {
              const on = row.key === r.confidence;
              return (
                <View key={row.key} style={{ flexDirection: "row", gap: space.sm, padding: 6, borderRadius: radius.sm,
                  backgroundColor: on ? (isNew ? colors.newSoft : colors.knownSoft) : "transparent" }}>
                  <Text style={{ flex: 1, fontSize: font.small, color: on ? colors.text : colors.textFaint, fontWeight: on ? "700" : "400" }}>{on ? "▶ " : ""}{row.when}</Text>
                  <Text style={{ flex: 1, fontSize: font.small, color: on ? colors.text : colors.textFaint, fontWeight: on ? "700" : "400" }}>{row.gives}</Text>
                </View>
              );
            })}
          </View>
          <Verdict ok={!isNew}>
            <P small style={{ fontWeight: "700" }}>
              OUTPUT: {isNew ? "Possible new disease (provisional)" : `${r.disease} · ${conf.label.toLowerCase()}`}
            </P>
          </Verdict>
          {isNew && r.flag ? (
            <View style={{ gap: space.sm }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>Saved for review</Text>
                <Badge label={r.flag.case_id} tone="new" />
              </Row>
              <P small>{r.flag.saved
                ? "Saved with all the evidence above. It stays saved when the server restarts."
                : "These symptoms were saved a few minutes ago, so the existing case was kept."}</P>
              {r.flag.similar_cases.length > 0
                ? <P small>Linked to {r.flag.similar_cases.length} similar saved case(s): {r.flag.similar_cases.slice(0, 3).map((c) => c.case_id).join(", ")}.</P>
                : null}
              <Button title="View saved cases" variant="secondary" onPress={() => router.push("/flags")} />
            </View>
          ) : null}
        </Tool>
      </StageCard>

      {/* ---------- Conclusion */}
      <Card style={{ gap: space.sm, borderColor: colors.primary }}>
        <Text style={{ fontSize: font.title, fontWeight: "700", color: colors.text }}>Conclusion</Text>
        <P small>{end.short}</P>
        {end.next.map((n) => <P small key={n}>• {n}</P>)}
      </Card>
    </Screen>
  );
}
