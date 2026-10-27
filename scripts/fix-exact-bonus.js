// One-off repair: awards the missed exact-score bonus on already settled Bo3/Bo5 predictions
// (picks saved before the API swapped team order). Dry run unless --apply is passed.
// Usage: node scripts/fix-exact-bonus.js [--apply]
const config = require('../src/config');
const { getDb } = require('../src/database/db');
const predictionEngine = require('../src/services/predictionEngine');

const apply = process.argv.includes('--apply');
const db = getDb();

const rows = db.prepare(`
  SELECT p.id, p.user_id, u.username, p.predicted_winner_code, p.predicted_team1_score,
         p.predicted_team2_score, p.points_awarded, p.exact_score_hit,
         m.best_of, m.winner_code, m.team1_code, m.team2_code, m.team1_score, m.team2_score
  FROM predictions p
  JOIN matches m ON m.match_id = p.match_id
  JOIN users u ON u.user_id = p.user_id
  WHERE p.settled = 1 AND m.state = 'completed' AND m.best_of IN (3, 5)
`).all();

const fixes = rows.filter(r => !r.exact_score_hit && predictionEngine.calculateScore(r, r).isExactScore);

if (fixes.length === 0) console.log('Nothing to fix.');

const run = db.transaction(() => {
  for (const r of fixes) {
    const bonus = r.best_of === 3 ? config.SCORING.BO3.EXACT_SCORE_BONUS : config.SCORING.BO5.EXACT_SCORE_BONUS;
    const boCol = r.best_of === 3 ? 'bo3_points' : 'bo5_points';
    console.log(`${apply ? 'FIX ' : 'WOULD FIX '}${r.username}: ${r.team1_code} vs ${r.team2_code} Bo${r.best_of}, pick ${r.predicted_winner_code} ${r.predicted_team1_score}-${r.predicted_team2_score}: +${bonus} pt`);
    if (!apply) continue;
    db.prepare('UPDATE predictions SET points_awarded = points_awarded + ?, exact_score_hit = 1 WHERE id = ?').run(bonus, r.id);
    db.prepare(`UPDATE users SET total_points = total_points + ?, exact_scores = exact_scores + 1, ${boCol} = ${boCol} + ? WHERE user_id = ?`).run(bonus, bonus, r.user_id);
  }
});
run();

if (!apply && fixes.length > 0) console.log('\nDry run only. Re-run with --apply to write these changes.');
