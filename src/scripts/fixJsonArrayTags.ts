/**
 * Quick fix script for JSON array tags like ["seasoning","flavor"]
 */

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { cleanTagsForStorage } from '../utils/tagFormatter';
import { logger } from '../utils/logger';

async function fixJsonArrayTags() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Find products with JSON array tags
    const products = await Product.find({}).lean();
    let fixedCount = 0;
    const issues: Array<{
      productId: string;
      sku: string;
      originalTags: any;
      fixedTags: string[];
    }> = [];

    for (const product of products) {
      if (product.tags && Array.isArray(product.tags)) {
        let hasJsonArrayIssue = false;
        const originalTags = [...product.tags];

        // Check if any tag looks like a JSON array string
        for (let i = 0; i < product.tags.length; i++) {
          const tag = product.tags[i];
          if (typeof tag === 'string' && tag.startsWith('[') && tag.endsWith(']')) {
            hasJsonArrayIssue = true;
            break;
          }
        }

        if (hasJsonArrayIssue) {
          // Clean and normalize the tags
          const cleanedTags = cleanTagsForStorage(product.tags);
          
          // Update the product
          await Product.updateOne(
            { _id: product._id },
            { $set: { tags: cleanedTags } }
          );

          fixedCount++;
          issues.push({
            productId: product._id.toString(),
            sku: product.sku,
            originalTags,
            fixedTags: cleanedTags
          });

          logger.info(`Fixed product ${product.sku}:`, {
            original: originalTags,
            fixed: cleanedTags
          });
        }
      }
    }

    console.log('\n=== JSON ARRAY TAGS FIX REPORT ===');
    console.log(`Total products checked: ${products.length}`);
    console.log(`Products fixed: ${fixedCount}`);
    
    if (issues.length > 0) {
      console.log('\nFixed products:');
      issues.forEach(issue => {
        console.log(`  ${issue.sku}: [${issue.originalTags.join(', ')}] → [${issue.fixedTags.join(', ')}]`);
      });
    }
    
    console.log('\n===============================\n');

  } catch (error) {
    logger.error('Fix script failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the script if called directly
if (require.main === module) {
  fixJsonArrayTags()
    .then(() => {
      console.log('JSON array tags fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fix script failed:', error);
      process.exit(1);
    });
}

export { fixJsonArrayTags };
