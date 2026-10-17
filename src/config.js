require('dotenv').config();

module.exports = {
  // Discord Bot Configuration
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  GUILD_ID: process.env.GUILD_ID || '', // Optional: For instant guild-level command registration

  // LoL Esports API Configuration
  LOL_ESPORTS_API_URL: process.env.LOL_ESPORTS_API_URL || 'https://esports-api.lolesports.com/persisted/gw',
  LOL_ESPORTS_API_KEY: process.env.LOL_ESPORTS_API_KEY || '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
  WORLDS_LEAGUE_ID: process.env.WORLDS_LEAGUE_ID || '98767975604431411', // Worlds official leagueId

  // Scheduler Timings
  RESULT_POLL_INTERVAL_MINUTES: parseInt(process.env.RESULT_POLL_INTERVAL_MINUTES || '5', 10),
  DAILY_PROMPT_CRON: process.env.DAILY_PROMPT_CRON || '0 9 * * *', // Every day at 09:00 UTC
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '120', 10),

  // Database path
  DB_PATH: process.env.DB_PATH || './worlds_predictions.db',

  // Scoring Rules Configuration (Matching user specifications)
  SCORING: {
    BO1: {
      WINNER_POINTS: 1,
      EXACT_SCORE_BONUS: 0 // No exact score bonus for Bo1
    },
    BO3: {
      WINNER_POINTS: 2,
      EXACT_SCORE_BONUS: 1 // +1 point for exact score (2-0 or 2-1)
    },
    BO5: {
      WINNER_POINTS: 3,
      EXACT_SCORE_BONUS: 1 // +1 point for exact score (3-0, 3-1, or 3-2)
    }
  },

  // Worlds Aesthetic Theme Colors
  COLORS: {
    WORLDS_GOLD: 0xC89B3C,
    HEXTECH_BLUE: 0x0AC8B9,
    DARK_NAVY: 0x091428,
    VICTORY_GREEN: 0x1EBE71,
    DEFEAT_RED: 0xE84057,
    PURPLE_MYTHIC: 0x9333EA
  }
};
