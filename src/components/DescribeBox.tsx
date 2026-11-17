// "Describe how you feel": free text -> ticked questions, shown back to the user before anything is checked.
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Field, P } from "@/components/ui";
import { api, type ParseResult } from "@/lib/api";
import { shortLabel } from "@/lib/labels";
import { useSettings } from "@/lib/settings";
import { colors, font, space } from "@/lib/theme";

export function DescribeBox({ onApply }: { onApply: (r: ParseResult, text: string) => void }) {
  const { apiUrl, dataset } = useSettings();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.parseText(apiUrl, dataset, text);
      setResult(r);
      onApply(r, text.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <Text style={{ fontWeight: "600", color: colors.text, fontSize: font.title }}>Describe how you feel</Text>
      <Field
        multiline
        value={text}
        onChangeText={(t) => { setText(t); setError(null); }}
        placeholder={"e.g. I have fever, cough and catarrh but no sore throat"}
        accessibilityLabel="Describe your symptoms in your own words"
        style={{ minHeight: 80, textAlignVertical: "top" }}
      />
      <Button title="Find my symptoms" onPress={run} loading={busy} disabled={!text.trim()} />
      {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}

      {result ? (
        <View style={{ gap: space.sm }}>
          {result.found.length === 0 && result.absent.length === 0 ? (
            <P small>No symptom recognised. Try simpler words, or tick them in the list below.</P>
          ) : null}
          {result.found.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: font.small, fontWeight: "600", color: colors.known }}>
                Understood and ticked below ({result.found.length})
              </Text>
              {result.found.map((f) => (
                <View key={f.question_id} style={{ gap: 1 }}>
                  <P small>✓ “{f.phrase}” → {shortLabel(f.question)}</P>
                  {f.note ? <P small muted style={{ paddingLeft: 14 }}>{f.note}</P> : null}
                </View>
              ))}
            </View>
          ) : null}
          {result.absent.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: font.small, fontWeight: "600", color: colors.textMuted }}>Noted as not present</Text>
              {result.absent.map((f) => <P small muted key={`n-${f.question_id}`}>✗ {shortLabel(f.question)}</P>)}
            </View>
          ) : null}
          {result.unrecognised.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: font.small, fontWeight: "600", color: colors.warn }}>Not recognised</Text>
              {result.unrecognised.map((u) => <P small key={`u-${u}`}>? “{u}” — search for it in the list below</P>)}
            </View>
          ) : null}
          <P small muted>Check the ticks below and change anything that is wrong before you continue.</P>
        </View>
      ) : null}
    </Card>
  );
}
