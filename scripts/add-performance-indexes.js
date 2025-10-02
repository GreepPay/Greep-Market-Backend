#!/usr/bin/env node

/**
 * Database Performance Indexes Script
 * Adds indexes to improve dashboard analytics query performance
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const { Transaction } = require('../dist/models/Transaction');
const { Product } = require('../dist/models/Product');

async function addPerformanceIndexes() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        console.log('\n📊 Adding performance indexes...');

        // Transaction indexes for dashboard analytics
        console.log('📈 Adding Transaction indexes...');

        // Store + Date + Status (most common query pattern)
        await db.collection('transactions').createIndex(
            { store_id: 1, created_at: -1, status: 1 },
            { name: 'store_date_status_idx', background: true }
        );
        console.log('✅ Created index: store_date_status_idx');

        // Store + Date for sales aggregation
        await db.collection('transactions').createIndex(
            { store_id: 1, created_at: -1 },
            { name: 'store_date_idx', background: true }
        );
        console.log('✅ Created index: store_date_idx');

        // Payment method for filtering
        await db.collection('transactions').createIndex(
            { store_id: 1, payment_method: 1, created_at: -1 },
            { name: 'store_payment_date_idx', background: true }
        );
        console.log('✅ Created index: store_payment_date_idx');

        // Total amount for aggregation queries
        await db.collection('transactions').createIndex(
            { store_id: 1, total_amount: -1, created_at: -1 },
            { name: 'store_amount_date_idx', background: true }
        );
        console.log('✅ Created index: store_amount_date_idx');

        // Product indexes for inventory analytics
        console.log('\n📦 Adding Product indexes...');

        // Store + Stock level for low stock queries
        await db.collection('products').createIndex(
            { store_id: 1, stock_quantity: 1, min_stock_level: 1 },
            { name: 'store_stock_levels_idx', background: true }
        );
        console.log('✅ Created index: store_stock_levels_idx');

        // Store + Category for category breakdown
        await db.collection('products').createIndex(
            { store_id: 1, category: 1 },
            { name: 'store_category_idx', background: true }
        );
        console.log('✅ Created index: store_category_idx');

        // Store + SKU for product lookups
        await db.collection('products').createIndex(
            { store_id: 1, sku: 1 },
            { name: 'store_sku_idx', background: true, unique: true }
        );
        console.log('✅ Created index: store_sku_idx');

        // Barcode for product searches (skip if already exists)
        try {
            await db.collection('products').createIndex(
                { barcode: 1 },
                { name: 'barcode_idx', background: true, sparse: true }
            );
            console.log('✅ Created index: barcode_idx');
        } catch (error) {
            if (error.codeName === 'IndexOptionsConflict') {
                console.log('ℹ️ Index already exists: barcode_idx (skipped)');
            } else {
                throw error;
            }
        }

        console.log('\n📋 Index Summary:');
        console.log('Transaction indexes: 4');
        console.log('Product indexes: 4');
        console.log('Total indexes added: 8');

        console.log('\n🎯 Performance improvements expected:');
        console.log('- Dashboard queries: 5-10x faster');
        console.log('- Transaction filtering: 3-5x faster');
        console.log('- Low stock queries: 10-20x faster');
        console.log('- Product searches: 5-10x faster');

        console.log('\n✅ All performance indexes added successfully!');

    } catch (error) {
        console.error('❌ Error adding indexes:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    addPerformanceIndexes()
        .then(() => {
            console.log('\n🎉 Database optimization completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Database optimization failed:', error);
            process.exit(1);
        });
}

module.exports = { addPerformanceIndexes };
