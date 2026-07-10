import { Database } from 'bun:sqlite';
import { gzipSync, gunzipSync } from 'node:zlib';

import { runMigrations } from './migration.js';

export interface DbSessionRow {
  id: string;
  workspace_path: string;
  model: string;
  status: string;
  messages: Uint8Array | string;
  created_at: string;
}

// Automatically connect and run migrations on load
const db = new Database('session.db');
runMigrations(db);

/**
 * Inserts a new session record into the SQLite database
 */
export function saveSession(id: string, workspacePath: string, model: string, status: string, messages: any[] = []) {
  const compressed = gzipSync(JSON.stringify(messages));
  const query = db.prepare(`
    INSERT INTO sessions (id, workspace_path, model, status, messages, created_at)
    VALUES ($id, $workspacePath, $model, $status, $messages, $createdAt)
  `);
  
  query.run({
    $id: id,
    $workspacePath: workspacePath,
    $model: model,
    $status: status,
    $messages: compressed,
    $createdAt: new Date().toISOString()
  });
}

/**
 * Compresses and updates the message history of a session
 */
export function saveSessionMessages(id: string, messages: any[]) {
  const compressed = gzipSync(JSON.stringify(messages));
  const query = db.prepare(`
    UPDATE sessions 
    SET messages = $messages 
    WHERE id = $id
  `);
  
  query.run({
    $messages: compressed,
    $id: id
  });
}

/**
 * Updates status and compresses/persists final message logs
 */
export function updateSessionStatusAndMessages(id: string, status: string, messages: any[]) {
  const compressed = gzipSync(JSON.stringify(messages));
  const query = db.prepare(`
    UPDATE sessions 
    SET status = $status, messages = $messages 
    WHERE id = $id
  `);
  
  query.run({
    $status: status,
    $messages: compressed,
    $id: id
  });
}

/**
 * Updates status of a session
 */
export function updateSessionStatus(id: string, status: string): boolean {
  const query = db.prepare(`
    UPDATE sessions 
    SET status = $status 
    WHERE id = $id
  `);
  
  const result = query.run({
    $status: status,
    $id: id
  });
  
  return result.changes > 0;
}

/**
 * Retrieves a session from the DB and decompresses its message logs
 */
export function getSession(id: string) {
  const query = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = query.get(id) as DbSessionRow | undefined;
  
  if (row) {
    let messages = [];
    if (row.messages) {
      try {
        const decompressed = gunzipSync(row.messages as Buffer);
        messages = JSON.parse(decompressed.toString('utf8'));
      } catch (err) {
        messages = JSON.parse(row.messages.toString());
      }
    }
    return {
      sessionId: row.id,
      workspacePath: row.workspace_path,
      status: row.status,
      messages: messages
    };
  }
  
  return undefined;
}

/**
 * Lists all session records in chronological order
 */
export function listSessions() {
  const query = db.prepare(`
    SELECT id, workspace_path, model, status, created_at 
    FROM sessions 
    ORDER BY created_at DESC
  `);
  
  return query.all();
}
