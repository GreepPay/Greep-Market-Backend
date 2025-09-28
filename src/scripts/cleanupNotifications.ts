/**
 * Script to clean up demo/test notifications from the database
 */

import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';

async function cleanupNotifications() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    console.log('\n=== CLEANING UP NOTIFICATION DATABASE ===\n');

    // Get total count before cleanup
    const totalBefore = await Notification.countDocuments({});
    console.log(`📊 Total notifications before cleanup: ${totalBefore}`);

    // 1. Remove test notifications (from test users)
    console.log('\n1. Removing test notifications...');
    
    const testUserPatterns = [
      /^test-/i,
      /test.*user/i,
      /test.*cashier/i,
      /68d8bfdd878038d13cc7739[de]$/ // Test ObjectIds from our test
    ];

    let testNotificationsRemoved = 0;
    for (const pattern of testUserPatterns) {
      const result = await Notification.deleteMany({
        user_id: { $regex: pattern }
      });
      testNotificationsRemoved += result.deletedCount;
    }

    console.log(`   ✅ Removed ${testNotificationsRemoved} test notifications`);

    // 2. Remove demo notifications (from demo users)
    console.log('\n2. Removing demo notifications...');
    
    const demoUserPatterns = [
      /^demo-/i,
      /demo.*user/i,
      /demo.*cashier/i,
      /^default-user$/i
    ];

    let demoNotificationsRemoved = 0;
    for (const pattern of demoUserPatterns) {
      const result = await Notification.deleteMany({
        user_id: { $regex: pattern }
      });
      demoNotificationsRemoved += result.deletedCount;
    }

    console.log(`   ✅ Removed ${demoNotificationsRemoved} demo notifications`);

    // 3. Remove notifications with test store IDs
    console.log('\n3. Removing notifications from test stores...');
    
    const testStorePatterns = [
      /^test-store/i,
      /^demo-store/i,
      /test.*store/i
    ];

    let testStoreNotificationsRemoved = 0;
    for (const pattern of testStorePatterns) {
      const result = await Notification.deleteMany({
        store_id: { $regex: pattern }
      });
      testStoreNotificationsRemoved += result.deletedCount;
    }

    console.log(`   ✅ Removed ${testStoreNotificationsRemoved} test store notifications`);

    // 4. Remove very old notifications (older than 7 days)
    console.log('\n4. Removing old notifications...');
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldNotificationsResult = await Notification.deleteMany({
      created_at: { $lt: sevenDaysAgo }
    });

    console.log(`   ✅ Removed ${oldNotificationsResult.deletedCount} old notifications`);

    // 5. Remove expired notifications
    console.log('\n5. Removing expired notifications...');
    
    const expiredNotificationsResult = await Notification.deleteMany({
      expires_at: { $lt: new Date() }
    });

    console.log(`   ✅ Removed ${expiredNotificationsResult.deletedCount} expired notifications`);

    // 6. Remove notifications with test content
    console.log('\n6. Removing notifications with test content...');
    
    const testContentPatterns = [
      /test.*notification/i,
      /test.*milestone/i,
      /test.*achievement/i,
      /test.*good morning/i,
      /Team Member/i, // From our test
      /Test Product/i,
      /Test Supply/i,
      /Test Utility/i
    ];

    let testContentNotificationsRemoved = 0;
    for (const pattern of testContentPatterns) {
      const result = await Notification.deleteMany({
        $or: [
          { title: { $regex: pattern } },
          { message: { $regex: pattern } }
        ]
      });
      testContentNotificationsRemoved += result.deletedCount;
    }

    console.log(`   ✅ Removed ${testContentNotificationsRemoved} notifications with test content`);

    // 7. Get final count
    const totalAfter = await Notification.countDocuments({});
    const totalRemoved = totalBefore - totalAfter;

    console.log('\n=== CLEANUP SUMMARY ===');
    console.log(`📊 Total notifications before: ${totalBefore}`);
    console.log(`📊 Total notifications after: ${totalAfter}`);
    console.log(`🗑️  Total notifications removed: ${totalRemoved}`);
    console.log('\nBreakdown:');
    console.log(`   • Test user notifications: ${testNotificationsRemoved}`);
    console.log(`   • Demo user notifications: ${demoNotificationsRemoved}`);
    console.log(`   • Test store notifications: ${testStoreNotificationsRemoved}`);
    console.log(`   • Old notifications: ${oldNotificationsResult.deletedCount}`);
    console.log(`   • Expired notifications: ${expiredNotificationsResult.deletedCount}`);
    console.log(`   • Test content notifications: ${testContentNotificationsRemoved}`);

    // 8. Show remaining notifications (if any)
    if (totalAfter > 0) {
      console.log('\n📋 Remaining notifications:');
      const remainingNotifications = await Notification.find({})
        .sort({ created_at: -1 })
        .limit(10)
        .select('title user_id store_id created_at type');

      remainingNotifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.type.toUpperCase()}] ${notification.title}`);
        console.log(`      User: ${notification.user_id} | Store: ${notification.store_id}`);
        console.log(`      Created: ${notification.created_at}`);
      });

      if (remainingNotifications.length === 10 && totalAfter > 10) {
        console.log(`   ... and ${totalAfter - 10} more notifications`);
      }
    } else {
      console.log('\n🎉 All notifications have been cleaned up!');
    }

    console.log('\n=== NOTIFICATION CLEANUP COMPLETED ===\n');
    console.log('✅ Demo and test notifications have been removed');
    console.log('✅ Old and expired notifications have been cleaned up');
    console.log('✅ Your notification system is now clean and ready for real users!');

  } catch (error) {
    logger.error('Cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the cleanup if called directly
if (require.main === module) {
  cleanupNotifications()
    .then(() => {
      console.log('\n🎊 Notification cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupNotifications };
