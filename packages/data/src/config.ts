export type DbConfig = {
  url: string | undefined;
  maxPool: number;
  debug: boolean;
};

// Read lazily so importing the package never requires env vars (typecheck,
// builds, and client-safe entry points don't touch the database).
export const getDbConfig = (): DbConfig => ({
  url: process.env.DATABASE_URL,
  maxPool: Number(process.env.DATABASE_MAX_POOL) || 10,
  debug: process.env.DB_DEBUG === "true",
});
