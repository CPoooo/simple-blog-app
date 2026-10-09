import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let _db: Db | undefined;

// Lazy so `next build` and tooling work before DATABASE_URL exists.
export function getDb(): Db {
  return (_db ??= createDb());
}

export * from "./schema";
