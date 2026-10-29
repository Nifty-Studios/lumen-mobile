// The app's data layer: @lumen/shared/client over expo-sqlite. The sync API keeps each
// batch atomic on the JS thread, so nothing else can interleave with a transaction.

import { openDatabaseSync, type SQLiteBindValue } from "expo-sqlite";
import { createLumen, type QueryMethod, type SqlDriver } from "@lumen/shared/client";

const sqlite = openDatabaseSync("lumen.db");
sqlite.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

function run(sql: string, params: unknown[], method: QueryMethod): unknown[] {
  const stmt = sqlite.prepareSync(sql);
  try {
    const bind = params as SQLiteBindValue[];
    if (method === "run") {
      stmt.executeSync(bind);
      return [];
    }
    const rows = stmt.executeForRawResultSync(bind).getAllSync();
    return method === "get" ? (rows[0] ?? []) : rows;
  } finally {
    stmt.finalizeSync();
  }
}

const driver: SqlDriver = {
  query: async (sql, params, method) => run(sql, params, method),
  batch: async (queries) => {
    let out: unknown[][] = [];
    sqlite.withTransactionSync(() => {
      out = queries.map((q) => run(q.sql, q.params, q.method));
    });
    return out;
  },
};

// Sync is on when the server is configured (mobile/.env.local, not committed).
const url = process.env.EXPO_PUBLIC_LUMEN_SERVER;
const token = process.env.EXPO_PUBLIC_LUMEN_TOKEN;

export const lumen = createLumen(driver, { sync: url && token ? { url, token } : undefined });
