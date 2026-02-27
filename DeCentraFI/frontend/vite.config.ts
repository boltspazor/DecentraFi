import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    pool: "vmThreads",
    server: {
      deps: {
        inline: ["@csstools/css-calc", "@asamuzakjp/css-color"],
      },
    },
    coverage: { provider: "v8", reporter: ["text", "json", "html"], exclude: ["node_modules/", "src/test/"] },
  },
});
