const mongoose = require('mongoose');
require('dotenv').config();

async function testWithDateFilter() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const Transaction = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));

        // Check the date range of existing transactions
        const dateRange = await Transaction.aggregate([
            { $match: { store_id: 'default-store' } },
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$created_at' },
                    maxDate: { $max: '$created_at' }
                }
            }
        ]);

        console.log('📅 Transaction date range:');
        console.log('Min date:', dateRange[0]?.minDate);
        console.log('Max date:', dateRange[0]?.maxDate);

        // Test with Last 30 Days filter (from today)
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        console.log('\n📅 Last 30 days range:');
        console.log('From:', thirtyDaysAgo);
        console.log('To:', today);

        // Test aggregation with date filter
        const topProductsWithDateFilter = await Transaction.aggregate([
            {
                $match: {
                    store_id: 'default-store',
                    status: { $in: ['completed', 'pending'] },
                    created_at: { $gte: thirtyDaysAgo, $lte: today }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product_id',
                    productName: { $first: '$items.product_name' },
                    quantitySold: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.quantity', '$items.unit_price'] } }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
            {
                $project: {
                    productId: '$_id',
                    productName: 1,
                    quantitySold: 1,
                    revenue: 1,
                    _id: 0
                }
            }
        ]);

        console.log('\n🔍 Aggregation with Last 30 Days filter:');
        console.log('Count:', topProductsWithDateFilter.length);
        console.log(JSON.stringify(topProductsWithDateFilter, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected');
    }
}

testWithDateFilter();

