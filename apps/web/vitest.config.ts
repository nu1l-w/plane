import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./core", import.meta.url)),
      "@plane/hooks": fileURLToPath(new URL("../../packages/hooks/src/index.ts", import.meta.url)),
      "next/link": fileURLToPath(new URL("./app/compat/next/link.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./app/compat/next/navigation.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["core/**/*.test.ts"],
  },
});
