#!/usr/bin/env node

/**
 * Simple Product Export Script
 * Exports products using the existing server's database connection
 * 
 * Usage: node scripts/export-products-simple.js
 */

const fs = require('fs');
const path = require('path');

async function exportProducts() {
    try {
        console.log('📦 SIMPLE PRODUCT EXPORT SCRIPT');
        console.log('================================\n');

        // Import the Product model from the compiled dist
        const { Product } = require('../dist/models/Product');

        console.log('📋 Fetching products from database...');

        // Fetch all products
        const products = await Product.find({}).lean();

        if (products.length === 0) {
            console.log('⚠️  No products found to export');
            return;
        }

        console.log(`✅ Found ${products.length} products to export\n`);

        // Generate output filename
        const timestamp = new Date().toISOString().split('T')[0];
        const outputFile = `products-export-simple-${timestamp}.json`;

        // Write to file
        console.log(`💾 Writing export to: ${outputFile}`);
        fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));

        // Calculate file size
        const stats = fs.statSync(outputFile);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        console.log('\n📊 EXPORT SUMMARY');
        console.log('==================');
        console.log(`📁 File: ${path.resolve(outputFile)}`);
        console.log(`📏 Size: ${fileSizeKB} KB`);
        console.log(`📦 Products: ${products.length}`);

        // Show product breakdown by store
        const storeCounts = products.reduce((acc, product) => {
            acc[product.store_id] = (acc[product.store_id] || 0) + 1;
            return acc;
        }, {});

        console.log('\n🏪 Products by Store:');
        Object.entries(storeCounts).forEach(([storeId, count]) => {
            console.log(`   ${storeId}: ${count} products`);
        });

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
        console.log('   2. Run the import script: node scripts/import-products-simple.js <filename>');

    } catch (error) {
        console.error('❌ Export failed:', error);
        process.exit(1);
    }
}

// Run the export
if (require.main === module) {
    exportProducts();
}

module.exports = { exportProducts };
