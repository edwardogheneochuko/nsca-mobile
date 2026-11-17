// Small shared UI kit. Plain React Native components, so they render the same on phone and web.
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";

import { colors, font, MAX_WIDTH, radius, space } from "@/lib/theme";

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={styles.footerWrap}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>;
  tone?: "known" | "new" | "warn" | "plain" }) {
  const t = tone === "known" ? { backgroundColor: colors.knownSoft, borderColor: colors.known }
    : tone === "new" ? { backgroundColor: colors.newSoft, borderColor: colors.newFlag }
    : tone === "warn" ? { backgroundColor: colors.warnSoft, borderColor: colors.warn } : null;
  return <View style={[styles.card, t, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1} accessibilityRole="header">{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2} accessibilityRole="header">{children}</Text>;
}
export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean;
  style?: StyleProp<any> }) {
  return (
    <Text style={[styles.p, muted && { color: colors.textMuted }, small && { fontSize: font.small }, style]}>
      {children}
    </Text>
  );
}

export function Button({ title, onPress, variant = "primary", disabled, loading, style }: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = variant === "primary" ? styles.btnPrimary : variant === "secondary" ? styles.btnSecondary : styles.btnGhost;
  const tc = variant === "primary" ? "#fff" : colors.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, v, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={tc} /> : <Text style={[styles.btnText, { color: tc }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tone }: { label: string; selected?: boolean; onPress?: () => void;
  tone?: "plain" | "good" | "bad" | "info" }) {
  const toneStyle = tone === "good" ? { backgroundColor: colors.knownSoft, borderColor: colors.known }
    : tone === "bad" ? { backgroundColor: colors.newSoft, borderColor: colors.newFlag }
    : tone === "info" ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border } : null;
  const content = (
    <Text style={[styles.chipText, selected && { color: "#fff" }]} numberOfLines={2}>{label}</Text>
  );
  if (!onPress) return <View style={[styles.chip, toneStyle]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      {content}
    </Pressable>
  );
}

export function Badge({ label, tone = "plain" }: { label: string; tone?: "known" | "new" | "warn" | "plain" }) {
  const bg = tone === "known" ? colors.known : tone === "new" ? colors.newFlag : tone === "warn" ? colors.warn : colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function Section({ title, subtitle, children, initiallyOpen = false }: {
  title: string; subtitle?: string; children: ReactNode; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card style={{ padding: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.sectionHead, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.chev}>{open ? "–" : "+"}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </Card>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.textFaint} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: space.sm }, style]}>{children}</View>;
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={styles.kvV}>{v}</Text>
    </View>
  );
}

export function Bar({ value, tone = "known" }: { value: number; tone?: "known" | "new" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.barTrack} accessibilityLabel={`${Math.round(pct)} percent`}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: tone === "known" ? colors.known : colors.newFlag }]} />
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: "center", gap: space.md }}>
      <ActivityIndicator color={colors.primary} />
      <P muted>{label}</P>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="new" style={{ gap: space.sm }}>
      <Text style={[styles.p, { color: colors.newFlag, fontWeight: "600" }]}>Something went wrong</Text>
      <P>{message}</P>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: 120 },
  column: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", gap: space.md },
  footerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, gap: space.sm,
  },
  h1: { fontSize: font.h1, fontWeight: "700", color: colors.text, lineHeight: 32 },
  h2: { fontSize: font.h2, fontWeight: "600", color: colors.text, lineHeight: 26 },
  p: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  btn: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { fontSize: font.body, fontWeight: "600" },
  chip: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
    paddingHorizontal: space.md, paddingVertical: 7, maxWidth: "100%",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.small, color: colors.text },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  sectionHead: { flexDirection: "row", alignItems: "center", padding: space.lg, gap: space.md, borderRadius: radius.lg },
  sectionTitle: { fontSize: font.title, fontWeight: "600", color: colors.text },
  sectionSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  sectionBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  chev: { fontSize: 22, color: colors.textMuted, width: 20, textAlign: "center" },
  label: { fontSize: font.small, color: colors.textMuted, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.body, color: colors.text,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: 4 },
  kvK: { fontSize: font.small, color: colors.textMuted, flexShrink: 1 },
  kvV: { fontSize: font.small, color: colors.text, fontWeight: "600", textAlign: "right", flexShrink: 1 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});
