import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/de-sim/",
  build: { target: "esnext" },
  worker: { format: "es" },
  server: { port: 4173 },
  preview: { port: 4173 },
});
