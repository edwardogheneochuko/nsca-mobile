import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DescribeBox } from "@/components/DescribeBox";
import { Button, Card, Chip, ErrorBox, Field, Loading, P, Row, Section, Screen, Wrap } from "@/components/ui";
import { api, ApiError, type ParseResult, type Question } from "@/lib/api";
import { shortLabel } from "@/lib/labels";
import { useSettings } from "@/lib/settings";
import { colors, font, radius, space } from "@/lib/theme";

const PAGE = 40;

function FollowUp({ q, value, onChange }: { q: Question; value: string[]; onChange: (v: string[]) => void }) {
  const [filter, setFilter] = useState("");
  const many = q.options.length > 14;
  const opts = many && filter
    ? q.options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : q.options;
  const shown = many && !filter ? opts.filter((o) => value.includes(o.value)).concat(
    opts.filter((o) => !value.includes(o.value)).slice(0, 14)) : opts;
  const toggle = (v: string) => {
    if (q.type === "multi") onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(value.includes(v) ? [] : [v]);
  };
  return (
    <View style={styles.follow}>
      <Text style={styles.followQ}>{q.text}</Text>
      <Text style={styles.followHint}>
        {q.type === "multi" ? "Choose all that apply" : q.type === "scale" ? "0 = none, 10 = worst" : "Choose one"}
        {" · optional"}
      </Text>
      {many ? <Field placeholder="Filter options" value={filter} onChangeText={setFilter} /> : null}
      <Wrap>
        {shown.map((o) => (
          <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </Wrap>
      {many && !filter && opts.length > shown.length ? (
        <Text style={styles.followHint}>{opts.length - shown.length} more — type to filter</Text>
      ) : null}
    </View>
  );
}

function QuestionRow({ q, on, onToggle, children }: { q: Question; on: boolean; onToggle: () => void;
  children?: React.ReactNode }) {
  return (
    <View style={[styles.qRow, on && styles.qRowOn]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        onPress={onToggle}
        style={({ pressed }) => [styles.qHead, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
        <Text style={styles.qText}>{q.text}</Text>
      </Pressable>
      {on && children ? <View style={{ gap: space.md, paddingLeft: 34 }}>{children}</View> : null}
    </View>
  );
}

function QuestionList({ questions, all, yes, toggle, answers, setAnswer, placeholder }: {
  questions: Question[]; all: Question[]; yes: Set<string>; toggle: (id: string) => void;
  answers: Record<string, string[]>; setAnswer: (id: string, v: string[]) => void; placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const children = useMemo(() => {
    const m: Record<string, Question[]> = {};
    for (const q of all) if (q.parent) (m[q.parent] ??= []).push(q);
    return m;
  }, [all]);
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    const list = t ? questions.filter((q) => q.text.toLowerCase().includes(t)) : questions;
    return [...list.filter((q) => yes.has(q.id) || (answers[q.id]?.length ?? 0) > 0),
      ...list.filter((q) => !(yes.has(q.id) || (answers[q.id]?.length ?? 0) > 0))];
  }, [query, questions, yes, answers]);
  return (
    <View style={{ gap: space.sm }}>
      <Field placeholder={placeholder} value={query} onChangeText={(t) => { setQuery(t); setLimit(PAGE); }}
        accessibilityLabel={placeholder} autoCorrect={false} />
      {matches.length === 0 ? <P small muted>No match. Try a simpler word, such as “pain” or “cough”.</P> : null}
      {matches.slice(0, limit).map((q) =>
        q.type === "yes_no" ? (
          <QuestionRow key={q.id} q={q} on={yes.has(q.id)} onToggle={() => toggle(q.id)}>
            {(children[q.id] ?? []).map((c) => (
              <FollowUp key={c.id} q={c} value={answers[c.id] ?? []} onChange={(v) => setAnswer(c.id, v)} />
            ))}
          </QuestionRow>
        ) : (
          <View key={q.id} style={styles.qRow}>
            <FollowUp q={q} value={answers[q.id] ?? []} onChange={(v) => setAnswer(q.id, v)} />
          </View>
        ),
      )}
      {matches.length > limit ? (
        <Button title={`Show more (${matches.length - limit} left)`} variant="ghost" onPress={() => setLimit(limit + PAGE)} />
      ) : null}
    </View>
  );
}

export default function Assess() {
  const router = useRouter();
  const { apiUrl, dataset, setLastResult } = useSettings();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yes, setYes] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [described, setDescribed] = useState("");
  const [parsedLog, setParsedLog] = useState<{ found: ParseResult["found"]; absent: ParseResult["absent"]; unrecognised: string[] }>(
    { found: [], absent: [], unrecognised: [] });

  const load = useCallback(() => {
    setError(null);
    setQuestions(null);
    api.questions(apiUrl, dataset).then(setQuestions).catch((e: Error) => setError(e.message));
  }, [apiUrl, dataset]);
  useEffect(load, [load]);

  const byId = useMemo(() => Object.fromEntries((questions ?? []).map((q) => [q.id, q])), [questions]);
  const symptomQs = useMemo(() => (questions ?? []).filter((q) => q.kind === "symptom" && !q.parent), [questions]);
  const riskQs = useMemo(() => (questions ?? []).filter((q) => q.kind === "risk_factor" && !q.parent), [questions]);

  const toggle = (id: string) => {
    const next = new Set(yes);
    if (next.has(id)) {
      next.delete(id);
      // clear follow-up answers of a question switched off
      setAnswers((a) => Object.fromEntries(Object.entries(a).filter(([k]) => byId[k]?.parent !== id)));
    } else next.add(id);
    setYes(next);
    setSubmitError(null);
  };
  const setAnswer = (id: string, v: string[]) => setAnswers((a) => ({ ...a, [id]: v }));

  // Free text: add what was understood (never removes ticks the user already made)
  const applyParsed = (r: ParseResult, text: string) => {
    setDescribed((d) => (d ? `${d}\n${text}` : text));
    setParsedLog((l) => ({ found: [...l.found, ...r.found], absent: [...l.absent, ...r.absent],
      unrecognised: [...l.unrecognised, ...r.unrecognised] }));
    setYes((cur) => new Set([...cur, ...r.symptoms]));
    setAnswers((a) => {
      const next = { ...a };
      for (const [q, vals] of Object.entries(r.answers)) next[q] = [...new Set([...(next[q] ?? []), ...vals])];
      return next;
    });
    setSubmitError(null);
  };

  const nSymptoms = symptomQs.filter((q) => yes.has(q.id)).length;
  const nRisk = riskQs.filter((q) => yes.has(q.id) || (answers[q.id]?.length ?? 0) > 0).length;

  const submit = async () => {
    const symptoms = [...yes, ...Object.values(answers).flat()];
    const labels = [...yes].map((id) => byId[id]?.text ?? id);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.identify(apiUrl, dataset, symptoms, described);
      // Stage 1 record: which phrase produced which symptom, what was negated or not understood
      const fromText = new Map(parsedLog.found.filter((f) => yes.has(f.question_id)).map((f) => [f.question_id, f.phrase]));
      const extracted = [...yes].map((id) => ({ phrase: fromText.get(id) ?? null, label: byId[id]?.text ?? id }));
      const absent = parsedLog.absent.map((a) => ({ phrase: a.phrase, label: a.question }));
      const defaults = result.filled_defaults.map((d) => {
        const [q, v] = d.split("=");
        const opt = byId[q]?.options.find((o) => o.value === d || o.value === v);
        const lab = opt?.label === "N" ? "No" : opt?.label === "Y" ? "Yes" : opt?.label ?? v;
        return byId[q] ? `${shortLabel(byId[q].text)} = ${lab}` : d;
      });
      setLastResult({ result, answers: symptoms, labels, text: described || undefined, extracted, absent,
        unrecognised: parsedLog.unrecognised, defaults });
      router.push("/result");
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setYes(new Set()); setAnswers({}); setDescribed(""); setParsedLog({ found: [], absent: [], unrecognised: [] }); setSubmitError(null); };

  if (error) return <Screen><ErrorBox message={error} onRetry={load} /></Screen>;
  if (!questions) return <Screen><Loading label="Loading questions…" /></Screen>;

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {submitError ? <Text style={{ color: colors.danger, fontSize: font.small }}>{submitError}</Text> : null}
          {nSymptoms > 0 && nSymptoms < 3 ? (
            <Text style={{ color: colors.warn, fontSize: font.small }}>
              Add more symptoms if you can — results with only one or two are less reliable.
            </Text>
          ) : null}
          <Row>
            <Button title="Clear" variant="secondary" onPress={reset} disabled={nSymptoms + nRisk === 0} />
            <Button
              title={nSymptoms === 0 ? "Select at least one symptom" : `Check ${nSymptoms} symptom${nSymptoms > 1 ? "s" : ""}`}
              onPress={submit}
              disabled={nSymptoms === 0}
              loading={submitting}
              style={{ flex: 1 }}
            />
          </Row>
        </View>
      }
    >
      <DescribeBox onApply={applyParsed} />

      <Card style={{ gap: space.xs }}>
        <P>Or tick every symptom you have now. Some symptoms ask a follow-up question; answer it if you can.</P>
        <P small muted>{symptomQs.length} symptoms available · {nSymptoms} selected</P>
      </Card>

      <QuestionList questions={symptomQs} all={questions} yes={yes} toggle={toggle} answers={answers}
        setAnswer={setAnswer} placeholder="Search symptoms, e.g. fever, cough, pain" />

      {riskQs.length > 0 ? (
        <Section title="Risk factors and history" subtitle={`Optional · ${nRisk} answered · improves accuracy`}>
          <QuestionList questions={riskQs} all={questions} yes={yes} toggle={toggle} answers={answers}
            setAnswer={setAnswer} placeholder="Search, e.g. smoke, travel, diabetes" />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qRow: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: space.md, gap: space.md,
  },
  qRowOn: { borderColor: colors.primary, backgroundColor: "#FBFEFD" },
  qHead: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 28 },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  qText: { flex: 1, fontSize: font.body, color: colors.text, lineHeight: 21 },
  follow: { gap: space.sm },
  followQ: { fontSize: font.small, fontWeight: "600", color: colors.text },
  followHint: { fontSize: 12, color: colors.textMuted },
});
