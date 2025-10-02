const mongoose = require('mongoose');
const Product = require('./src/models/Product').default;
const Transaction = require('./src/models/Transaction').default;

async function createSampleData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/greep-market');
        console.log('Connected to MongoDB');

        // Check if we already have products
        const existingProducts = await Product.countDocuments();
        console.log(`Found ${existingProducts} existing products`);

        if (existingProducts === 0) {
            console.log('Creating sample products...');

            // Create some sample products
            const sampleProducts = [
                {
                    name: 'Sample Product 1',
                    barcode: '1234567890',
                    price: 25.99,
                    category: 'Electronics',
                    stock_quantity: 50,
                    min_stock_level: 10,
                    store_id: 'default-store',
                    is_active: true
                },
                {
                    name: 'Sample Product 2',
                    barcode: '1234567891',
                    price: 15.50,
                    category: 'Food',
                    stock_quantity: 30,
                    min_stock_level: 5,
                    store_id: 'default-store',
                    is_active: true
                },
                {
                    name: 'Sample Product 3',
                    barcode: '1234567892',
                    price: 8.99,
                    category: 'Electronics',
                    stock_quantity: 5,
                    min_stock_level: 10,
                    store_id: 'default-store',
                    is_active: true
                }
            ];

            const createdProducts = await Product.insertMany(sampleProducts);
            console.log(`Created ${createdProducts.length} sample products`);
        }

        // Get products for creating transactions
        const products = await Product.find({ store_id: 'default-store' }).limit(3);
        console.log(`Found ${products.length} products for transactions`);

        if (products.length === 0) {
            console.log('No products found, cannot create transactions');
            return;
        }

        // Check if we already have transactions
        const existingTransactions = await Transaction.countDocuments();
        console.log(`Found ${existingTransactions} existing transactions`);

        if (existingTransactions === 0) {
            console.log('Creating sample transactions...');

            // Create some sample transactions
            const sampleTransactions = [
                {
                    store_id: 'default-store',
                    total_amount: products[0].price * 2,
                    payment_method: 'cash',
                    status: 'completed',
                    items: [
                        {
                            product_id: products[0]._id,
                            product_name: products[0].name,
                            quantity: 2,
                            unit_price: products[0].price,
                            total_price: products[0].price * 2
                        }
                    ],
                    created_at: new Date()
                },
                {
                    store_id: 'default-store',
                    total_amount: products[1].price * 3 + products[2].price * 1,
                    payment_method: 'card',
                    status: 'completed',
                    items: [
                        {
                            product_id: products[1]._id,
                            product_name: products[1].name,
                            quantity: 3,
                            unit_price: products[1].price,
                            total_price: products[1].price * 3
                        },
                        {
                            product_id: products[2]._id,
                            product_name: products[2].name,
                            quantity: 1,
                            unit_price: products[2].price,
                            total_price: products[2].price * 1
                        }
                    ],
                    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
                },
                {
                    store_id: 'default-store',
                    total_amount: products[0].price * 1,
                    payment_method: 'cash',
                    status: 'completed',
                    items: [
                        {
                            product_id: products[0]._id,
                            product_name: products[0].name,
                            quantity: 1,
                            unit_price: products[0].price,
                            total_price: products[0].price * 1
                        }
                    ],
                    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                }
            ];

            const createdTransactions = await Transaction.insertMany(sampleTransactions);
            console.log(`Created ${createdTransactions.length} sample transactions`);
        }

        console.log('Sample data creation completed successfully!');

    } catch (error) {
        console.error('Error creating sample data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createSampleData();


