#!/usr/bin/env node

/**
 * Store Verification Script
 * Verifies that the default store exists and is accessible
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verifyStore() {
    try {
        console.log('🏪 STORE VERIFICATION SCRIPT');
        console.log('============================\n');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/market-management';
        console.log('🔌 Connecting to MongoDB...');
        console.log(`📍 Using URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Check if we have a Store model (this might not exist yet)
        let Store;
        try {
            Store = require('../dist/models/Store').Store;
            console.log('📦 Store model found');
        } catch (error) {
            console.log('⚠️  Store model not found, checking if we need to create one');

            // Create a simple store schema if it doesn't exist
            const storeSchema = new mongoose.Schema({
                _id: { type: String, required: true },
                name: { type: String, required: true },
                address: { type: String, default: '' },
                phone: { type: String, default: '' },
                email: { type: String, default: '' },
                is_active: { type: Boolean, default: true },
                settings: {
                    currency: { type: String, default: 'USD' },
                    timezone: { type: String, default: 'UTC' },
                    tax_rate: { type: Number, default: 0 },
                    low_stock_threshold: { type: Number, default: 5 }
                },
                created_at: { type: Date, default: Date.now },
                updated_at: { type: Date, default: Date.now }
            });

            Store = mongoose.model('Store', storeSchema);
            console.log('✅ Store model created');
        }

        // Check if default store exists
        console.log('🔍 Checking for default store...');
        const defaultStore = await Store.findOne({ _id: 'default-store' });

        if (defaultStore) {
            console.log('✅ Default store found!');
            console.log('\n📋 Store Details:');
            console.log(`   ID: ${defaultStore._id}`);
            console.log(`   Name: ${defaultStore.name}`);
            console.log(`   Address: ${defaultStore.address}`);
            console.log(`   Phone: ${defaultStore.phone}`);
            console.log(`   Active: ${defaultStore.is_active}`);
            console.log(`   Created: ${defaultStore.created_at}`);
            console.log(`   Updated: ${defaultStore.updated_at}`);
        } else {
            console.log('❌ Default store not found!');
            console.log('🔧 Creating default store...');

            const newStore = new Store({
                _id: 'default-store',
                name: 'Greep Market',
                address: 'Default Store Address',
                phone: '+1234567890',
                email: 'info@greepmarket.com',
                is_active: true,
                settings: {
                    currency: 'USD',
                    timezone: 'UTC',
                    tax_rate: 0,
                    low_stock_threshold: 5
                },
                created_at: new Date(),
                updated_at: new Date()
            });

            await newStore.save();
            console.log('✅ Default store created successfully!');
            console.log('\n📋 New Store Details:');
            console.log(`   ID: ${newStore._id}`);
            console.log(`   Name: ${newStore.name}`);
            console.log(`   Address: ${newStore.address}`);
            console.log(`   Phone: ${newStore.phone}`);
            console.log(`   Active: ${newStore.is_active}`);
        }

        // Check if there are any stores at all
        const totalStores = await Store.countDocuments();
        console.log(`\n📊 Total stores in database: ${totalStores}`);

        // List all stores
        if (totalStores > 0) {
            console.log('\n🏪 All Stores:');
            const allStores = await Store.find({}).select('_id name address is_active created_at');
            allStores.forEach(store => {
                console.log(`   - ${store._id}: ${store.name} (${store.is_active ? 'Active' : 'Inactive'})`);
            });
        }

        console.log('\n🎉 Store verification completed!');

    } catch (error) {
        console.error('❌ Store verification failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the verification
if (require.main === module) {
    verifyStore();
}

module.exports = { verifyStore };
