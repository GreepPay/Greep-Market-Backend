#!/usr/bin/env node

/**
 * Product Import Script
 * Imports products from a JSON file into the database
 * 
 * Usage: node scripts/import-products.js <filename> [options]
 * 
 * Options:
 * --store-id: Override store_id for all products
 * --created-by: Override created_by for all products
 * --dry-run: Show what would be imported without actually importing
 * --skip-duplicates: Skip products that already exist (by SKU)
 * --update-existing: Update existing products instead of skipping
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Product } = require('../dist/models/Product');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    filename: null,
    storeId: null,
    createdBy: null,
    dryRun: false,
    skipDuplicates: true,
    updateExisting: false
};

// Get filename (first argument)
if (args[0] && !args[0].startsWith('--')) {
    options.filename = args[0];
}

// Parse other arguments
args.forEach((arg, index) => {
    if (arg === '--store-id' && args[index + 1]) {
        options.storeId = args[index + 1];
    }
    if (arg === '--created-by' && args[index + 1]) {
        options.createdBy = args[index + 1];
    }
    if (arg === '--dry-run') {
        options.dryRun = true;
    }
    if (arg === '--skip-duplicates') {
        options.skipDuplicates = true;
        options.updateExisting = false;
    }
    if (arg === '--update-existing') {
        options.updateExisting = true;
        options.skipDuplicates = false;
    }
});

async function importProducts() {
    try {
        console.log('📦 PRODUCT IMPORT SCRIPT');
        console.log('========================\n');

        // Validate filename
        if (!options.filename) {
            console.error('❌ Error: Please provide a JSON file to import');
            console.log('\nUsage: node scripts/import-products.js <filename> [options]');
            console.log('\nExample: node scripts/import-products.js products-export-2025-09-22.json');
            process.exit(1);
        }

        // Check if file exists
        if (!fs.existsSync(options.filename)) {
            console.error(`❌ Error: File not found: ${options.filename}`);
            process.exit(1);
        }

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/market-management';
        console.log('🔌 Connecting to MongoDB...');
        console.log(`📍 Using URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in log
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Read and parse JSON file
        console.log(`📖 Reading file: ${options.filename}`);
        const fileContent = fs.readFileSync(options.filename, 'utf8');
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

        // Show import options
        console.log('⚙️  IMPORT OPTIONS');
        console.log('==================');
        console.log(`📁 File: ${path.resolve(options.filename)}`);
        console.log(`🏪 Store ID Override: ${options.storeId || 'None (using file values)'}`);
        console.log(`👤 Created By Override: ${options.createdBy || 'None (using file values)'}`);
        console.log(`🔄 Duplicate Handling: ${options.updateExisting ? 'Update existing' : options.skipDuplicates ? 'Skip duplicates' : 'Allow duplicates'}`);
        console.log(`🧪 Dry Run: ${options.dryRun ? 'Yes (no changes will be made)' : 'No (will import to database)'}`);
        console.log('');

        if (options.dryRun) {
            console.log('🧪 DRY RUN MODE - No changes will be made to the database\n');
        }

        // Process products
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const errorDetails = [];

        console.log('📋 Processing products...\n');

        for (let i = 0; i < products.length; i++) {
            const productData = products[i];
            const progress = `[${i + 1}/${products.length}]`;

            try {
                // Apply overrides
                if (options.storeId) {
                    productData.store_id = options.storeId;
                }
                if (options.createdBy) {
                    productData.created_by = options.createdBy;
                }

                // Validate required fields
                const requiredFields = ['name', 'price', 'category', 'sku', 'store_id', 'created_by'];
                const missingFields = requiredFields.filter(field => !productData[field]);

                if (missingFields.length > 0) {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }

                // Check if product already exists (by SKU and store_id)
                const existingProduct = await Product.findOne({
                    sku: productData.sku,
                    store_id: productData.store_id
                });

                if (existingProduct) {
                    if (options.skipDuplicates) {
                        console.log(`${progress} ⏭️  SKIP: ${productData.name} (SKU: ${productData.sku}) - Already exists`);
                        skipped++;
                        continue;
                    } else if (options.updateExisting) {
                        if (!options.dryRun) {
                            // Update existing product
                            const updatedProduct = await Product.findByIdAndUpdate(
                                existingProduct._id,
                                {
                                    ...productData,
                                    updated_at: new Date()
                                },
                                { new: true, runValidators: true }
                            );
                            console.log(`${progress} 🔄 UPDATE: ${productData.name} (SKU: ${productData.sku})`);
                            updated++;
                        } else {
                            console.log(`${progress} 🔄 WOULD UPDATE: ${productData.name} (SKU: ${productData.sku})`);
                            updated++;
                        }
                    } else {
                        throw new Error(`Product with SKU ${productData.sku} already exists in store ${productData.store_id}`);
                    }
                } else {
                    // Create new product
                    if (!options.dryRun) {
                        const newProduct = new Product({
                            ...productData,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                        await newProduct.save();
                        console.log(`${progress} ➕ IMPORT: ${productData.name} (SKU: ${productData.sku})`);
                        imported++;
                    } else {
                        console.log(`${progress} ➕ WOULD IMPORT: ${productData.name} (SKU: ${productData.sku})`);
                        imported++;
                    }
                }

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
        console.log(`📁 File: ${path.resolve(options.filename)}`);
        console.log(`📦 Total Products: ${products.length}`);
        console.log(`➕ Imported: ${imported}`);
        console.log(`🔄 Updated: ${updated}`);
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

        if (options.dryRun) {
            console.log('\n🧪 This was a dry run - no changes were made to the database');
            console.log('💡 Remove --dry-run flag to perform the actual import');
        } else {
            console.log('\n🎉 Import completed successfully!');
        }

        // Show next steps
        if (!options.dryRun && (imported > 0 || updated > 0)) {
            console.log('\n💡 Next steps:');
            console.log('   1. Verify products in your application');
            console.log('   2. Check inventory levels and stock quantities');
            console.log('   3. Update any missing product images');
        }

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Show help if no arguments provided
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('📦 PRODUCT IMPORT SCRIPT');
    console.log('========================\n');
    console.log('Usage: node scripts/import-products.js <filename> [options]\n');
    console.log('Arguments:');
    console.log('  <filename>           JSON file containing products to import\n');
    console.log('Options:');
    console.log('  --store-id <id>      Override store_id for all products');
    console.log('  --created-by <id>    Override created_by for all products');
    console.log('  --dry-run           Show what would be imported without importing');
    console.log('  --skip-duplicates   Skip products that already exist (by SKU) [default]');
    console.log('  --update-existing   Update existing products instead of skipping');
    console.log('  --help, -h          Show this help message\n');
    console.log('Examples:');
    console.log('  node scripts/import-products.js products-export.json');
    console.log('  node scripts/import-products.js products.json --store-id new-store-123');
    console.log('  node scripts/import-products.js products.json --dry-run');
    console.log('  node scripts/import-products.js products.json --update-existing');
    process.exit(0);
}

// Run the import
if (require.main === module) {
    importProducts();
}

module.exports = { importProducts };
