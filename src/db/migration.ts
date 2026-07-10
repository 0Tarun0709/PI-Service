import type { Database } from 'bun:sqlite';

interface Migration {
  name: string;
  up: (db: Database) => void;
}

const migrations: Migration[] = [
  {
    name: '001_create_sessions_table',
    up: (db: Database) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          workspace_path TEXT,
          model TEXT,
          status TEXT,
          messages BLOB,
          created_at TEXT
        )
      `);
    }
  }
  // New migrations (e.g., adding indexes or columns) can be appended to this list
];

/**
 * Runs all pending schema migrations inside a SQLite transaction
 */
export function runMigrations(db: Database) {
  // 1. Create the migrations tracking table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TEXT
    )
  `);

  // 2. Fetch already applied migrations
  const rows = db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[];
  const applied = new Set(rows.map((r) => r.name));

  // 3. Apply pending migrations inside a transaction
  const executeMigrations = db.transaction(() => {
    for (const migration of migrations) {
      if (!applied.has(migration.name)) {
        console.log(`⚙️ Running migration: ${migration.name}`);
        migration.up(db);
        
        db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
          .run(migration.name, new Date().toISOString());
          
        console.log(`✅ Completed migration: ${migration.name}`);
      }
    }
  });

  executeMigrations();
}
