const mongoose = require('mongoose');
require('dotenv').config();

// Import the Transaction model
const { Transaction } = require('../dist/models/Transaction');

async function clearAllSales() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB');

        // Get count of transactions before deletion
        const countBefore = await Transaction.countDocuments();
        console.log(`📊 Found ${countBefore} transactions to delete`);

        if (countBefore === 0) {
            console.log('ℹ️  No transactions found. Database is already clean.');
            return;
        }

        // Delete all transactions
        const result = await Transaction.deleteMany({});

        console.log(`🗑️  Deleted ${result.deletedCount} transactions successfully`);
        console.log('✅ Sales data cleared successfully!');

    } catch (error) {
        console.error('❌ Error clearing sales:', error);
        process.exit(1);
    } finally {
        // Close the database connection
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the script
clearAllSales();




