#!/usr/bin/env node

/**
 * Product Export Script
 * Exports all products from the database to a JSON file
 * 
 * Usage: node scripts/export-products.js [options]
 * 
 * Options:
 * --store-id: Export products for specific store only
 * --output: Output file path (default: products-export-YYYY-MM-DD.json)
 * --format: Export format (default: full)
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Product } = require('../dist/models/Product');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    storeId: null,
    output: null,
    format: 'full'
};

args.forEach((arg, index) => {
    if (arg === '--store-id' && args[index + 1]) {
        options.storeId = args[index + 1];
    }
    if (arg === '--output' && args[index + 1]) {
        options.output = args[index + 1];
    }
    if (arg === '--format' && args[index + 1]) {
        options.format = args[index + 1];
    }
});

async function exportProducts() {
    try {
        console.log('📦 PRODUCT EXPORT SCRIPT');
        console.log('========================\n');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/market-management';
        console.log('🔌 Connecting to MongoDB...');
        console.log(`📍 Using URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in log
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Build query filter
        const filter = options.storeId ? { store_id: options.storeId } : {};

        if (options.storeId) {
            console.log(`🏪 Exporting products for store: ${options.storeId}`);
        } else {
            console.log('🏪 Exporting all products from all stores');
        }

        // Fetch products
        console.log('📋 Fetching products from database...');
        const products = await Product.find(filter).lean();

        if (products.length === 0) {
            console.log('⚠️  No products found to export');
            return;
        }

        console.log(`✅ Found ${products.length} products to export\n`);

        // Prepare export data
        let exportData;

        if (options.format === 'minimal') {
            // Minimal format - only essential fields
            exportData = products.map(product => ({
                name: product.name,
                price: product.price,
                cost_price: product.cost_price,
                category: product.category,
                sku: product.sku,
                barcode: product.barcode,
                stock_quantity: product.stock_quantity,
                min_stock_level: product.min_stock_level,
                max_stock_level: product.max_stock_level,
                unit: product.unit,
                description: product.description,
                is_active: product.is_active,
                is_featured: product.is_featured,
                created_by: product.created_by,
                store_id: product.store_id
            }));
        } else {
            // Full format - all fields
            exportData = products;
        }

        // Generate output filename if not provided
        let outputFile = options.output;
        if (!outputFile) {
            const timestamp = new Date().toISOString().split('T')[0];
            const storeSuffix = options.storeId ? `-${options.storeId}` : '';
            outputFile = `products-export${storeSuffix}-${timestamp}.json`;
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write to file
        console.log(`💾 Writing export to: ${outputFile}`);
        fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));

        // Calculate file size
        const stats = fs.statSync(outputFile);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        console.log('\n📊 EXPORT SUMMARY');
        console.log('==================');
        console.log(`📁 File: ${path.resolve(outputFile)}`);
        console.log(`📏 Size: ${fileSizeKB} KB`);
        console.log(`📦 Products: ${products.length}`);
        console.log(`🏪 Stores: ${options.storeId ? '1 (filtered)' : new Set(products.map(p => p.store_id)).size}`);
        console.log(`📋 Format: ${options.format}`);

        // Show product breakdown by store
        if (!options.storeId) {
            console.log('\n🏪 Products by Store:');
            const storeCounts = products.reduce((acc, product) => {
                acc[product.store_id] = (acc[product.store_id] || 0) + 1;
                return acc;
            }, {});

            Object.entries(storeCounts).forEach(([storeId, count]) => {
                console.log(`   ${storeId}: ${count} products`);
            });
        }

        // Show category breakdown
        console.log('\n📂 Products by Category:');
        const categoryCounts = products.reduce((acc, product) => {
            acc[product.category] = (acc[product.category] || 0) + 1;
            return acc;
        }, {});

        Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([category, count]) => {
                console.log(`   ${category}: ${count} products`);
            });

        console.log('\n🎉 Export completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Copy the JSON file to your live server');
        console.log('   2. Run the import script: node scripts/import-products.js <filename>');

    } catch (error) {
        console.error('❌ Export failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the export
if (require.main === module) {
    exportProducts();
}

module.exports = { exportProducts };
