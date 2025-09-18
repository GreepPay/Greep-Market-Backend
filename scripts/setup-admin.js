#!/usr/bin/env node

/**
 * Admin Setup Script
 * Creates or updates an admin user for production deployment
 * Usage: node scripts/setup-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import the User model
const { User } = require('../dist/models/User');

const ADMIN_EMAIL = 'aguntawisdom@gmail.com';
const ADMIN_PASSWORD = 'qwerty1234';
const ADMIN_ROLE = 'admin';

async function setupAdmin() {
    try {
        console.log('🔧 Setting up admin user...');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Check if admin user already exists
        let adminUser = await User.findOne({ email: ADMIN_EMAIL });

        if (adminUser) {
            console.log(`👤 Admin user found: ${ADMIN_EMAIL}`);

            // Update existing user
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

            adminUser.password = hashedPassword;
            adminUser.role = ADMIN_ROLE;
            adminUser.is_active = true;
            adminUser.first_name = 'Admin';
            adminUser.last_name = 'User';
            adminUser.store_id = 'default-store';
            adminUser.updated_at = new Date();

            await adminUser.save();
            console.log('✅ Admin user updated successfully');

        } else {
            console.log(`👤 Creating new admin user: ${ADMIN_EMAIL}`);

            // Create new admin user
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

            adminUser = new User({
                email: ADMIN_EMAIL,
                password: hashedPassword,
                role: ADMIN_ROLE,
                is_active: true,
                first_name: 'Admin',
                last_name: 'User',
                store_id: 'default-store',
                created_at: new Date(),
                updated_at: new Date()
            });

            await adminUser.save();
            console.log('✅ Admin user created successfully');
        }

        // Display admin user details
        console.log('\n📋 Admin User Details:');
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Status: ${adminUser.is_active ? 'Active' : 'Inactive'}`);
        console.log(`   Store ID: ${adminUser.store_id}`);
        console.log(`   User ID: ${adminUser._id}`);
        console.log(`   Created: ${adminUser.created_at}`);
        console.log(`   Updated: ${adminUser.updated_at}`);

        console.log('\n🎉 Admin setup completed successfully!');
        console.log('\n🔐 Login Credentials:');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log('\n⚠️  Remember to change the password after first login!');

    } catch (error) {
        console.error('❌ Error setting up admin user:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the setup
if (require.main === module) {
    setupAdmin();
}

module.exports = { setupAdmin };
