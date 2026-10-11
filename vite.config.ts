import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFile, cp, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = import.meta.dirname;
const rootId = createHash("sha256").update(root).digest("hex").slice(0, 24);
const health = (req: any, res: any, next: () => void) => {
  if (req.url?.split("?")[0] !== "/__tracefield") return next();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ app: "tracefield", rootId }));
};
const assetTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "preserved-scene-assets",
      configureServer(server) {
        server.middlewares.use(health);
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !/^\/(assets|scenes|fonts|library)\//.test(req.url))
            return next();
          try {
            const file = path.resolve(
              root,
              "public",
              "." +
                decodeURIComponent(
                  new URL(req.url, "http://localhost").pathname,
                ),
            );
            if (!file.startsWith(path.join(root, "public") + path.sep)) {
              res.statusCode = 403;
              res.end();
              return;
            }
            const bytes = await readFile(file);
            res.setHeader(
              "Content-Type",
              assetTypes[path.extname(file)] || "application/octet-stream",
            );
            res.end(bytes);
          } catch {
            res.statusCode = 404;
            res.end("Not found");
          }
        });
      },
      configurePreviewServer(server) { server.middlewares.use(health); },
      async closeBundle() {
        await mkdir(path.join(root, "dist"), { recursive: true });
        await cp(path.join(root,"THIRD_PARTY_NOTICES.md"),path.join(root,"dist/THIRD_PARTY_NOTICES.md"));
        for (const dir of ["assets", "scenes", "fonts", "library"])
          await cp(
            path.join(root, "public", dir),
            path.join(root, "dist", dir),
            { recursive: true },
          );
      },
    },
  ],
  build: {rolldownOptions:{input:{main:path.join(root,"index.html")},output:{codeSplitting:{groups:[{name:"react",test:/node_modules\/(react|react-dom|scheduler)\//},{name:"ui",test:/node_modules\/(radix-ui|@radix-ui)\//},{name:"motion",test:/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//}]}}}},
  publicDir: false,
  resolve: { alias: { "@": path.join(root, "src") } },
  server: { host: "127.0.0.1", port: 4318, strictPort: true },
  preview: { host: "127.0.0.1", port: 4318, strictPort: true },
});
