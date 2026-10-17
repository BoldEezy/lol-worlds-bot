const lolEsportsService = require('../src/services/lolEsportsService');
const queries = require('../src/database/queries');

async function run() {
  console.log('📡 Testing LoL Esports API Service & Database Sync...\n');
  try {
    const syncResult = await lolEsportsService.syncMatchesToDatabase(true);
    console.log('✅ Matches Synced to SQLite:');
    console.log(`   Total Matches: ${syncResult.total}`);
    console.log(`   Unstarted: ${syncResult.unstarted}`);
    console.log(`   Completed: ${syncResult.completed}\n`);

    const upcoming = queries.getUpcomingMatches(5);
    console.log(`📅 Next ${upcoming.length} Upcoming Matches in DB:`);
    for (const m of upcoming) {
      console.log(`   • [Bo${m.best_of}] ${m.team1_code} vs ${m.team2_code} | Stage: ${m.block_name} | Start: ${m.start_time}`);
    }

    const nextDayMatches = queries.getNextMatchDayMatches();
    console.log(`\n🌅 Next Match Day Series Count: ${nextDayMatches.length}`);
    for (const m of nextDayMatches) {
      console.log(`   • ${m.team1_name} vs ${m.team2_name} (Bo${m.best_of}) at ${m.start_time}`);
    }

    console.log('\n🎉 API integration and database persistence verified successfully!');
  } catch (err) {
    console.error('❌ Error during API test:', err);
    process.exit(1);
  }
}

run();
