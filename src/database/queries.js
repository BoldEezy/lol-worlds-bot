const { getDb } = require('./db');

const queries = {
  // --- USERS ---
  ensureUser(userId, username) {
    const db = getDb();
    const existing = db.prepare('SELECT user_id, username FROM users WHERE user_id = ?').get(userId);
    if (!existing) {
      db.prepare(`
        INSERT INTO users (user_id, username)
        VALUES (?, ?)
      `).run(userId, username);
    } else if (existing.username !== username) {
      db.prepare('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(username, userId);
    }
  },

  getUser(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  },

  setDmReminders(userId, enabled) {
    const db = getDb();
    db.prepare('UPDATE users SET dm_reminders = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(enabled ? 1 : 0, userId);
  },

  // Replaces the user's carried-over points and shifts total_points by the difference
  setStartingPoints(userId, points) {
    const db = getDb();
    const previous = db.prepare('SELECT starting_points FROM users WHERE user_id = ?').get(userId)?.starting_points || 0;
    db.prepare(`
      UPDATE users
      SET total_points = total_points - ? + ?,
          starting_points = ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(previous, points, points, userId);
    return previous;
  },

  getUsersForReminders() {
    const db = getDb();
    return db.prepare('SELECT user_id, username FROM users WHERE dm_reminders = 1').all();
  },

  // --- MATCHES ---
  upsertMatch(match) {
    const db = getDb();
    db.prepare(`
      INSERT INTO matches (
        match_id, team1_name, team1_code, team1_image,
        team2_name, team2_code, team2_image,
        best_of, start_time, block_name, state,
        winner_code, team1_score, team2_score, is_mock, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(match_id) DO UPDATE SET
        team1_name = excluded.team1_name,
        team1_code = excluded.team1_code,
        team1_image = excluded.team1_image,
        team2_name = excluded.team2_name,
        team2_code = excluded.team2_code,
        team2_image = excluded.team2_image,
        best_of = excluded.best_of,
        start_time = excluded.start_time,
        block_name = excluded.block_name,
        state = excluded.state,
        winner_code = COALESCE(excluded.winner_code, matches.winner_code),
        team1_score = excluded.team1_score,
        team2_score = excluded.team2_score,
        updated_at = datetime('now')
    `).run(
      match.match_id,
      match.team1_name,
      match.team1_code,
      match.team1_image || null,
      match.team2_name,
      match.team2_code,
      match.team2_image || null,
      match.best_of,
      match.start_time,
      match.block_name || 'Worlds 2026',
      match.state || 'unstarted',
      match.winner_code || null,
      match.team1_score || 0,
      match.team2_score || 0,
      match.is_mock ? 1 : 0
    );
  },

  getMatch(matchId) {
    const db = getDb();
    return db.prepare('SELECT * FROM matches WHERE match_id = ?').get(matchId);
  },

  getUpcomingMatches(limit = 10, includeTbd = false) {
    const db = getDb();
    const tbdFilter = includeTbd
      ? ''
      : "AND team1_code != 'TBD' AND team2_code != 'TBD' AND team1_name != 'TBD' AND team2_name != 'TBD'";
    return db.prepare(`
      SELECT * FROM matches
      WHERE state = 'unstarted'
        AND datetime(start_time) > datetime('now', '-2 hours')
        ${tbdFilter}
      ORDER BY datetime(start_time) ASC
      LIMIT ?
    `).all(limit);
  },

  getMatchesForDate(targetDateIso, includeTbd = false) {
    const db = getDb();
    const datePrefix = targetDateIso.substring(0, 10);
    const tbdFilter = includeTbd
      ? ''
      : "AND team1_code != 'TBD' AND team2_code != 'TBD' AND team1_name != 'TBD' AND team2_name != 'TBD'";
    return db.prepare(`
      SELECT * FROM matches
      WHERE start_time LIKE ?
        ${tbdFilter}
      ORDER BY datetime(start_time) ASC
    `).all(`${datePrefix}%`);
  },

  getMatchesForDayCET(cetDateStr, includeTbd = false) {
    const db = getDb();
    const tbdFilter = includeTbd
      ? ''
      : "AND team1_code != 'TBD' AND team2_code != 'TBD' AND team1_name != 'TBD' AND team2_name != 'TBD'";
    const candidates = db.prepare(`
      SELECT * FROM matches
      WHERE state != 'completed'
        ${tbdFilter}
      ORDER BY datetime(start_time) ASC
    `).all();

    // Group by matchday (not CET calendar date) so late US matches past midnight CET stay in the same day
    return candidates.filter(m => this.getMatchdayKey(m.start_time) === cetDateStr);
  },

  getNextMatchDayMatches(includeTbd = false) {
    const db = getDb();
    const tbdFilter = includeTbd
      ? ''
      : "AND team1_code != 'TBD' AND team2_code != 'TBD' AND team1_name != 'TBD' AND team2_name != 'TBD'";

    // Find the next upcoming unstarted match with confirmed teams
    const nextMatch = db.prepare(`
      SELECT start_time FROM matches
      WHERE state != 'completed'
        AND datetime(start_time) >= datetime('now', '-2 hours')
        ${tbdFilter}
      ORDER BY datetime(start_time) ASC
      LIMIT 1
    `).get();

    if (!nextMatch) return [];
    const datePrefix = nextMatch.start_time.substring(0, 10);
    return db.prepare(`
      SELECT * FROM matches
      WHERE start_time LIKE ?
        ${tbdFilter}
      ORDER BY datetime(start_time) ASC
    `).all(`${datePrefix}%`);
  },

  getUnsettledCompletedMatches() {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM matches
      WHERE state = 'completed' AND settled = 0
    `).all();
  },

  markMatchSettled(matchId) {
    const db = getDb();
    db.prepare('UPDATE matches SET settled = 1, updated_at = datetime(\'now\') WHERE match_id = ?').run(matchId);
  },

  // --- MATCHDAY SUMMARIES ---
  // A matchday spans CET midnight (e.g. 00:00Z games), so shift by 6h to group by esports day.
  getMatchdayKey(isoString) {
    return new Date(new Date(isoString).getTime() - 6 * 3600 * 1000).toISOString().substring(0, 10);
  },

  getMatchesForMatchday(dayKey) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM matches WHERE is_mock = 0 ORDER BY datetime(start_time) ASC
    `).all().filter(m => this.getMatchdayKey(m.start_time) === dayKey);
  },

  isMatchdaySummaryPosted(dayKey) {
    const db = getDb();
    return !!db.prepare('SELECT 1 FROM matchday_summaries WHERE day_key = ?').get(dayKey);
  },

  markMatchdaySummaryPosted(dayKey) {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO matchday_summaries (day_key) VALUES (?)').run(dayKey);
  },

  // --- MATCH NOTIFICATIONS (lock reminders, crowd picks) ---
  getMatchesNearStart() {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM matches
      WHERE state != 'completed'
        AND team1_code != 'TBD' AND team2_code != 'TBD'
        AND datetime(start_time) BETWEEN datetime('now', '-60 minutes') AND datetime('now', '+30 minutes')
      ORDER BY datetime(start_time) ASC
    `).all();
  },

  wasNotified(matchId, kind) {
    const db = getDb();
    return !!db.prepare('SELECT 1 FROM match_notifications WHERE match_id = ? AND kind = ?').get(matchId, kind);
  },

  markNotified(matchId, kind) {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO match_notifications (match_id, kind) VALUES (?, ?)').run(matchId, kind);
  },

  getUsersWithoutPrediction(matchId) {
    const db = getDb();
    return db.prepare(`
      SELECT user_id, username FROM users
      WHERE user_id IN (SELECT DISTINCT user_id FROM predictions)
        AND user_id NOT IN (SELECT user_id FROM predictions WHERE match_id = ?)
    `).all(matchId);
  },

  // --- PREDICTIONS ---
  savePrediction(userId, matchId, predictedWinnerCode, predictedTeam1Score, predictedTeam2Score) {
    const db = getDb();
    db.prepare(`
      INSERT INTO predictions (
        user_id, match_id, predicted_winner_code,
        predicted_team1_score, predicted_team2_score,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id, match_id) DO UPDATE SET
        predicted_winner_code = excluded.predicted_winner_code,
        predicted_team1_score = excluded.predicted_team1_score,
        predicted_team2_score = excluded.predicted_team2_score,
        updated_at = datetime('now')
    `).run(
      userId,
      matchId,
      predictedWinnerCode,
      predictedTeam1Score,
      predictedTeam2Score
    );
  },

  getUserPrediction(userId, matchId) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, m.team1_name, m.team1_code, m.team2_name, m.team2_code, m.best_of, m.start_time, m.state
      FROM predictions p
      JOIN matches m ON p.match_id = m.match_id
      WHERE p.user_id = ? AND p.match_id = ?
    `).get(userId, matchId);
  },

  getUserPredictions(userId, limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, m.team1_name, m.team1_code, m.team2_name, m.team2_code, m.best_of, m.start_time, m.state, m.winner_code, m.team1_score, m.team2_score
      FROM predictions p
      JOIN matches m ON p.match_id = m.match_id
      WHERE p.user_id = ?
      ORDER BY datetime(m.start_time) DESC
      LIMIT ?
    `).all(userId, limit);
  },

  getPredictionsForMatch(matchId) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, u.username
      FROM predictions p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.match_id = ?
    `).all(matchId);
  },

  settlePrediction(predictionId, pointsAwarded, winnerCorrect, exactScoreHit) {
    const db = getDb();
    db.prepare(`
      UPDATE predictions
      SET points_awarded = ?,
          winner_correct = ?,
          exact_score_hit = ?,
          settled = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(pointsAwarded, winnerCorrect ? 1 : 0, exactScoreHit ? 1 : 0, predictionId);
  },

  updateUserScoreAfterSettlement(userId, pointsEarned, bestOf, isWinnerCorrect, isExactScore) {
    const db = getDb();
    let bo1Pts = 0;
    let bo3Pts = 0;
    let bo5Pts = 0;

    if (bestOf === 1) bo1Pts = pointsEarned;
    else if (bestOf === 3) bo3Pts = pointsEarned;
    else if (bestOf === 5) bo5Pts = pointsEarned;

    db.prepare(`
      UPDATE users
      SET total_points = total_points + ?,
          correct_winners = correct_winners + ?,
          exact_scores = exact_scores + ?,
          total_predictions = total_predictions + 1,
          bo1_points = bo1_points + ?,
          bo3_points = bo3_points + ?,
          bo5_points = bo5_points + ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      pointsEarned,
      isWinnerCorrect ? 1 : 0,
      isExactScore ? 1 : 0,
      bo1Pts,
      bo3Pts,
      bo5Pts,
      userId
    );
  },

  // --- LEADERBOARD & STATS ---
  getLeaderboard(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT user_id, username, total_points, correct_winners, exact_scores, total_predictions,
             bo1_points, bo3_points, bo5_points,
             CASE
               WHEN total_predictions > 0 THEN ROUND((CAST(correct_winners AS REAL) / total_predictions) * 100, 1)
               ELSE 0
             END as win_rate
      FROM users
      WHERE total_predictions > 0 OR total_points > 0
      ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC
      LIMIT ?
    `).all(limit);
  },

  getUserRank(userId) {
    const db = getDb();
    const result = db.prepare(`
      SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY total_points DESC, exact_scores DESC, correct_winners DESC) as rank
        FROM users
      ) WHERE user_id = ?
    `).get(userId);
    return result ? result.rank : null;
  },

  // --- GUILD SETTINGS ---
  getGuildSettings(guildId) {
    const db = getDb();
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  },

  getAllGuildSettings() {
    const db = getDb();
    return db.prepare('SELECT * FROM guild_settings WHERE channel_id IS NOT NULL').all();
  },

  setGuildChannel(guildId, channelId, roleId = null) {
    const db = getDb();
    db.prepare(`
      INSERT INTO guild_settings (guild_id, channel_id, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        channel_id = excluded.channel_id,
        role_id = COALESCE(excluded.role_id, guild_settings.role_id)
    `).run(guildId, channelId, roleId);
  },

  updateLastPromptDate(guildId, dateStr) {
    const db = getDb();
    db.prepare('UPDATE guild_settings SET last_prompt_date = ? WHERE guild_id = ?').run(dateStr, guildId);
  }
};

module.exports = queries;
