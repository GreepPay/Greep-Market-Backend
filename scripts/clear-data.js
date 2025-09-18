const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { Transaction } = require('../dist/models/Transaction');
const { Product } = require('../dist/models/Product');
const { User } = require('../dist/models/User');
const { Expense } = require('../dist/models/Expense');

async function clearData(options = {}) {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const results = {};

        // Clear transactions/sales
        if (options.clearSales !== false) {
            const salesCount = await Transaction.countDocuments();
            if (salesCount > 0) {
                const salesResult = await Transaction.deleteMany({});
                results.sales = salesResult.deletedCount;
                console.log(`🗑️  Cleared ${salesResult.deletedCount} sales/transactions`);
            } else {
                results.sales = 0;
                console.log('ℹ️  No sales/transactions to clear');
            }
        }

        // Clear products
        if (options.clearProducts) {
            const productsCount = await Product.countDocuments();
            if (productsCount > 0) {
                const productsResult = await Product.deleteMany({});
                results.products = productsResult.deletedCount;
                console.log(`🗑️  Cleared ${productsResult.deletedCount} products`);
            } else {
                results.products = 0;
                console.log('ℹ️  No products to clear');
            }
        }

        // Clear expenses
        if (options.clearExpenses) {
            const expensesCount = await Expense.countDocuments();
            if (expensesCount > 0) {
                const expensesResult = await Expense.deleteMany({});
                results.expenses = expensesResult.deletedCount;
                console.log(`🗑️  Cleared ${expensesResult.deletedCount} expenses`);
            } else {
                results.expenses = 0;
                console.log('ℹ️  No expenses to clear');
            }
        }

        // Clear users (excluding admin users)
        if (options.clearUsers) {
            const usersCount = await User.countDocuments({ role: { $ne: 'admin' } });
            if (usersCount > 0) {
                const usersResult = await User.deleteMany({ role: { $ne: 'admin' } });
                results.users = usersResult.deletedCount;
                console.log(`🗑️  Cleared ${usersResult.deletedCount} non-admin users`);
            } else {
                results.users = 0;
                console.log('ℹ️  No non-admin users to clear');
            }
        }

        // Clear by store ID
        if (options.storeId) {
            const storeSalesCount = await Transaction.countDocuments({ store_id: options.storeId });
            const storeProductsCount = await Product.countDocuments({ store_id: options.storeId });
            const storeExpensesCount = await Expense.countDocuments({ store_id: options.storeId });

            if (storeSalesCount > 0) {
                await Transaction.deleteMany({ store_id: options.storeId });
                console.log(`🗑️  Cleared ${storeSalesCount} sales for store: ${options.storeId}`);
            }

            if (storeProductsCount > 0) {
                await Product.deleteMany({ store_id: options.storeId });
                console.log(`🗑️  Cleared ${storeProductsCount} products for store: ${options.storeId}`);
            }

            if (storeExpensesCount > 0) {
                await Expense.deleteMany({ store_id: options.storeId });
                console.log(`🗑️  Cleared ${storeExpensesCount} expenses for store: ${options.storeId}`);
            }
        }

        console.log('✅ Data clearing completed successfully!');
        console.log('📊 Summary:', results);

    } catch (error) {
        console.error('❌ Error clearing data:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    clearSales: true, // Default to clearing sales
    clearProducts: args.includes('--products'),
    clearExpenses: args.includes('--expenses'),
    clearUsers: args.includes('--users'),
    storeId: args.find(arg => arg.startsWith('--store='))?.split('=')[1]
};

console.log('🚀 Starting data clearing process...');
console.log('📋 Options:', options);

clearData(options);
