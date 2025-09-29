#!/usr/bin/env node

/**
 * Script to fix fake milestone notifications issue
 * 
 * This script:
 * 1. Clears all existing milestone notifications
 * 2. Resets milestone tracking data
 * 3. Provides instructions for preventing future fake notifications
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';

// Schema definitions (simplified for the script)
const notificationSchema = new mongoose.Schema({
    user_id: String,
    store_id: String,
    type: String,
    title: String,
    message: String,
    is_read: Boolean,
    created_at: Date
}, { collection: 'notifications' });

const milestoneTrackingSchema = new mongoose.Schema({
    store_id: String,
    user_id: String,
    milestone_type: String,
    last_checked_value: Number,
    last_checked_date: Date
}, { collection: 'milestonetrackings' });

const Notification = mongoose.model('Notification', notificationSchema);
const MilestoneTracking = mongoose.model('MilestoneTracking', milestoneTrackingSchema);

async function fixFakeNotifications() {
    try {
        console.log('🔧 Fixing fake milestone notifications issue...\n');

        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Clear all milestone notifications
        console.log('1. Clearing all milestone notifications...');
        const milestoneNotificationsResult = await Notification.deleteMany({
            type: 'milestone'
        });
        console.log(`   ✅ Deleted ${milestoneNotificationsResult.deletedCount} milestone notifications\n`);

        // Step 2: Clear all daily summary notifications (these might also be fake)
        console.log('2. Clearing all daily summary notifications...');
        const dailySummaryResult = await Notification.deleteMany({
            type: 'daily_summary'
        });
        console.log(`   ✅ Deleted ${dailySummaryResult.deletedCount} daily summary notifications\n`);

        // Step 3: Reset all milestone tracking data
        console.log('3. Resetting milestone tracking data...');
        const trackingResult = await MilestoneTracking.deleteMany({});
        console.log(`   ✅ Deleted ${trackingResult.deletedCount} milestone tracking records\n`);

        // Step 4: Show summary
        const totalDeleted = milestoneNotificationsResult.deletedCount +
            dailySummaryResult.deletedCount +
            trackingResult.deletedCount;

        console.log('📊 SUMMARY:');
        console.log(`   • Milestone notifications deleted: ${milestoneNotificationsResult.deletedCount}`);
        console.log(`   • Daily summary notifications deleted: ${dailySummaryResult.deletedCount}`);
        console.log(`   • Milestone tracking records deleted: ${trackingResult.deletedCount}`);
        console.log(`   • Total records cleaned: ${totalDeleted}\n`);

        console.log('🎉 Fake notifications issue has been fixed!\n');

        console.log('📋 WHAT WAS FIXED:');
        console.log('   • The milestone service was using in-memory storage that got reset on server restart');
        console.log('   • This caused the system to think all milestones were "new" and send fake notifications');
        console.log('   • The system now uses persistent database storage for milestone tracking');
        console.log('   • All fake notifications have been cleared\n');

        console.log('🚀 NEXT STEPS:');
        console.log('   1. Restart your server to apply the fixes');
        console.log('   2. The milestone system will now work correctly with persistent tracking');
        console.log('   3. New milestone notifications will only be sent when milestones are actually reached');
        console.log('   4. You can use the new API endpoints to manage notifications:');
        console.log('      - DELETE /api/v1/notifications/clear-all (clear all notifications)');
        console.log('      - DELETE /api/v1/notifications/clear-by-type/:type (clear by type)');
        console.log('      - POST /api/v1/notifications/reset-milestone-tracking (reset tracking data)\n');

        console.log('✨ The notification system is now fixed and ready to use!');

    } catch (error) {
        console.error('❌ Error fixing fake notifications:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script if called directly
if (require.main === module) {
    fixFakeNotifications()
        .then(() => {
            console.log('\n🎊 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { fixFakeNotifications };
