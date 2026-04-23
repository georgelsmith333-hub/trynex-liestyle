import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";

function findWorkspaceRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate workspace root (pnpm-workspace.yaml) starting from ${start}`,
  );
}

function resolveMigrationsDir(): string {
  const envOverride = process.env["MIGRATIONS_DIR"];
  if (envOverride) return path.resolve(envOverride);
  const root = findWorkspaceRoot(process.cwd());
  return path.join(root, "lib", "db", "migrations");
}

export async function runMigrations(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = resolveMigrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      logger.warn({ migrationsDir }, "Migrations directory not found — skipping");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const appliedRes = await db.execute(sql`SELECT name FROM _migrations`);
    const appliedRows = (appliedRes as any).rows ?? appliedRes ?? [];
    const applied = new Set<string>(
      appliedRows.map((r: any) => r.name as string),
    );

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const fullPath = path.join(migrationsDir, file);
      const contents = fs.readFileSync(fullPath, "utf8");
      logger.info({ migration: file }, "Applying migration");
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql.raw(contents));
          await tx.execute(
            sql`INSERT INTO _migrations (name) VALUES (${file})`,
          );
        });
        appliedCount++;
      } catch (err) {
        logger.error({ err, migration: file }, "Migration failed");
        throw err;
      }
    }

    logger.info(
      { appliedCount, totalFiles: files.length },
      "Database migrations complete",
    );
  } catch (err) {
    logger.error({ err }, "Migration runner failed — continuing startup anyway");
  }
}
