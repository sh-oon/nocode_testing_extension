/**
 * SQLite database schema definitions
 */

export const CREATE_TABLES_SQL = `
-- Recording sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  url TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'recording',
  viewport_width INTEGER NOT NULL DEFAULT 1440,
  viewport_height INTEGER NOT NULL DEFAULT 900,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Raw events table (stores events from extension)
CREATE TABLE IF NOT EXISTS raw_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Scenarios table (stores converted AST)
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  name TEXT,
  description TEXT,
  url TEXT NOT NULL,
  viewport_width INTEGER NOT NULL DEFAULT 1440,
  viewport_height INTEGER NOT NULL DEFAULT 900,
  steps TEXT NOT NULL,
  setup TEXT,
  teardown TEXT,
  variables TEXT,
  tags TEXT,
  recorded_at INTEGER NOT NULL,
  ast_schema_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Execution results table
CREATE TABLE IF NOT EXISTS execution_results (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  status TEXT NOT NULL,
  total_steps INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL,
  step_results TEXT NOT NULL,
  environment TEXT,
  executed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_scenarios_session ON scenarios(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_scenario ON execution_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

export const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS execution_results;
DROP TABLE IF EXISTS scenarios;
DROP TABLE IF EXISTS raw_events;
DROP TABLE IF EXISTS sessions;
`;
