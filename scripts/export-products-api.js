#!/usr/bin/env node

/**
 * Product Export Script (API-based)
 * Exports products using the existing API endpoint
 * 
 * Usage: node scripts/export-products-api.js [options]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    apiUrl: process.env.API_URL || process.env.SERVER_URL || 'http://localhost:3001',
    output: null,
    token: null
};

args.forEach((arg, index) => {
    if (arg === '--api-url' && args[index + 1]) {
        options.apiUrl = args[index + 1];
    }
    if (arg === '--output' && args[index + 1]) {
        options.output = args[index + 1];
    }
    if (arg === '--token' && args[index + 1]) {
        options.token = args[index + 1];
    }
});

async function makeRequest(url, token = null) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;

        const requestOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        client.get(url, requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function exportProducts() {
    try {
        console.log('📦 PRODUCT EXPORT SCRIPT (API-BASED)');
        console.log('=====================================\n');

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

        // Fetch products from API
        console.log('📋 Fetching products from API...');
        let products;

        try {
            const response = await makeRequest(`${options.apiUrl}/api/v1/products?limit=1000`, options.token);

            if (response.success && response.data) {
                products = response.data.products || response.data;
            } else {
                throw new Error('Invalid API response format');
            }
        } catch (error) {
            console.error('❌ Failed to fetch products:', error.message);
            console.log('\n💡 Make sure the products API endpoint is working');
            console.log('   You can test it manually: curl http://localhost:3001/api/v1/products');
            process.exit(1);
        }

        if (!Array.isArray(products)) {
            console.error('❌ Error: API response is not an array of products');
            process.exit(1);
        }

        if (products.length === 0) {
            console.log('⚠️  No products found to export');
            return;
        }

        console.log(`✅ Found ${products.length} products to export\n`);

        // Generate output filename if not provided
        let outputFile = options.output;
        if (!outputFile) {
            const timestamp = new Date().toISOString().split('T')[0];
            outputFile = `products-export-api-${timestamp}.json`;
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

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
        console.log('   2. Run the import script: node scripts/import-products.js <filename>');

    } catch (error) {
        console.error('❌ Export failed:', error);
        process.exit(1);
    }
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log('📦 PRODUCT EXPORT SCRIPT (API-BASED)');
    console.log('=====================================\n');
    console.log('Usage: node scripts/export-products-api.js [options]\n');
    console.log('Options:');
    console.log('  --api-url <url>     API base URL (default: from API_URL or SERVER_URL env var, fallback: http://localhost:3001)');
    console.log('  --output <file>     Output file path');
    console.log('  --token <token>     Authentication token (if required)');
    console.log('  --help, -h          Show this help message\n');
    console.log('Environment Variables:');
    console.log('  API_URL             API base URL (e.g., https://api.example.com)');
    console.log('  SERVER_URL          Alternative to API_URL');
    console.log('Examples:');
    console.log('  node scripts/export-products-api.js');
    console.log('  node scripts/export-products-api.js --output my-products.json');
    console.log('  node scripts/export-products-api.js --api-url https://api.example.com');
    process.exit(0);
}

// Run the export
if (require.main === module) {
    exportProducts();
}

module.exports = { exportProducts };
