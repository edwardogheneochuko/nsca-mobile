import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SettingsProvider } from "@/lib/settings";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SettingsProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primaryDark,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "NSCA Disease Check" }} />
        <Stack.Screen name="assess" options={{ title: "Symptoms" }} />
        <Stack.Screen name="result" options={{ title: "Result" }} />
        <Stack.Screen name="flags" options={{ title: "Saved new-disease cases" }} />
        <Stack.Screen name="model" options={{ title: "About the model" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </SettingsProvider>
  );
}
