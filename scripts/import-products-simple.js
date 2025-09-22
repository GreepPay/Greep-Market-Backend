#!/usr/bin/env node

/**
 * Simple Product Import Script
 * Imports products from a JSON file using existing server connection
 * 
 * Usage: node scripts/import-products-simple.js <filename>
 */

const fs = require('fs');
const path = require('path');

async function importProducts() {
    try {
        console.log('📦 SIMPLE PRODUCT IMPORT SCRIPT');
        console.log('================================\n');

        // Get filename from command line
        const filename = process.argv[2];

        if (!filename) {
            console.error('❌ Error: Please provide a JSON file to import');
            console.log('\nUsage: node scripts/import-products-simple.js <filename>');
            console.log('\nExample: node scripts/import-products-simple.js products-export-simple-2025-09-22.json');
            process.exit(1);
        }

        // Check if file exists
        if (!fs.existsSync(filename)) {
            console.error(`❌ Error: File not found: ${filename}`);
            process.exit(1);
        }

        // Import the Product model from the compiled dist
        const { Product } = require('../dist/models/Product');

        // Read and parse JSON file
        console.log(`📖 Reading file: ${filename}`);
        const fileContent = fs.readFileSync(filename, 'utf8');
        let products;

        try {
            products = JSON.parse(fileContent);
        } catch (parseError) {
            console.error('❌ Error: Invalid JSON file');
            console.error(parseError.message);
            process.exit(1);
        }

        if (!Array.isArray(products)) {
            console.error('❌ Error: JSON file must contain an array of products');
            process.exit(1);
        }

        console.log(`✅ Loaded ${products.length} products from file\n`);

        // Process products
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        const errorDetails = [];

        console.log('📋 Processing products...\n');

        for (let i = 0; i < products.length; i++) {
            const productData = products[i];
            const progress = `[${i + 1}/${products.length}]`;

            try {
                // Validate required fields
                const requiredFields = ['name', 'price', 'category', 'sku'];
                const missingFields = requiredFields.filter(field => !productData[field]);

                if (missingFields.length > 0) {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }

                // Check if product already exists (by SKU)
                const existingProduct = await Product.findOne({
                    sku: productData.sku
                });

                if (existingProduct) {
                    console.log(`${progress} ⏭️  SKIP: ${productData.name} (SKU: ${productData.sku}) - Already exists`);
                    skipped++;
                    continue;
                }

                // Create new product
                const newProduct = new Product({
                    ...productData,
                    created_at: new Date(),
                    updated_at: new Date()
                });

                await newProduct.save();
                console.log(`${progress} ➕ IMPORT: ${productData.name} (SKU: ${productData.sku})`);
                imported++;

            } catch (error) {
                console.log(`${progress} ❌ ERROR: ${productData.name || 'Unknown'} - ${error.message}`);
                errors++;
                errorDetails.push({
                    product: productData.name || 'Unknown',
                    sku: productData.sku || 'Unknown',
                    error: error.message
                });
            }
        }

        // Show summary
        console.log('\n📊 IMPORT SUMMARY');
        console.log('==================');
        console.log(`📁 File: ${path.resolve(filename)}`);
        console.log(`📦 Total Products: ${products.length}`);
        console.log(`➕ Imported: ${imported}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);

        if (errors > 0) {
            console.log('\n❌ ERROR DETAILS');
            console.log('==================');
            errorDetails.forEach((error, index) => {
                console.log(`${index + 1}. ${error.product} (SKU: ${error.sku})`);
                console.log(`   Error: ${error.error}\n`);
            });
        }

        console.log('\n🎉 Import completed successfully!');

        // Show next steps
        if (imported > 0) {
            console.log('\n💡 Next steps:');
            console.log('   1. Verify products in your application');
            console.log('   2. Check inventory levels and stock quantities');
            console.log('   3. Update any missing product images');
        }

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

// Show help if no arguments provided
if (process.argv.length < 3 || process.argv[2] === '--help' || process.argv[2] === '-h') {
    console.log('📦 SIMPLE PRODUCT IMPORT SCRIPT');
    console.log('================================\n');
    console.log('Usage: node scripts/import-products-simple.js <filename>\n');
    console.log('Arguments:');
    console.log('  <filename>           JSON file containing products to import\n');
    console.log('Examples:');
    console.log('  node scripts/import-products-simple.js products-export-simple.json');
    console.log('  node scripts/import-products-simple.js my-products.json');
    process.exit(0);
}

// Run the import
if (require.main === module) {
    importProducts();
}

module.exports = { importProducts };
