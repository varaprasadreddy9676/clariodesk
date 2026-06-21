import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load root .env so DATABASE_URL is available when running from the monorepo
config({ path: "../../.env" });
config(); // also try cwd .env as fallback

export default defineConfig({
  // Point at compiled output: drizzle-kit's loader resolves the NodeNext `.js`
  // import specifiers there. Run `tsc --build` (or `npm run build`) first.
  schema: "./dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://clariodesk:clariodesk@localhost:5432/clariodesk",
  },
  strict: true,
  verbose: true,
});
