import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to create a .env file at the repo root?");
}

export default defineConfig({
  schema: "./src/schema/fixora.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
