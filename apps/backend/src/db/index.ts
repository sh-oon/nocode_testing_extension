import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { CREATE_TABLES_SQL } from './schema';

let db: Database.Database | null = null;

/**
 * Initialize and get the database instance (singleton)
 */
export function initializeDb(customPath?: string): Database.Database {
  if (!db) {
    const dbPath =
      customPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'like-cake.db');

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Initialize schema
    db.exec(CREATE_TABLES_SQL);

    console.log(`[Like Cake] Database initialized at ${dbPath}`);
  }

  return db;
}

/**
 * Get the database instance (throws if not initialized)
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Like Cake] Database connection closed');
  }
}

/**
 * Get the current database instance without initialization (may be null)
 */
export function getCurrentDb(): Database.Database | null {
  return db;
}
