# 🏆 League of Legends Worlds 2026 Score Prediction Discord Bot

A feature-packed, production-ready Discord bot for a community score prediction tournament during the **2026 League of Legends World Championship**.

Users in your Discord server submit match winner and exact score predictions, compete on a server-wide leaderboard, receive advance reminders for daily series, and have their predictions automatically scored as official match results conclude.

---

## 🌟 Key Features

1. **Official LoL Esports API Integration**:
   - Automatically pulls live Worlds 2026 tournament schedules, upcoming series, and real-time match results from the official Riot LoL Esports persisted gateway (`https://esports-api.lolesports.com/persisted/gw/getSchedule`).
   - Supports Best-of-1 (**Bo1**), Best-of-3 (**Bo3**), and Best-of-5 (**Bo5**) series.
   - Intelligent caching layer prevents rate limits while keeping data up to date.

2. **Automated Daily Series Announcements**:
   - Posts a rich announcement embed listing all series of the day in your designated server channel ahead of time.
   - Interactive buttons on the daily embed allow users to submit picks with one click.
   - **Direct DM Reminders**: Summoners can opt-in to direct DM alerts so they never miss submitting a prediction before series lock-in.

3. **Interactive Prediction Interface**:
   - Dynamic buttons and select menus built with Discord Components.
   - Formats score buttons specifically for each series type:
     - **Bo1**: Pick Team A or Team B
     - **Bo3**: Pick Team A (2-0, 2-1) or Team B (0-2, 1-2)
     - **Bo5**: Pick Team A (3-0, 3-1, 3-2) or Team B (0-3, 1-3, 2-3)
   - Ephemeral UI keeps predictions private until match start time.
   - Match lock-in: Predictions automatically lock when a series begins.

4. **Accurate Scoring Engine**:
   - **Bo5 Series**: **3 points** for correct series winner + **1 additional point** for exact score *(Max: 4 pts)*.
   - **Bo3 Series**: **2 points** for correct series winner + **1 additional point** for exact score *(Max: 3 pts)*.
   - **Bo1 Series**: **1 point** for correct winner *(Max: 1 pt)*.

5. **Automated Settlement & Celebratory Announcements**:
   - A background poller checks for completed series every 5 minutes.
   - When a match finishes, it settles all user predictions, awards points, updates leaderboards, and posts a celebratory announcement in the channel showcasing exact score masters and point gains.

6. **Leaderboards & User Stats**:
   - `/leaderboard`: Displays top summoners, points, exact score hits, and win rates.
   - `/profile [@user]`: Shows in-depth summoner prediction stats, Bo1/Bo3/Bo5 breakdown, and recent history.
   - `/mypredictions`: View your active pending picks and past results.

7. **Admin Testing & Simulation Utilities**:
   - `/simulatematch`: Create mock Bo1/Bo3/Bo5 matches and simulate conclusions to test predictions and scoring anytime, even during off-days!

---

## 📐 Scoring Rules Reference

| Series Format | Correct Winner Only | Exact Series Score Bonus | Total Possible Points |
| :--- | :---: | :---: | :---: |
| **Best of 5 (Bo5)** | **3 pts** | **+1 pt** | **4 pts** |
| **Best of 3 (Bo3)** | **2 pts** | **+1 pt** | **3 pts** |
| **Best of 1 (Bo1)** | **1 pt** | *N/A* | **1 pt** |

*Note: The exact score bonus is only awarded if the predicted winner is correct (e.g. predicting Team A 3-1 awards 4 points if Team A wins 3-1, but 0 points if Team B wins 3-1).*

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- **Node.js** (v20+ or v22+, built-in SQLite supported)
- A Discord Bot Application from the [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Discord Developer Portal Setup
1. Create a New Application on the [Discord Developer Portal](https://discord.com/developers/applications).
2. Go to the **Bot** tab:
   - Click **Add Bot** (or Reset Token to copy your `DISCORD_TOKEN`).
   - Under **Privileged Gateway Intents**, enable:
     - `Server Members Intent`
     - `Message Content Intent`
3. Go to **OAuth2** -> **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Use External Emojis`, `Read Message History`, `View Channels`
   - Copy the generated URL and paste it into your browser to invite the bot to your server.
4. Copy your **Application ID** (Client ID) from the **General Information** page.

### 3. Configure `.env`
Open the `.env` file in the project root:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_guild_id_here_optional

# LoL Esports API Configuration (Pre-configured with public gateway)
LOL_ESPORTS_API_URL=https://esports-api.lolesports.com/persisted/gw
LOL_ESPORTS_API_KEY=0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z
WORLDS_LEAGUE_ID=98767975604431411

# Scheduler Settings
RESULT_POLL_INTERVAL_MINUTES=5
DAILY_PROMPT_CRON=0 9 * * *

# Database
DB_PATH=./worlds_predictions.db
```

> **Tip**: Setting `GUILD_ID` during development registers slash commands instantly to your test server without waiting for Discord's global command cache.

### 4. Deploy Slash Commands
Register the application slash commands with Discord:
```bash
npm run deploy
```

### 5. Start the Bot
Run the bot:
```bash
npm start
```
Or with auto-restart on changes:
```bash
npm run dev
```

---

## 🕹️ Discord Commands

### User Commands
- `/predict [match_id]` — Open the interactive score prediction picker for today's or upcoming matches.
- `/matches [filter]` — View today's schedule, upcoming stages, or recent series results.
- `/mypredictions` — Inspect all your active pending predictions and past scored picks.
- `/leaderboard [limit]` — View the server prediction standings and rankings.
- `/profile [@user]` — View personal accuracy, exact score rate, and points breakdown.
- `/remindme` — Toggle direct DM reminders before daily series begin.
- `/help` — Display rules and command explanations.

### Admin Commands (Requires *Manage Server* Permission)
- `/setchannel [channel] [role]` — Designate the channel for daily schedule announcements and match results.
- `/postdaily` — Manually trigger today's series announcement embed into the configured channel.
- `/checkresults` — Manually trigger an API check and settle any newly completed matches immediately.
- `/simulatematch create [best_of] [team1] [team2]` — Create a test match for members to predict.
- `/simulatematch complete [match_id] [team1_score] [team2_score]` — Finish a test match to see real-time point distribution and result broadcasts!

---

## 🧪 Testing

Run unit and integration tests:
```bash
# Test scoring rules matrix
npm run test:scoring

# Test live Riot LoL Esports API connectivity & schedule ingestion
npm run test:api

# Run all tests + End-to-End simulation
npm test
node test/test-e2e-simulation.js
```

---

## 📁 Project Architecture

```
B/
├── .env.example               # Template environment configuration
├── .env                       # Local environment variables
├── package.json               # Dependencies and scripts
├── src/
│   ├── index.js               # Bot entry point & Discord interaction handlers
│   ├── config.js              # Environment settings & scoring constants
│   ├── database/
│   │   ├── db.js              # SQLite connection (built-in node:sqlite)
│   │   └── queries.js         # User, Match, Prediction & Leaderboard queries
│   ├── services/
│   │   ├── lolEsportsService.js # Riot LoL Esports API schedule client & parser
│   │   ├── predictionEngine.js  # Score calculation engine & settlement logic
│   │   └── schedulerService.js  # Daily announcement cron & live match result poller
│   ├── commands/              # Slash command definitions & execution
│   │   ├── predict.js
│   │   ├── matches.js
│   │   ├── leaderboard.js
│   │   ├── mypredictions.js
│   │   ├── profile.js
│   │   ├── setchannel.js
│   │   ├── postdaily.js
│   │   ├── checkresults.js
│   │   ├── simulatematch.js
│   │   ├── remindme.js
│   │   └── help.js
│   ├── ui/
│   │   ├── embeds.js          # Worlds 2026 Gold & Hextech styled embeds
│   │   └── components.js      # Discord buttons, action rows & select menus
│   └── deploy-commands.js     # Slash command deployment script
└── test/
    ├── test-scoring.js        # Unit test verifying exact scoring rules
    ├── test-api.js            # Live LoL Esports API test
    └── test-e2e-simulation.js # Full mock match prediction & settlement test
```
