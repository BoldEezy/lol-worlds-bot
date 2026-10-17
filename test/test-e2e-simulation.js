const assert = require('assert');
const queries = require('../src/database/queries');
const lolEsportsService = require('../src/services/lolEsportsService');
const predictionEngine = require('../src/services/predictionEngine');

console.log('🧪 Starting End-to-End Simulation Test...\n');

// 1. Create test users
const user1 = { id: 'test_user_1', name: 'FakerFan' };
const user2 = { id: 'test_user_2', name: 'ChovyFan' };
const user3 = { id: 'test_user_3', name: 'LuckyGuesser' };

queries.ensureUser(user1.id, user1.name);
queries.ensureUser(user2.id, user2.name);
queries.ensureUser(user3.id, user3.name);

// 2. Create a mock Bo5 match
const mockMatchId = `test_bo5_${Date.now()}`;
const match = lolEsportsService.createMockMatch({
  matchId: mockMatchId,
  team1Name: 'T1',
  team1Code: 'T1',
  team2Name: 'Gen.G',
  team2Code: 'GEN',
  bestOf: 5,
  startTime: new Date(Date.now() + 3600000).toISOString(),
  blockName: 'Worlds 2026 Finals'
});
console.log(`✅ Created test match: ${match.team1_code} vs ${match.team2_code} (Bo5, ID: ${mockMatchId})`);

// 3. Submit predictions:
// User 1 predicts T1 wins 3-1 (Expect: 4 pts)
queries.savePrediction(user1.id, mockMatchId, 'T1', 3, 1);
// User 2 predicts GEN wins 3-2 (Expect: 0 pts)
queries.savePrediction(user2.id, mockMatchId, 'GEN', 2, 3);
// User 3 predicts T1 wins 3-2 (Expect: 3 pts)
queries.savePrediction(user3.id, mockMatchId, 'T1', 3, 2);
console.log('✅ Registered 3 user predictions.');

// 4. Conclude the match: T1 wins 3-1
lolEsportsService.completeMockMatch(mockMatchId, 3, 1);
console.log('✅ Match completed with final score: T1 [3 - 1] GEN');

// 5. Run the settlement engine
const report = predictionEngine.settleMatch(mockMatchId);
console.log(`✅ Settle engine resolved ${report.totalPredictions} predictions.\n`);

// 6. Verify scores
const u1 = queries.getUser(user1.id);
const u2 = queries.getUser(user2.id);
const u3 = queries.getUser(user3.id);

console.log('📊 Verification Results:');
console.log(`• ${user1.name}: ${u1.total_points} pts (Expected: 4) | Exact hits: ${u1.exact_scores}`);
console.log(`• ${user2.name}: ${u2.total_points} pts (Expected: 0) | Exact hits: ${u2.exact_scores}`);
console.log(`• ${user3.name}: ${u3.total_points} pts (Expected: 3) | Exact hits: ${u3.exact_scores}`);

assert.strictEqual(u1.total_points >= 4, true, 'User 1 should have received 4 points');
assert.strictEqual(u1.exact_scores >= 1, true, 'User 1 should have 1 exact score hit');
assert.strictEqual(u3.total_points >= 3, true, 'User 3 should have received 3 points');
assert.strictEqual(u3.exact_scores === 0, true, 'User 3 should have 0 exact score hits');

// 7. Verify leaderboard
const leaderboard = queries.getLeaderboard(5);
console.log('\n🏆 Leaderboard Standings:');
leaderboard.forEach((row, i) => {
  console.log(`  #${i + 1} ${row.username}: ${row.total_points} pts (Exact: ${row.exact_scores}, WinRate: ${row.win_rate}%)`);
});

console.log('\n🎉 END-TO-END PREDICTION & SCORING SIMULATION PASSED COMPLETELY!\n');
