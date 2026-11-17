import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Badge, Button, Card, Field, P, Row, Screen } from "@/components/ui";
import { api, type Dataset } from "@/lib/api";
import { DATASET_LABELS, defaultApiUrl, useSettings } from "@/lib/settings";
import { colors, radius, space } from "@/lib/theme";

export default function Settings() {
  const { apiUrl, setApiUrl, dataset, setDataset } = useSettings();
  const [url, setUrl] = useState(apiUrl);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setTest(null);
    try {
      const h = await api.health(url);
      setApiUrl(url);
      setTest({ ok: true, msg: `Connected. Loaded: ${h.models_loaded.join(", ")}` });
    } catch (e) {
      setTest({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card style={{ gap: space.md }}>
        <Field label="Backend address" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false}
          keyboardType="url" placeholder="http://192.168.0.10:8000" />
        <P small muted>
          On a phone, use your computer’s address on the same Wi-Fi (run ipconfig on Windows), and start the backend
          with --host 0.0.0.0.
        </P>
        <Row>
          <Button title="Save and test" onPress={save} loading={busy} style={{ flex: 1 }} />
          <Button title="Reset" variant="secondary" onPress={() => setUrl(defaultApiUrl())} />
        </Row>
        {test ? (
          <View style={{ gap: space.xs }}>
            <Badge label={test.ok ? "Connected" : "Failed"} tone={test.ok ? "known" : "new"} />
            <P small>{test.msg}</P>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={{ fontWeight: "600", color: colors.text }}>Disease set</Text>
        {(Object.keys(DATASET_LABELS) as Dataset[]).map((d) => (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityState={{ checked: dataset === d }}
            onPress={() => setDataset(d)}
            style={({ pressed }) => ({
              borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2,
              borderColor: dataset === d ? colors.primary : colors.border,
              backgroundColor: dataset === d ? colors.primarySoft : colors.surface, opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontWeight: "600", color: colors.text }}>{DATASET_LABELS[d].name}</Text>
            <P small muted>{DATASET_LABELS[d].note}</P>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
