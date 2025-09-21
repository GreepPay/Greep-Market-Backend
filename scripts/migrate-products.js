#!/usr/bin/env node

/**
 * Product Migration Script
 * Copies products from development environment to production environment
 * 
 * Usage: node scripts/migrate-products.js
 * 
 * Environment Variables Required:
 * - DEV_MONGODB_URI: Development database connection string
 * - PROD_MONGODB_URI: Production database connection string
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Product Schema (matching your existing schema)
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    cost_price: { type: Number, default: 0 },
    category: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, default: '' },
    stock_quantity: { type: Number, default: 0 },
    min_stock_level: { type: Number, default: 5 },
    max_stock_level: { type: Number, default: 100 },
    unit: { type: String, default: 'piece' },
    weight: { type: Number, default: 0 },
    dimensions: {
        length: { type: Number, default: 0 },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 }
    },
    images: [{ type: String }],
    tags: [{ type: String }],
    is_active: { type: Boolean, default: true },
    is_featured: { type: Boolean, default: false },
    supplier: {
        name: { type: String, default: '' },
        contact: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' }
    },
    tax_rate: { type: Number, default: 0 },
    discount_percentage: { type: Number, default: 0 },
    expiry_date: { type: Date },
    created_by: { type: String, required: true },
    store_id: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

class ProductMigrator {
    constructor() {
        this.devConnection = null;
        this.prodConnection = null;
        this.stats = {
            total: 0,
            migrated: 0,
            skipped: 0,
            errors: 0
        };
    }

    async connect() {
        console.log('🔌 Connecting to databases...');

        try {
            // Connect to development database
            this.devConnection = await mongoose.createConnection(process.env.DEV_MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ Connected to development database');

            // Connect to production database
            this.prodConnection = await mongoose.createConnection(process.env.PROD_MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ Connected to production database');

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    async getProducts() {
        console.log('📦 Fetching products from development database...');

        try {
            const DevProduct = this.devConnection.model('Product', productSchema);
            const products = await DevProduct.find({}).lean();

            this.stats.total = products.length;
            console.log(`📊 Found ${products.length} products to migrate`);

            return products;
        } catch (error) {
            console.error('❌ Failed to fetch products:', error.message);
            throw error;
        }
    }

    async migrateProduct(product) {
        try {
            const ProdProduct = this.prodConnection.model('Product', productSchema);

            // Check if product already exists
            const existingProduct = await ProdProduct.findOne({ sku: product.sku });

            if (existingProduct) {
                console.log(`⏭️  Skipping product "${product.name}" - SKU ${product.sku} already exists`);
                this.stats.skipped++;
                return;
            }

            // Remove _id and __v to avoid conflicts
            const productData = { ...product };
            delete productData._id;
            delete productData.__v;

            // Create new product in production
            const newProduct = new ProdProduct(productData);
            await newProduct.save();

            console.log(`✅ Migrated: "${product.name}" (SKU: ${product.sku})`);
            this.stats.migrated++;

        } catch (error) {
            console.error(`❌ Failed to migrate product "${product.name}":`, error.message);
            this.stats.errors++;
        }
    }

    async migrateAllProducts(products) {
        console.log('🚀 Starting product migration...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const progress = `[${i + 1}/${products.length}]`;

            process.stdout.write(`${progress} Migrating "${product.name}"... `);
            await this.migrateProduct(product);

            // Add small delay to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    async validateMigration() {
        console.log('🔍 Validating migration...');

        try {
            const DevProduct = this.devConnection.model('Product', productSchema);
            const ProdProduct = this.prodConnection.model('Product', productSchema);

            const devCount = await DevProduct.countDocuments();
            const prodCount = await ProdProduct.countDocuments();

            console.log(`📊 Development products: ${devCount}`);
            console.log(`📊 Production products: ${prodCount}`);

            if (prodCount >= devCount) {
                console.log('✅ Migration validation successful!');
            } else {
                console.log('⚠️  Migration may be incomplete - production has fewer products than development');
            }

        } catch (error) {
            console.error('❌ Validation failed:', error.message);
        }
    }

    async disconnect() {
        console.log('🔌 Disconnecting from databases...');

        try {
            if (this.devConnection) {
                await this.devConnection.close();
                console.log('✅ Disconnected from development database');
            }

            if (this.prodConnection) {
                await this.prodConnection.close();
                console.log('✅ Disconnected from production database');
            }
        } catch (error) {
            console.error('❌ Error disconnecting:', error.message);
        }
    }

    printSummary() {
        console.log('\n📋 MIGRATION SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📦 Total products: ${this.stats.total}`);
        console.log(`✅ Successfully migrated: ${this.stats.migrated}`);
        console.log(`⏭️  Skipped (already exist): ${this.stats.skipped}`);
        console.log(`❌ Errors: ${this.stats.errors}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (this.stats.errors > 0) {
            console.log('⚠️  Some products failed to migrate. Check the logs above for details.');
        } else {
            console.log('🎉 Migration completed successfully!');
        }
    }
}

async function main() {
    console.log('🚀 PRODUCT MIGRATION SCRIPT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate environment variables
    if (!process.env.DEV_MONGODB_URI) {
        console.error('❌ DEV_MONGODB_URI environment variable is required');
        process.exit(1);
    }

    if (!process.env.PROD_MONGODB_URI) {
        console.error('❌ PROD_MONGODB_URI environment variable is required');
        process.exit(1);
    }

    const migrator = new ProductMigrator();

    try {
        // Step 1: Connect to databases
        await migrator.connect();

        // Step 2: Get products from development
        const products = await migrator.getProducts();

        if (products.length === 0) {
            console.log('ℹ️  No products found in development database');
            return;
        }

        // Step 3: Confirm migration
        console.log('\n⚠️  WARNING: This will copy all products from development to production!');
        console.log('Products with existing SKUs will be skipped.');
        console.log('Make sure you have backed up your production database before proceeding.\n');

        // In a real scenario, you might want to add a confirmation prompt here
        // For now, we'll proceed automatically

        // Step 4: Migrate products
        await migrator.migrateAllProducts(products);

        // Step 5: Validate migration
        await migrator.validateMigration();

        // Step 6: Print summary
        migrator.printSummary();

    } catch (error) {
        console.error('💥 Migration failed:', error.message);
        process.exit(1);
    } finally {
        await migrator.disconnect();
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n⚠️  Migration interrupted by user');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});

// Run the migration
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ProductMigrator;
