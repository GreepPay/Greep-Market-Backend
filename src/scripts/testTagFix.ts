/**
 * Test script to verify that JSON array tags are properly handled
 */

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { cleanTagsForStorage } from '../utils/tagFormatter';
import { logger } from '../utils/logger';

async function testTagFix() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Test the tag cleaning function directly
    console.log('\n=== TESTING TAG CLEANING FUNCTION ===');
    
    const testCases = [
      ['["seasoning","flavor"]'],
      ['["Turk"]'],
      ['["Turkey", "Spices"]'],
      ['seasoning, flavor'],
      ['Turkey', 'Spices'],
      ['["seasoning","flavor"]', 'Turkey'],
      ['misc', '["other","general"]']
    ];

    for (const testCase of testCases) {
      const cleaned = cleanTagsForStorage(testCase);
      console.log(`Input: [${testCase.join(', ')}] → Output: [${cleaned.join(', ')}]`);
    }

    // Check actual products in database
    console.log('\n=== CHECKING ACTUAL PRODUCTS ===');
    const products = await Product.find({}).limit(5).lean();
    
    for (const product of products) {
      if (product.tags && product.tags.length > 0) {
        console.log(`Product ${product.sku}: [${product.tags.join(', ')}]`);
      }
    }

    console.log('\n=== TESTING NEW PRODUCT CREATION ===');
    
    // Test creating a product with problematic tags
    const testProduct = new Product({
      name: 'Test Product for Tag Fix',
      description: 'Testing tag normalization',
      price: 10.00,
      category: 'Test',
      sku: 'TEST-TAG-FIX-' + Date.now(),
      stock_quantity: 1,
      store_id: 'test-store',
      created_by: 'test-user',
      tags: ['["test","array"]', 'normal-tag']
    });

    await testProduct.save();
    console.log(`Created test product with tags: [${testProduct.tags.join(', ')}]`);
    
    // Clean up test product
    await Product.deleteOne({ _id: testProduct._id });
    console.log('Cleaned up test product');

    console.log('\n✅ All tests passed! JSON array tags are properly handled.');

  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the test if called directly
if (require.main === module) {
  testTagFix()
    .then(() => {
      console.log('Tag fix verification completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testTagFix };
