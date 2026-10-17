const config = require('../config');
const queries = require('../database/queries');

class LolEsportsService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Fetches the official schedule from the LoL Esports persisted gateway API
   * @param {boolean} forceRefresh - Bypasses cache if true
   * @returns {Promise<Array>} List of normalized match objects
   */
  async fetchSchedule(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cache && (now - this.cacheTimestamp < config.CACHE_TTL_SECONDS * 1000)) {
      return this.cache;
    }

    try {
      const url = `${config.LOL_ESPORTS_API_URL}/getSchedule?hl=en-US&leagueId=${config.WORLDS_LEAGUE_ID}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': config.LOL_ESPORTS_API_KEY,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WorldsDiscordBot/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LoL Esports API responded with status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const events = json?.data?.schedule?.events || [];
      const normalizedMatches = [];

      for (const event of events) {
        if (!event.match || !event.match.teams || event.match.teams.length < 2) {
          continue;
        }

        const m = event.match;
        const t1 = m.teams[0];
        const t2 = m.teams[1];

        let winnerCode = null;
        if (t1.result?.outcome === 'win') winnerCode = t1.code || t1.name;
        else if (t2.result?.outcome === 'win') winnerCode = t2.code || t2.name;

        normalizedMatches.push({
          match_id: m.id,
          team1_name: t1.name || 'TBD',
          team1_code: t1.code || 'TBD',
          team1_image: t1.image || null,
          team2_name: t2.name || 'TBD',
          team2_code: t2.code || 'TBD',
          team2_image: t2.image || null,
          best_of: m.strategy?.count || 1,
          start_time: event.startTime,
          block_name: event.blockName || 'Worlds 2026',
          state: event.state || 'unstarted', // unstarted, inProgress, completed
          winner_code: winnerCode,
          team1_score: t1.result?.gameWins ?? 0,
          team2_score: t2.result?.gameWins ?? 0,
          is_mock: 0
        });
      }

      this.cache = normalizedMatches;
      this.cacheTimestamp = now;
      return normalizedMatches;
    } catch (err) {
      console.error('[LolEsportsService] Failed to fetch schedule from API:', err.message);
      if (this.cache) {
        console.warn('[LolEsportsService] Serving stale cache due to fetch error');
        return this.cache;
      }
      throw err;
    }
  }

  /**
   * Syncs matches from the LoL Esports API into the local SQLite database
   * @param {boolean} forceRefresh
   * @returns {Promise<{ total: number, unstarted: number, completed: number }>}
   */
  async syncMatchesToDatabase(forceRefresh = false) {
    const matches = await this.fetchSchedule(forceRefresh);
    let unstartedCount = 0;
    let completedCount = 0;

    for (const match of matches) {
      queries.upsertMatch(match);
      if (match.state === 'unstarted') unstartedCount++;
      if (match.state === 'completed') completedCount++;
    }

    return {
      total: matches.length,
      unstarted: unstartedCount,
      completed: completedCount
    };
  }

  /**
   * Helper to create a mock/simulation match for testing scoring and predictions anytime
   */
  createMockMatch({ matchId, team1Name, team1Code, team2Name, team2Code, bestOf, startTime, blockName }) {
    const mockMatch = {
      match_id: matchId || `mock_${Date.now()}`,
      team1_name: team1Name || 'T1',
      team1_code: team1Code || 'T1',
      team1_image: 'https://static.lolesports.com/teams/1592591949111_T1_logo_2020.png',
      team2_name: team2Name || 'Gen.G',
      team2_code: team2Code || 'GEN',
      team2_image: 'https://static.lolesports.com/teams/1592591873175_GEN_logo_2020.png',
      best_of: bestOf || 5,
      start_time: startTime || new Date(Date.now() + 3600000).toISOString(),
      block_name: blockName || 'Simulation / Showcase',
      state: 'unstarted',
      winner_code: null,
      team1_score: 0,
      team2_score: 0,
      is_mock: 1
    };

    queries.upsertMatch(mockMatch);
    return mockMatch;
  }

  /**
   * Helper to conclude a mock match with a specific final score for testing the settlement flow
   */
  completeMockMatch(matchId, team1Score, team2Score) {
    const match = queries.getMatch(matchId);
    if (!match) throw new Error(`Match ${matchId} not found`);

    const winnerCode = team1Score > team2Score ? match.team1_code : match.team2_code;
    match.state = 'completed';
    match.team1_score = team1Score;
    match.team2_score = team2Score;
    match.winner_code = winnerCode;

    queries.upsertMatch(match);
    return match;
  }
}

module.exports = new LolEsportsService();
