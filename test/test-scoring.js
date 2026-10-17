const assert = require('assert');
const predictionEngine = require('../src/services/predictionEngine');

console.log('🧪 Starting Scoring Rules Test Suite...\n');

// 1. Bo5 Tests
console.log('Testing Bo5 Scoring:');
const bo5Match = { best_of: 5, winner_code: 'T1', team1_score: 3, team2_score: 1 };

// Correct winner + Exact score (3-1) -> 3 + 1 = 4 points
const resBo5Exact = predictionEngine.calculateScore({
  predicted_winner_code: 'T1',
  predicted_team1_score: 3,
  predicted_team2_score: 1
}, bo5Match);
assert.strictEqual(resBo5Exact.pointsEarned, 4, 'Bo5 exact score should award 4 points (3 win + 1 exact)');
assert.strictEqual(resBo5Exact.isWinnerCorrect, true);
assert.strictEqual(resBo5Exact.isExactScore, true);
console.log('  ✅ Bo5 exact score (3-1) awarded 4 points (3 + 1)');

// Correct winner + Wrong score (predicted 3-2, actual 3-1) -> 3 points
const resBo5WrongScore = predictionEngine.calculateScore({
  predicted_winner_code: 'T1',
  predicted_team1_score: 3,
  predicted_team2_score: 2
}, bo5Match);
assert.strictEqual(resBo5WrongScore.pointsEarned, 3, 'Bo5 correct winner with wrong score should award 3 points');
assert.strictEqual(resBo5WrongScore.isWinnerCorrect, true);
assert.strictEqual(resBo5WrongScore.isExactScore, false);
console.log('  ✅ Bo5 correct winner wrong score (3-2 vs 3-1) awarded 3 points');

// Wrong winner (predicted Gen.G 3-1) -> 0 points
const resBo5WrongWinner = predictionEngine.calculateScore({
  predicted_winner_code: 'GEN',
  predicted_team1_score: 1,
  predicted_team2_score: 3
}, bo5Match);
assert.strictEqual(resBo5WrongWinner.pointsEarned, 0, 'Bo5 wrong winner should award 0 points');
assert.strictEqual(resBo5WrongWinner.isWinnerCorrect, false);
assert.strictEqual(resBo5WrongWinner.isExactScore, false);
console.log('  ✅ Bo5 wrong winner awarded 0 points');

// 2. Bo3 Tests
console.log('\nTesting Bo3 Scoring:');
const bo3Match = { best_of: 3, winner_code: 'G2', team1_score: 2, team2_score: 1 };

// Correct winner + Exact score (2-1) -> 2 + 1 = 3 points
const resBo3Exact = predictionEngine.calculateScore({
  predicted_winner_code: 'G2',
  predicted_team1_score: 2,
  predicted_team2_score: 1
}, bo3Match);
assert.strictEqual(resBo3Exact.pointsEarned, 3, 'Bo3 exact score should award 3 points (2 win + 1 exact)');
assert.strictEqual(resBo3Exact.isWinnerCorrect, true);
assert.strictEqual(resBo3Exact.isExactScore, true);
console.log('  ✅ Bo3 exact score (2-1) awarded 3 points (2 + 1)');

// Correct winner + Wrong score (predicted 2-0, actual 2-1) -> 2 points
const resBo3WrongScore = predictionEngine.calculateScore({
  predicted_winner_code: 'G2',
  predicted_team1_score: 2,
  predicted_team2_score: 0
}, bo3Match);
assert.strictEqual(resBo3WrongScore.pointsEarned, 2, 'Bo3 correct winner with wrong score should award 2 points');
assert.strictEqual(resBo3WrongScore.isWinnerCorrect, true);
assert.strictEqual(resBo3WrongScore.isExactScore, false);
console.log('  ✅ Bo3 correct winner wrong score (2-0 vs 2-1) awarded 2 points');

// Wrong winner (predicted BLG 2-0) -> 0 points
const resBo3WrongWinner = predictionEngine.calculateScore({
  predicted_winner_code: 'BLG',
  predicted_team1_score: 0,
  predicted_team2_score: 2
}, bo3Match);
assert.strictEqual(resBo3WrongWinner.pointsEarned, 0, 'Bo3 wrong winner should award 0 points');
assert.strictEqual(resBo3WrongWinner.isWinnerCorrect, false);
assert.strictEqual(resBo3WrongWinner.isExactScore, false);
console.log('  ✅ Bo3 wrong winner awarded 0 points');

// 3. Bo1 Tests
console.log('\nTesting Bo1 Scoring:');
const bo1Match = { best_of: 1, winner_code: 'FNC', team1_score: 1, team2_score: 0 };

// Correct winner -> 1 point
const resBo1Correct = predictionEngine.calculateScore({
  predicted_winner_code: 'FNC',
  predicted_team1_score: 1,
  predicted_team2_score: 0
}, bo1Match);
assert.strictEqual(resBo1Correct.pointsEarned, 1, 'Bo1 correct winner should award 1 point');
assert.strictEqual(resBo1Correct.isWinnerCorrect, true);
console.log('  ✅ Bo1 correct winner awarded 1 point');

// Wrong winner -> 0 points
const resBo1Wrong = predictionEngine.calculateScore({
  predicted_winner_code: 'C9',
  predicted_team1_score: 0,
  predicted_team2_score: 1
}, bo1Match);
assert.strictEqual(resBo1Wrong.pointsEarned, 0, 'Bo1 wrong winner should award 0 points');
assert.strictEqual(resBo1Wrong.isWinnerCorrect, false);
console.log('  ✅ Bo1 wrong winner awarded 0 points');

console.log('\n🎉 ALL SCORING TESTS PASSED PERFECTLY!\n');
