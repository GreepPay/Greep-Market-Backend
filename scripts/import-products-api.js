#!/usr/bin/env node

/**
 * Product Import Script (API-based)
 * Imports products using the existing API endpoint
 * 
 * Usage: node scripts/import-products-api.js <filename> [options]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    filename: null,
    apiUrl: 'http://localhost:3001',
    token: null,
    dryRun: false
};

// Get filename (first argument)
if (args[0] && !args[0].startsWith('--')) {
    options.filename = args[0];
}

// Parse other arguments
args.forEach((arg, index) => {
    if (arg === '--api-url' && args[index + 1]) {
        options.apiUrl = args[index + 1];
    }
    if (arg === '--token' && args[index + 1]) {
        options.token = args[index + 1];
    }
    if (arg === '--dry-run') {
        options.dryRun = true;
    }
});

async function makeRequest(url, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;

        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const req = client.request(url, requestOptions, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function importProducts() {
    try {
        console.log('📦 PRODUCT IMPORT SCRIPT (API-BASED)');
        console.log('====================================\n');

        // Validate filename
        if (!options.filename) {
            console.error('❌ Error: Please provide a JSON file to import');
            console.log('\nUsage: node scripts/import-products-api.js <filename> [options]');
            console.log('\nExample: node scripts/import-products-api.js products-export-api-2025-09-22.json');
            process.exit(1);
        }

        // Check if file exists
        if (!fs.existsSync(options.filename)) {
            console.error(`❌ Error: File not found: ${options.filename}`);
            process.exit(1);
        }

        console.log(`🔗 Using API URL: ${options.apiUrl}`);

        // Test API connection
        console.log('🔌 Testing API connection...');
        try {
            const healthResponse = await makeRequest(`${options.apiUrl}/health`);
            console.log('✅ API connection successful\n');
        } catch (error) {
            console.error('❌ Failed to connect to API:', error.message);
            console.log('\n💡 Make sure your server is running: npm run dev');
            process.exit(1);
        }

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
        console.log(`🔗 API URL: ${options.apiUrl}`);
        console.log(`🧪 Dry Run: ${options.dryRun ? 'Yes (no changes will be made)' : 'No (will import to database)'}`);
        console.log('');

        if (options.dryRun) {
            console.log('🧪 DRY RUN MODE - No changes will be made to the database\n');
        }

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

                if (options.dryRun) {
                    console.log(`${progress} ➕ WOULD IMPORT: ${productData.name} (SKU: ${productData.sku})`);
                    imported++;
                    continue;
                }

                // Check if product already exists by fetching from API
                try {
                    const existingResponse = await makeRequest(
                        `${options.apiUrl}/api/v1/products?sku=${encodeURIComponent(productData.sku)}`,
                        'GET',
                        null,
                        options.token
                    );

                    if (existingResponse.data.success && existingResponse.data.data && existingResponse.data.data.length > 0) {
                        console.log(`${progress} ⏭️  SKIP: ${productData.name} (SKU: ${productData.sku}) - Already exists`);
                        skipped++;
                        continue;
                    }
                } catch (checkError) {
                    // If we can't check, continue with import attempt
                    console.log(`${progress} ⚠️  WARNING: Could not check if product exists, proceeding with import`);
                }

                // Create new product via API
                const createResponse = await makeRequest(
                    `${options.apiUrl}/api/v1/products`,
                    'POST',
                    productData,
                    options.token
                );

                if (createResponse.status === 201 || createResponse.status === 200) {
                    console.log(`${progress} ➕ IMPORT: ${productData.name} (SKU: ${productData.sku})`);
                    imported++;
                } else {
                    throw new Error(`API returned status ${createResponse.status}: ${JSON.stringify(createResponse.data)}`);
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
        if (!options.dryRun && imported > 0) {
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
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('📦 PRODUCT IMPORT SCRIPT (API-BASED)');
    console.log('====================================\n');
    console.log('Usage: node scripts/import-products-api.js <filename> [options]\n');
    console.log('Arguments:');
    console.log('  <filename>           JSON file containing products to import\n');
    console.log('Options:');
    console.log('  --api-url <url>      API base URL (default: http://localhost:3001)');
    console.log('  --token <token>      Authentication token (if required)');
    console.log('  --dry-run           Show what would be imported without importing');
    console.log('  --help, -h          Show this help message\n');
    console.log('Examples:');
    console.log('  node scripts/import-products-api.js products-export-api.json');
    console.log('  node scripts/import-products-api.js products.json --api-url https://api.example.com');
    console.log('  node scripts/import-products-api.js products.json --dry-run');
    process.exit(0);
}

// Run the import
if (require.main === module) {
    importProducts();
}

module.exports = { importProducts };
