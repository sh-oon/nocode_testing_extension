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

-- User flows table (combines multiple scenarios into a flow)
CREATE TABLE IF NOT EXISTS user_flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  variables TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Flow execution results table
CREATE TABLE IF NOT EXISTS flow_execution_results (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  total_nodes INTEGER NOT NULL,
  passed_nodes INTEGER NOT NULL DEFAULT 0,
  failed_nodes INTEGER NOT NULL DEFAULT 0,
  skipped_nodes INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  passed_steps INTEGER NOT NULL DEFAULT 0,
  failed_steps INTEGER NOT NULL DEFAULT 0,
  skipped_steps INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL,
  node_results TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (flow_id) REFERENCES user_flows(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raw_events_session ON raw_events(session_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_scenarios_session ON scenarios(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_scenario ON execution_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_flow_execution_results_flow ON flow_execution_results(flow_id);
`;

export const DROP_TABLES_SQL = `
DROP TABLE IF EXISTS flow_execution_results;
DROP TABLE IF EXISTS user_flows;
DROP TABLE IF EXISTS execution_results;
DROP TABLE IF EXISTS scenarios;
DROP TABLE IF EXISTS raw_events;
DROP TABLE IF EXISTS sessions;
`;
