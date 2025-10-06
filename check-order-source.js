const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrderSourceData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const Transaction = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));

        // Check recent transactions and their order_source field
        const recentTransactions = await Transaction.find({
            store_id: 'default-store'
        })
            .sort({ created_at: -1 })
            .limit(10)
            .select('_id total_amount order_source payment_method created_at');

        console.log('🔍 Recent Transactions Order Source:');
        recentTransactions.forEach(tx => {
            console.log({
                id: tx._id,
                total_amount: tx.total_amount,
                order_source: tx.order_source,
                payment_method: tx.payment_method,
                created_at: tx.created_at
            });
        });

        // Check the specific transaction you just created
        const yourTransaction = await Transaction.findById('68e3fef417676c27cc2905fc');
        console.log('\n🔍 Your Specific Transaction:');
        console.log({
            id: yourTransaction._id,
            total_amount: yourTransaction.total_amount,
            order_source: yourTransaction.order_source,
            payment_method: yourTransaction.payment_method,
            created_at: yourTransaction.created_at
        });

        // Test aggregation for order source breakdown
        const orderSourceAggregation = await Transaction.aggregate([
            {
                $match: {
                    store_id: 'default-store',
                    status: { $in: ['completed', 'pending'] }
                }
            },
            {
                $group: {
                    _id: '$order_source',
                    totalAmount: { $sum: '$total_amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('\n🔍 Order Source Aggregation:');
        console.log(JSON.stringify(orderSourceAggregation, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected');
    }
}

checkOrderSourceData();
