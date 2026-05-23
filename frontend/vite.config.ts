import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      "/api": process.env.VITE_API_URL || "http://localhost:3301",
      "/health": process.env.VITE_API_URL || "http://localhost:3301",
      "/mcp": process.env.VITE_API_URL || "http://localhost:3301",
      "/metrics": process.env.VITE_API_URL || "http://localhost:3301",
    },
  },
  build: {
    outDir: "dist",
  },
});
