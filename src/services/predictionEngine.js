const config = require('../config');
const queries = require('../database/queries');

class PredictionEngine {
  /**
   * Pure calculation of score based on user prediction and actual match result
   * @param {Object} prediction - { predicted_winner_code, predicted_team1_score, predicted_team2_score }
   * @param {Object} match - { best_of, winner_code, team1_score, team2_score }
   * @returns {{ pointsEarned: number, isWinnerCorrect: boolean, isExactScore: boolean, breakdown: string }}
   */
  calculateScore(prediction, match) {
    const bestOf = Number(match.best_of);
    const predictedWinner = (prediction.predicted_winner_code || '').trim().toUpperCase();
    const actualWinner = (match.winner_code || '').trim().toUpperCase();

    const isWinnerCorrect = predictedWinner !== '' && predictedWinner === actualWinner;

    // Check exact score
    const isExactScore = isWinnerCorrect &&
      Number(prediction.predicted_team1_score) === Number(match.team1_score) &&
      Number(prediction.predicted_team2_score) === Number(match.team2_score);

    if (!isWinnerCorrect) {
      return {
        pointsEarned: 0,
        isWinnerCorrect: false,
        isExactScore: false,
        breakdown: 'Incorrect winner prediction (0 pts)'
      };
    }

    let pointsEarned = 0;
    let breakdown = '';

    if (bestOf === 1) {
      pointsEarned = config.SCORING.BO1.WINNER_POINTS;
      breakdown = `Correct Bo1 winner (+${pointsEarned} pt)`;
    } else if (bestOf === 3) {
      const base = config.SCORING.BO3.WINNER_POINTS; // 2 pts
      const bonus = isExactScore ? config.SCORING.BO3.EXACT_SCORE_BONUS : 0; // +1 pt
      pointsEarned = base + bonus;
      breakdown = isExactScore
        ? `Correct Bo3 winner (+${base} pts) & exact score bonus (+${bonus} pt) = ${pointsEarned} pts`
        : `Correct Bo3 winner (+${base} pts)`;
    } else if (bestOf === 5) {
      const base = config.SCORING.BO5.WINNER_POINTS; // 3 pts
      const bonus = isExactScore ? config.SCORING.BO5.EXACT_SCORE_BONUS : 0; // +1 pt
      pointsEarned = base + bonus;
      breakdown = isExactScore
        ? `Correct Bo5 winner (+${base} pts) & exact score bonus (+${bonus} pt) = ${pointsEarned} pts`
        : `Correct Bo5 winner (+${base} pts)`;
    } else {
      // Default fallback
      pointsEarned = isWinnerCorrect ? 1 : 0;
      breakdown = `Default scoring (+${pointsEarned} pt)`;
    }

    return {
      pointsEarned,
      isWinnerCorrect: true,
      isExactScore,
      breakdown
    };
  }

  /**
   * Generates all valid score combinations for a Best-Of format
   * @param {number} bestOf - 1, 3, or 5
   * @param {string} team1Code
   * @param {string} team2Code
   * @returns {Array<{ label: string, value: string, t1Score: number, t2Score: number, winnerCode: string }>}
   */
  getValidScoreOptions(bestOf, team1Code, team2Code) {
    const options = [];

    if (bestOf === 1) {
      options.push({
        label: `${team1Code} Wins (1-0)`,
        value: `${team1Code}_1_0`,
        t1Score: 1,
        t2Score: 0,
        winnerCode: team1Code
      });
      options.push({
        label: `${team2Code} Wins (0-1)`,
        value: `${team2Code}_0_1`,
        t1Score: 0,
        t2Score: 1,
        winnerCode: team2Code
      });
    } else if (bestOf === 3) {
      // Team 1 wins
      options.push({ label: `${team1Code} (2 - 0)`, value: `${team1Code}_2_0`, t1Score: 2, t2Score: 0, winnerCode: team1Code });
      options.push({ label: `${team1Code} (2 - 1)`, value: `${team1Code}_2_1`, t1Score: 2, t2Score: 1, winnerCode: team1Code });
      // Team 2 wins
      options.push({ label: `${team2Code} (0 - 2)`, value: `${team2Code}_0_2`, t1Score: 0, t2Score: 2, winnerCode: team2Code });
      options.push({ label: `${team2Code} (1 - 2)`, value: `${team2Code}_1_2`, t1Score: 1, t2Score: 2, winnerCode: team2Code });
    } else if (bestOf === 5) {
      // Team 1 wins
      options.push({ label: `${team1Code} (3 - 0)`, value: `${team1Code}_3_0`, t1Score: 3, t2Score: 0, winnerCode: team1Code });
      options.push({ label: `${team1Code} (3 - 1)`, value: `${team1Code}_3_1`, t1Score: 3, t2Score: 1, winnerCode: team1Code });
      options.push({ label: `${team1Code} (3 - 2)`, value: `${team1Code}_3_2`, t1Score: 3, t2Score: 2, winnerCode: team1Code });
      // Team 2 wins
      options.push({ label: `${team2Code} (0 - 3)`, value: `${team2Code}_0_3`, t1Score: 0, t2Score: 3, winnerCode: team2Code });
      options.push({ label: `${team2Code} (1 - 3)`, value: `${team2Code}_1_3`, t1Score: 1, t2Score: 3, winnerCode: team2Code });
      options.push({ label: `${team2Code} (2 - 3)`, value: `${team2Code}_2_3`, t1Score: 2, t2Score: 3, winnerCode: team2Code });
    }

    return options;
  }

  /**
   * Validates if a match is open for prediction submission
   * @param {Object} match
   * @returns {{ isOpen: boolean, reason?: string }}
   */
  isMatchOpenForPrediction(match) {
    if (!match) return { isOpen: false, reason: 'Match does not exist.' };

    // Disallow predictions if either team is TBD
    const t1Code = (match.team1_code || '').trim().toUpperCase();
    const t2Code = (match.team2_code || '').trim().toUpperCase();
    const t1Name = (match.team1_name || '').trim().toUpperCase();
    const t2Name = (match.team2_name || '').trim().toUpperCase();
    if (t1Code === 'TBD' || t2Code === 'TBD' || t1Name === 'TBD' || t2Name === 'TBD' || !t1Code || !t2Code) {
      return { isOpen: false, reason: 'Teams for this series are still To Be Determined (TBD). Predictions will open once teams are confirmed in the official draw!' };
    }

    if (match.state === 'completed') return { isOpen: false, reason: 'Match is already completed.' };
    if (match.state === 'inProgress') return { isOpen: false, reason: 'Match is already in progress and locked.' };

    const startTimeMs = new Date(match.start_time).getTime();
    if (Date.now() >= startTimeMs) {
      return { isOpen: false, reason: 'Match start time has passed and predictions are locked.' };
    }

    return { isOpen: true };
  }

  /**
   * Settles predictions for a completed match, awards points, and updates user records
   * @param {string} matchId
   * @returns {Object} Settlement report
   */
  settleMatch(matchId) {
    const match = queries.getMatch(matchId);
    if (!match) throw new Error(`Match ${matchId} not found`);
    if (match.state !== 'completed') {
      throw new Error(`Match ${matchId} is not marked completed yet (state: ${match.state})`);
    }
    if (match.settled === 1) {
      return { alreadySettled: true, match, userResults: [] };
    }

    const predictions = queries.getPredictionsForMatch(matchId);
    const userResults = [];

    for (const pred of predictions) {
      const result = this.calculateScore(pred, match);

      queries.settlePrediction(
        pred.id,
        result.pointsEarned,
        result.isWinnerCorrect,
        result.isExactScore
      );

      queries.updateUserScoreAfterSettlement(
        pred.user_id,
        result.pointsEarned,
        match.best_of,
        result.isWinnerCorrect,
        result.isExactScore
      );

      userResults.push({
        userId: pred.user_id,
        username: pred.username,
        predictedWinner: pred.predicted_winner_code,
        predictedScore: `${pred.predicted_team1_score} - ${pred.predicted_team2_score}`,
        pointsEarned: result.pointsEarned,
        isWinnerCorrect: result.isWinnerCorrect,
        isExactScore: result.isExactScore,
        breakdown: result.breakdown
      });
    }

    queries.markMatchSettled(matchId);

    return {
      alreadySettled: false,
      match,
      totalPredictions: predictions.length,
      userResults
    };
  }
}

module.exports = new PredictionEngine();
