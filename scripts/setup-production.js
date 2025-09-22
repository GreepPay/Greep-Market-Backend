#!/usr/bin/env node

/**
 * Production Setup Script
 * Comprehensive setup for production deployment
 * Usage: node scripts/setup-production.js [options]
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const { User } = require('../dist/models/User');
const { Product } = require('../dist/models/Product');
const { Transaction } = require('../dist/models/Transaction');

const DEFAULT_ADMIN = {
    email: 'aguntawisdom@gmail.com',
    password: 'qwerty1234',
    role: 'admin',
    first_name: 'Admin',
    last_name: 'User'
};

const DEFAULT_STORE = {
    id: 'default-store',
    name: 'Main Store',
    address: 'Default Store Address',
    phone: '+1234567890'
};

async function setupAdmin(email = DEFAULT_ADMIN.email, password = DEFAULT_ADMIN.password) {
    try {
        console.log(`🔧 Setting up admin user: ${email}`);

        // Check if admin user already exists
        let adminUser = await User.findOne({ email });

        if (adminUser) {
            console.log(`👤 Admin user found: ${email}`);

            // Update existing user
            const hashedPassword = await bcrypt.hash(password, 12);

            adminUser.password_hash = hashedPassword;
            adminUser.role = 'admin';
            adminUser.is_active = true;
            adminUser.first_name = DEFAULT_ADMIN.first_name;
            adminUser.last_name = DEFAULT_ADMIN.last_name;
            adminUser.store_id = DEFAULT_STORE.id;
            adminUser.updated_at = new Date();

            await adminUser.save();
            console.log('✅ Admin user updated successfully');

        } else {
            console.log(`👤 Creating new admin user: ${email}`);

            // Create new admin user
            const hashedPassword = await bcrypt.hash(password, 12);

            adminUser = new User({
                email,
                password_hash: hashedPassword,
                role: 'admin',
                is_active: true,
                first_name: DEFAULT_ADMIN.first_name,
                last_name: DEFAULT_ADMIN.last_name,
                store_id: DEFAULT_STORE.id,
                created_at: new Date(),
                updated_at: new Date()
            });

            await adminUser.save();
            console.log('✅ Admin user created successfully');
        }

        return adminUser;
    } catch (error) {
        console.error('❌ Error setting up admin user:', error);
        throw error;
    }
}

async function createSampleData() {
    try {
        console.log('📦 Creating sample data...');

        // Check if sample products already exist
        const existingProducts = await Product.countDocuments();
        if (existingProducts > 0) {
            console.log(`📦 Found ${existingProducts} existing products, skipping sample data creation`);
            return;
        }

        const sampleProducts = [
            {
                name: 'Sample Product 1',
                description: 'This is a sample product for testing',
                sku: 'SAMPLE-001',
                price: 10.99,
                cost: 5.50,
                stock_quantity: 100,
                min_stock_level: 10,
                category: 'General',
                brand: 'Sample Brand',
                store_id: DEFAULT_STORE.id,
                is_active: true
            },
            {
                name: 'Sample Product 2',
                description: 'Another sample product for testing',
                sku: 'SAMPLE-002',
                price: 25.50,
                cost: 12.75,
                stock_quantity: 50,
                min_stock_level: 5,
                category: 'General',
                brand: 'Sample Brand',
                store_id: DEFAULT_STORE.id,
                is_active: true
            }
        ];

        for (const productData of sampleProducts) {
            const product = new Product(productData);
            await product.save();
            console.log(`✅ Created sample product: ${product.name}`);
        }

        console.log('✅ Sample data created successfully');
    } catch (error) {
        console.error('❌ Error creating sample data:', error);
        throw error;
    }
}

async function verifySetup() {
    try {
        console.log('🔍 Verifying setup...');

        // Check admin user
        const adminUser = await User.findOne({ email: DEFAULT_ADMIN.email });
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        console.log('✅ Admin user verified');

        // Check products
        const productCount = await Product.countDocuments();
        console.log(`✅ Found ${productCount} products`);

        // Check transactions
        const transactionCount = await Transaction.countDocuments();
        console.log(`✅ Found ${transactionCount} transactions`);

        console.log('✅ Setup verification completed');
    } catch (error) {
        console.error('❌ Setup verification failed:', error);
        throw error;
    }
}

async function displayCredentials() {
    console.log('\n🎉 Production setup completed successfully!');
    console.log('\n🔐 Admin Login Credentials:');
    console.log(`   Email: ${DEFAULT_ADMIN.email}`);
    console.log(`   Password: ${DEFAULT_ADMIN.password}`);
    console.log(`   Role: ${DEFAULT_ADMIN.role}`);
    console.log('\n🏪 Store Information:');
    console.log(`   Store ID: ${DEFAULT_STORE.id}`);
    console.log(`   Store Name: ${DEFAULT_STORE.name}`);
    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change the admin password after first login');
    console.log('   2. Ensure your MongoDB connection is secure');
    console.log('   3. Use HTTPS in production');
    console.log('   4. Set up proper environment variables');
    console.log('   5. Configure proper CORS settings');
}

async function main() {
    try {
        console.log('🚀 Starting production setup...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Setup admin user
        const adminUser = await setupAdmin();

        // Create sample data (optional)
        await createSampleData();

        // Verify setup
        await verifySetup();

        // Display credentials
        await displayCredentials();

    } catch (error) {
        console.error('❌ Production setup failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Handle command line arguments
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Production Setup Script

Usage: node scripts/setup-production.js [options]

Options:
  --help, -h     Show this help message
  --email        Admin email (default: ${DEFAULT_ADMIN.email})
  --password     Admin password (default: ${DEFAULT_ADMIN.password})

Examples:
  node scripts/setup-production.js
  node scripts/setup-production.js --email admin@example.com --password mypassword
    `);
        process.exit(0);
    }

    // Parse custom email and password if provided
    let customEmail = DEFAULT_ADMIN.email;
    let customPassword = DEFAULT_ADMIN.password;

    const emailIndex = args.indexOf('--email');
    if (emailIndex !== -1 && args[emailIndex + 1]) {
        customEmail = args[emailIndex + 1];
    }

    const passwordIndex = args.indexOf('--password');
    if (passwordIndex !== -1 && args[passwordIndex + 1]) {
        customPassword = args[passwordIndex + 1];
    }

    // Update defaults if custom values provided
    if (customEmail !== DEFAULT_ADMIN.email || customPassword !== DEFAULT_ADMIN.password) {
        DEFAULT_ADMIN.email = customEmail;
        DEFAULT_ADMIN.password = customPassword;
    }

    main();
}

module.exports = { setupAdmin, createSampleData, verifySetup };
