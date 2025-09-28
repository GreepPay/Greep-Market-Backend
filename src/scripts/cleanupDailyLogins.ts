/**
 * Script to clean up daily login records from memory
 */

import { DailyLoginService } from '../services/dailyLoginService';
import { logger } from '../utils/logger';

async function cleanupDailyLogins() {
  try {
    console.log('\n=== CLEANING UP DAILY LOGIN RECORDS ===\n');

    // Get current login records
    const allRecords = DailyLoginService.getAllLoginRecords();
    console.log(`📊 Total daily login records: ${allRecords.length}`);

    if (allRecords.length > 0) {
      console.log('\n📋 Current login records:');
      allRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. User: ${record.userId} | Store: ${record.storeId}`);
        console.log(`      Date: ${record.loginDate} | Time: ${record.loginTime.toISOString()}`);
        console.log(`      First Login: ${record.isFirstLoginOfDay}`);
      });

      // Reset all login records (this clears the in-memory cache)
      DailyLoginService.resetLoginRecords();
      console.log('\n✅ All daily login records have been cleared');
    } else {
      console.log('\n✅ No daily login records to clean up');
    }

    // Clean up old records (this is a good practice)
    DailyLoginService.cleanupOldRecords();
    console.log('✅ Old records cleanup completed');

    console.log('\n=== DAILY LOGIN CLEANUP COMPLETED ===\n');
    console.log('🎉 Daily login records have been reset');
    console.log('✅ All users can now receive fresh good morning notifications');
    console.log('✅ The system is ready for real user logins');

  } catch (error) {
    logger.error('Daily login cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup if called directly
if (require.main === module) {
  cleanupDailyLogins()
    .then(() => {
      console.log('\n🎊 Daily login cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Daily login cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupDailyLogins };
