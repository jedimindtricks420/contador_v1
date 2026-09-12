import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  envDir: fileURLToPath(new URL("./", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 4177, strictPort: true, watch: null },
  plugins: [{
    name: "synthetic-api-only",
    configureServer(server) {
      server.middlewares.use("/v2/api", (_request, response) => {
        response.statusCode = 503;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "Synthetic API response must be provided by the browser test" }));
      });
    },
  }],
});