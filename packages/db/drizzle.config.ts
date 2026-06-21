import { defineConfig } from "drizzle-kit";

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
