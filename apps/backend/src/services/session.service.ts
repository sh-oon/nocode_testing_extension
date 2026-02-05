import type { RawEvent } from '@like-cake/event-collector';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type {
  CreateSessionInput,
  ListResponse,
  PaginationParams,
  Session,
  SessionWithEvents,
  StoredRawEvent,
  UpdateSessionInput,
} from '../types';

/**
 * Session service for managing recording sessions
 */
export class SessionService {
  /**
   * Create a new recording session
   */
  create(input: CreateSessionInput): Session {
    const db = getDb();
    const id = `session-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO sessions (id, name, url, started_at, status, viewport_width, viewport_height, user_agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name || null,
      input.url,
      now,
      'recording',
      input.viewport?.width || 1440,
      input.viewport?.height || 900,
      input.userAgent || null,
      now,
      now
    );

    return {
      id,
      name: input.name,
      url: input.url,
      startedAt: now,
      status: 'recording',
      viewport: {
        width: input.viewport?.width || 1440,
        height: input.viewport?.height || 900,
      },
      userAgent: input.userAgent,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get session by ID
   */
  getById(id: string): Session | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, name, url, started_at, ended_at, status, viewport_width, viewport_height, user_agent, created_at, updated_at
      FROM sessions WHERE id = ?
    `);

    const row = stmt.get(id) as SessionRow | undefined;
    if (!row) return null;

    return this.mapRowToSession(row);
  }

  /**
   * Get session with all events
   */
  getWithEvents(id: string): SessionWithEvents | null {
    const session = this.getById(id);
    if (!session) return null;

    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, session_id, type, timestamp, data, created_at
      FROM raw_events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(id) as StoredRawEventRow[];
    const events = rows.map((row) => JSON.parse(row.data) as RawEvent);

    return {
      ...session,
      events,
      eventCount: events.length,
    };
  }

  /**
   * List all sessions with pagination
   */
  list(params: PaginationParams = {}): ListResponse<Session> {
    const db = getDb();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM sessions');
    const { count: total } = countStmt.get() as { count: number };

    const stmt = db.prepare(`
      SELECT id, name, url, started_at, ended_at, status, viewport_width, viewport_height, user_agent, created_at, updated_at
      FROM sessions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as SessionRow[];

    return {
      items: rows.map(this.mapRowToSession),
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Update session
   */
  update(id: string, input: UpdateSessionInput): Session | null {
    const db = getDb();
    const now = Date.now();

    const updates: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.endedAt !== undefined) {
      updates.push('ended_at = ?');
      values.push(input.endedAt);
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE sessions SET ${updates.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.getById(id);
  }

  /**
   * Stop a recording session
   */
  stop(id: string): Session | null {
    return this.update(id, {
      status: 'stopped',
      endedAt: Date.now(),
    });
  }

  /**
   * Delete session and all related events
   */
  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Add event to session
   * Uses INSERT OR IGNORE to handle duplicate event IDs gracefully
   */
  addEvent(sessionId: string, event: RawEvent): StoredRawEvent {
    const db = getDb();
    const id = event.id || `event-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO raw_events (id, session_id, type, timestamp, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, sessionId, event.type, event.timestamp, JSON.stringify(event), now);

    return {
      id,
      sessionId,
      type: event.type,
      timestamp: event.timestamp,
      data: JSON.stringify(event),
      createdAt: now,
    };
  }

  /**
   * Add multiple events to session (batch)
   * Uses INSERT OR IGNORE to handle duplicate event IDs gracefully
   */
  addEvents(sessionId: string, events: RawEvent[]): number {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO raw_events (id, session_id, type, timestamp, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((events: RawEvent[]) => {
      let inserted = 0;
      for (const event of events) {
        const id = event.id || `event-${nanoid(12)}`;
        const result = stmt.run(id, sessionId, event.type, event.timestamp, JSON.stringify(event), now);
        if (result.changes > 0) inserted++;
      }
      return inserted;
    });

    return insertMany(events);
  }

  /**
   * Get events for a session
   */
  getEvents(sessionId: string): RawEvent[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT data FROM raw_events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(sessionId) as { data: string }[];
    return rows.map((row) => JSON.parse(row.data) as RawEvent);
  }

  /**
   * Clear events for a session
   */
  clearEvents(sessionId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM raw_events WHERE session_id = ?');
    const result = stmt.run(sessionId);
    return result.changes;
  }

  private mapRowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      name: row.name || undefined,
      url: row.url,
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      status: row.status as Session['status'],
      viewport: {
        width: row.viewport_width,
        height: row.viewport_height,
      },
      userAgent: row.user_agent || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Internal row types
interface SessionRow {
  id: string;
  name: string | null;
  url: string;
  started_at: number;
  ended_at: number | null;
  status: string;
  viewport_width: number;
  viewport_height: number;
  user_agent: string | null;
  created_at: number;
  updated_at: number;
}

interface StoredRawEventRow {
  id: string;
  session_id: string;
  type: string;
  timestamp: number;
  data: string;
  created_at: number;
}

// Export singleton instance
export const sessionService = new SessionService();
