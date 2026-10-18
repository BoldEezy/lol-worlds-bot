const path = require('path');
const config = require('../config');

// Universal SQLite Loader (supports better-sqlite3 across Node 18, 20, 22, 24+ with fallback to node:sqlite)
let SqliteConstructor = null;
try {
  SqliteConstructor = require('better-sqlite3');
} catch (e) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    SqliteConstructor = DatabaseSync;
  } catch (err) {
    console.error('Failed to load SQLite module:', err);
    throw new Error('SQLite library not found. Please ensure better-sqlite3 is installed.');
  }
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const dbPath = path.resolve(config.DB_PATH);
    dbInstance = new SqliteConstructor(dbPath);

    // Initialize Schema
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        total_points INTEGER DEFAULT 0,
        correct_winners INTEGER DEFAULT 0,
        exact_scores INTEGER DEFAULT 0,
        total_predictions INTEGER DEFAULT 0,
        bo1_points INTEGER DEFAULT 0,
        bo3_points INTEGER DEFAULT 0,
        bo5_points INTEGER DEFAULT 0,
        dm_reminders INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS matches (
        match_id TEXT PRIMARY KEY,
        team1_name TEXT NOT NULL,
        team1_code TEXT NOT NULL,
        team1_image TEXT,
        team2_name TEXT NOT NULL,
        team2_code TEXT NOT NULL,
        team2_image TEXT,
        best_of INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        block_name TEXT,
        state TEXT DEFAULT 'unstarted',
        winner_code TEXT,
        team1_score INTEGER DEFAULT 0,
        team2_score INTEGER DEFAULT 0,
        settled INTEGER DEFAULT 0,
        is_mock INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        predicted_winner_code TEXT NOT NULL,
        predicted_team1_score INTEGER NOT NULL,
        predicted_team2_score INTEGER NOT NULL,
        points_awarded INTEGER DEFAULT NULL,
        winner_correct INTEGER DEFAULT 0,
        exact_score_hit INTEGER DEFAULT 0,
        settled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, match_id)
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        role_id TEXT,
        last_prompt_date TEXT
      );

      CREATE TABLE IF NOT EXISTS matchday_summaries (
        day_key TEXT PRIMARY KEY,
        posted_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
      CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
      CREATE INDEX IF NOT EXISTS idx_matches_settled ON matches(settled);
    `);
  }
  return dbInstance;
}

module.exports = { getDb };
