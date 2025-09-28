/**
 * Maintenance script to keep the notification system clean
 * This can be run regularly to remove old, expired, and test notifications
 */

import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { DailyLoginService } from '../services/dailyLoginService';
import { logger } from '../utils/logger';

async function maintenanceCleanup() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    console.log('\n=== NOTIFICATION SYSTEM MAINTENANCE CLEANUP ===\n');
    console.log(`🕐 Started at: ${new Date().toLocaleString()}`);

    const cleanupResults = {
      totalNotificationsBefore: 0,
      expiredNotifications: 0,
      oldNotifications: 0,
      testNotifications: 0,
      totalNotificationsAfter: 0,
      loginRecordsCleaned: 0
    };

    // 1. Clean up notifications
    console.log('📊 Cleaning up notifications...');
    
    cleanupResults.totalNotificationsBefore = await Notification.countDocuments({});

    // Remove expired notifications
    const expiredResult = await Notification.deleteMany({
      expires_at: { $lt: new Date() }
    });
    cleanupResults.expiredNotifications = expiredResult.deletedCount;
    console.log(`   ✅ Removed ${expiredResult.deletedCount} expired notifications`);

    // Remove notifications older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldResult = await Notification.deleteMany({
      created_at: { $lt: thirtyDaysAgo }
    });
    cleanupResults.oldNotifications = oldResult.deletedCount;
    console.log(`   ✅ Removed ${oldResult.deletedCount} old notifications (30+ days)`);

    // Remove test/demo notifications
    const testPatterns = [
      /^test-/i,
      /^demo-/i,
      /default-user/i,
      /test.*user/i,
      /test.*cashier/i,
      /demo.*user/i,
      /demo.*cashier/i,
      /Team Member/i
    ];

    let testNotificationsRemoved = 0;
    for (const pattern of testPatterns) {
      const result = await Notification.deleteMany({
        $or: [
          { user_id: { $regex: pattern } },
          { store_id: { $regex: pattern } },
          { title: { $regex: pattern } },
          { message: { $regex: pattern } }
        ]
      });
      testNotificationsRemoved += result.deletedCount;
    }
    cleanupResults.testNotifications = testNotificationsRemoved;
    console.log(`   ✅ Removed ${testNotificationsRemoved} test/demo notifications`);

    cleanupResults.totalNotificationsAfter = await Notification.countDocuments({});

    // 2. Clean up daily login records
    console.log('\n📊 Cleaning up daily login records...');
    
    const allRecords = DailyLoginService.getAllLoginRecords();
    cleanupResults.loginRecordsCleaned = allRecords.length;
    
    // Clean up old records (older than 7 days)
    DailyLoginService.cleanupOldRecords();
    console.log(`   ✅ Cleaned up ${allRecords.length} daily login records`);

    // 3. Display results
    console.log('\n=== MAINTENANCE CLEANUP RESULTS ===');
    console.log(`📊 Notifications before cleanup: ${cleanupResults.totalNotificationsBefore}`);
    console.log(`📊 Notifications after cleanup: ${cleanupResults.totalNotificationsAfter}`);
    console.log(`🗑️  Total notifications removed: ${cleanupResults.totalNotificationsBefore - cleanupResults.totalNotificationsAfter}`);
    console.log('\nBreakdown:');
    console.log(`   • Expired notifications: ${cleanupResults.expiredNotifications}`);
    console.log(`   • Old notifications (30+ days): ${cleanupResults.oldNotifications}`);
    console.log(`   • Test/demo notifications: ${cleanupResults.testNotifications}`);
    console.log(`   • Daily login records cleaned: ${cleanupResults.loginRecordsCleaned}`);

    // 4. Show current system status
    console.log('\n📋 Current System Status:');
    
    const recentNotifications = await Notification.find({})
      .sort({ created_at: -1 })
      .limit(5)
      .select('title type user_id created_at');

    if (recentNotifications.length > 0) {
      console.log('\n   Recent notifications:');
      recentNotifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.type.toUpperCase()}] ${notification.title}`);
        console.log(`      User: ${notification.user_id} | Created: ${notification.created_at.toLocaleDateString()}`);
      });
    } else {
      console.log('\n   ✅ No notifications in the system');
    }

    console.log('\n=== MAINTENANCE CLEANUP COMPLETED ===');
    console.log(`🕐 Completed at: ${new Date().toLocaleString()}`);
    console.log('✅ Notification system is clean and optimized');
    console.log('✅ Ready for production use');

  } catch (error) {
    logger.error('Maintenance cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the maintenance cleanup if called directly
if (require.main === module) {
  maintenanceCleanup()
    .then(() => {
      console.log('\n🎊 Maintenance cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Maintenance cleanup failed:', error);
      process.exit(1);
    });
}

export { maintenanceCleanup };
