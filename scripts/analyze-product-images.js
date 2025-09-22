#!/usr/bin/env node

/**
 * Product Images Analysis Script
 * Analyzes product images in the exported data and identifies issues
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

async function checkImageUrl(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https://') ? https : http;

        const req = client.request(url, { method: 'HEAD' }, (res) => {
            resolve({
                url,
                status: res.statusCode,
                accessible: res.statusCode === 200,
                contentType: res.headers['content-type']
            });
        });

        req.on('error', (error) => {
            resolve({
                url,
                status: 'ERROR',
                accessible: false,
                error: error.message
            });
        });

        req.setTimeout(5000, () => {
            req.destroy();
            resolve({
                url,
                status: 'TIMEOUT',
                accessible: false,
                error: 'Request timeout'
            });
        });

        req.end();
    });
}

async function analyzeProductImages() {
    try {
        console.log('🖼️  PRODUCT IMAGES ANALYSIS SCRIPT');
        console.log('===================================\n');

        // Read the exported products file
        const filename = 'products-export-api-2025-09-22.json';

        if (!fs.existsSync(filename)) {
            console.error(`❌ File not found: ${filename}`);
            console.log('💡 Run the export script first: npm run export:products:api');
            process.exit(1);
        }

        console.log(`📖 Reading file: ${filename}`);
        const fileContent = fs.readFileSync(filename, 'utf8');
        const products = JSON.parse(fileContent);

        console.log(`✅ Loaded ${products.length} products\n`);

        // Analyze images
        let totalImages = 0;
        let productsWithImages = 0;
        let productsWithoutImages = 0;
        const imageUrls = new Set();
        const cloudinaryUrls = [];
        const invalidImages = [];

        console.log('🔍 Analyzing product images...\n');

        for (const product of products) {
            if (product.images && product.images.length > 0) {
                productsWithImages++;
                totalImages += product.images.length;

                for (const image of product.images) {
                    imageUrls.add(image.url);

                    if (image.url.includes('cloudinary.com')) {
                        cloudinaryUrls.push({
                            product: product.name,
                            sku: product.sku,
                            url: image.url,
                            public_id: image.public_id,
                            is_primary: image.is_primary
                        });
                    } else {
                        invalidImages.push({
                            product: product.name,
                            sku: product.sku,
                            url: image.url,
                            issue: 'Not a Cloudinary URL'
                        });
                    }
                }
            } else {
                productsWithoutImages++;
            }
        }

        console.log('📊 IMAGE ANALYSIS SUMMARY');
        console.log('=========================');
        console.log(`📦 Total Products: ${products.length}`);
        console.log(`🖼️  Products with Images: ${productsWithImages}`);
        console.log(`❌ Products without Images: ${productsWithoutImages}`);
        console.log(`📸 Total Images: ${totalImages}`);
        console.log(`🔗 Unique Image URLs: ${imageUrls.size}`);
        console.log(`☁️  Cloudinary URLs: ${cloudinaryUrls.length}`);
        console.log(`⚠️  Invalid Images: ${invalidImages.length}`);

        // Group by Cloudinary account
        const cloudinaryAccounts = {};
        cloudinaryUrls.forEach(img => {
            const match = img.url.match(/https:\/\/([^\.]+)\.cloudinary\.com/);
            if (match) {
                const account = match[1];
                if (!cloudinaryAccounts[account]) {
                    cloudinaryAccounts[account] = [];
                }
                cloudinaryAccounts[account].push(img);
            }
        });

        if (cloudinaryUrls.length > 0) {
            console.log('\n☁️  CLOUDINARY IMAGES');
            console.log('====================');

            Object.entries(cloudinaryAccounts).forEach(([account, images]) => {
                console.log(`\n📁 Account: ${account}`);
                console.log(`   Images: ${images.length}`);
                console.log(`   Sample URL: ${images[0].url}`);
            });

            // Test a few image URLs
            console.log('\n🧪 TESTING IMAGE ACCESSIBILITY');
            console.log('==============================');

            const testImages = cloudinaryUrls.slice(0, 3); // Test first 3 images
            for (const img of testImages) {
                console.log(`\n🔍 Testing: ${img.product}`);
                console.log(`   URL: ${img.url}`);

                const result = await checkImageUrl(img.url);
                if (result.accessible) {
                    console.log(`   ✅ Status: ${result.status} (${result.contentType})`);
                } else {
                    console.log(`   ❌ Status: ${result.status} - ${result.error}`);
                }
            }
        }

        if (invalidImages.length > 0) {
            console.log('\n⚠️  INVALID IMAGES');
            console.log('==================');
            invalidImages.forEach(img => {
                console.log(`❌ ${img.product} (${img.sku}): ${img.issue}`);
                console.log(`   URL: ${img.url}`);
            });
        }

        // Check for common issues
        console.log('\n🔧 COMMON ISSUES FOUND');
        console.log('======================');

        const issues = [];

        // Check for extra _id fields in images
        const hasExtraIds = products.some(p =>
            p.images && p.images.some(img => img._id !== undefined)
        );

        if (hasExtraIds) {
            issues.push('❌ Images contain extra _id fields (should be removed during import)');
        }

        // Check for missing thumbnail_url
        const missingThumbnails = cloudinaryUrls.filter(img => !img.url.includes('/w_') && !img.url.includes('/h_'));
        if (missingThumbnails.length > 0) {
            issues.push(`⚠️  ${missingThumbnails.length} images don't have thumbnail URLs (may cause slow loading)`);
        }

        // Check for different Cloudinary accounts
        const accounts = Object.keys(cloudinaryAccounts || {});
        if (accounts.length > 1) {
            issues.push(`⚠️  Images from ${accounts.length} different Cloudinary accounts: ${accounts.join(', ')}`);
        }

        if (issues.length > 0) {
            issues.forEach(issue => console.log(issue));
        } else {
            console.log('✅ No major issues found!');
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS');
        console.log('==================');

        if (cloudinaryUrls.length > 0) {
            console.log('1. ✅ Images are using Cloudinary (good!)');
            console.log('2. 🔧 Ensure your production environment has access to the same Cloudinary account');
            console.log('3. 🔧 Check that CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set');
            console.log('4. 🔧 Consider creating thumbnail URLs for better performance');
        }

        if (productsWithoutImages > 0) {
            console.log(`5. 📸 ${productsWithoutImages} products have no images - consider adding placeholder images`);
        }

        console.log('6. 🔧 Clean up extra _id fields from images during import');
        console.log('7. 🔧 Test image URLs in your production environment');

    } catch (error) {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    }
}

// Run the analysis
if (require.main === module) {
    analyzeProductImages();
}

module.exports = { analyzeProductImages };
