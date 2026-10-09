import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.slate.whiteboard",
  appName: "Slate",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
};

export default config;
