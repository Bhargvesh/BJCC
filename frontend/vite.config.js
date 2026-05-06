import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Pre-bundle heavy deps so they are cached after first run
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
    ],
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8010",
      "/docs": "http://127.0.0.1:8010",
    },
    // Pre-transform the heaviest pages so first browser load is instant
    warmup: {
      clientFiles: [
        "./src/pages/IndiaInnovation.jsx",
        "./src/pages/CaseDetails.jsx",
        "./src/App.jsx",
      ],
    },
  },

});

