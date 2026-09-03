import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Aliasé par Next à la compilation, absent de node_modules : voir le stub.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Le serveur de production tourne en UTC : c'est là que les dates naïves
    // de l'ENT se décalent si le code les lit mal. On teste dans ce fuseau.
    env: { TZ: "UTC" },
  },
});
