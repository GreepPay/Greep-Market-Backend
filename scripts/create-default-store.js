#!/usr/bin/env node

/**
 * Create Default Store Script
 * Creates the default store that the application expects
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function createDefaultStore() {
    try {
        console.log('🏪 CREATE DEFAULT STORE SCRIPT');
        console.log('==============================\n');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/market-management';
        console.log('🔌 Connecting to MongoDB...');
        console.log(`📍 Using URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Import the Store model
        const { Store } = require('../dist/models/Store');
        console.log('📦 Store model loaded');

        // Check if any stores exist
        console.log('🔍 Checking for existing stores...');
        const existingStores = await Store.find({ is_active: true });

        if (existingStores.length > 0) {
            console.log(`✅ Found ${existingStores.length} existing stores:`);
            existingStores.forEach(store => {
                console.log(`   - ${store.name} (ID: ${store._id})`);
            });
            console.log('\n🎉 Default store functionality should work!');
            console.log('💡 The StoreService will use the first active store as the "default-store"');
            return;
        }

        console.log('❌ No active stores found');
        console.log('🔧 Creating default store...');

        // Create the default store
        const defaultStore = new Store({
            name: 'Greep Market',
            address: 'Default Store Address',
            phone: '+1234567890',
            email: 'info@greepmarket.com',
            tax_id: 'TAX123456789',
            currency: 'USD',
            timezone: 'UTC',
            business_type: 'Retail',
            subscription_plan: 'basic',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        });

        await defaultStore.save();
        console.log('✅ Default store created successfully!');

        console.log('\n📋 Store Details:');
        console.log(`   ID: ${defaultStore._id}`);
        console.log(`   Name: ${defaultStore.name}`);
        console.log(`   Address: ${defaultStore.address}`);
        console.log(`   Phone: ${defaultStore.phone}`);
        console.log(`   Email: ${defaultStore.email}`);
        console.log(`   Currency: ${defaultStore.currency}`);
        console.log(`   Timezone: ${defaultStore.timezone}`);
        console.log(`   Business Type: ${defaultStore.business_type}`);
        console.log(`   Subscription: ${defaultStore.subscription_plan}`);
        console.log(`   Active: ${defaultStore.is_active}`);
        console.log(`   Created: ${defaultStore.created_at}`);

        console.log('\n🎉 Default store setup completed!');
        console.log('💡 Now when the frontend requests "default-store", it will get this store');

    } catch (error) {
        console.error('❌ Failed to create default store:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    createDefaultStore();
}

module.exports = { createDefaultStore };
