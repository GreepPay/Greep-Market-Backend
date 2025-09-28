/**
 * Database migration script to normalize existing product tags
 * Run this script to merge similar tags like "turkey", "Turkey", "Turk" into one
 */

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { normalizeTags, findSimilarTags, getTagStatistics } from '../utils/tagNormalizer';
import { logger } from '../utils/logger';

interface TagNormalizationReport {
  totalProducts: number;
  productsUpdated: number;
  tagsBefore: number;
  tagsAfter: number;
  similarGroups: Array<{
    normalized: string;
    originals: string[];
    suggestion: string;
    count: number;
  }>;
  errors: string[];
}

class TagNormalizationService {
  private report: TagNormalizationReport = {
    totalProducts: 0,
    productsUpdated: 0,
    tagsBefore: 0,
    tagsAfter: 0,
    similarGroups: [],
    errors: []
  };

  async normalizeAllTags(dryRun: boolean = true): Promise<TagNormalizationReport> {
    try {
      logger.info(`Starting tag normalization (dry run: ${dryRun})`);
      
      // Get all products
      const products = await Product.find({}).lean();
      this.report.totalProducts = products.length;
      
      logger.info(`Found ${products.length} products to process`);
      
      // Collect all unique tags for analysis
      const allTags: string[] = [];
      for (const product of products) {
        if (product.tags && Array.isArray(product.tags)) {
          allTags.push(...product.tags);
        }
      }
      
      this.report.tagsBefore = new Set(allTags).size;
      
      // Find similar tag groups
      const similarGroups = findSimilarTags(allTags);
      this.report.similarGroups = similarGroups.map(group => ({
        ...group,
        count: group.originals.length
      }));
      
      logger.info(`Found ${similarGroups.length} groups of similar tags`);
      
      // Show similar groups
      for (const group of similarGroups) {
        logger.info(`Similar tags: [${group.originals.join(', ')}] → "${group.suggestion}"`);
      }
      
      if (dryRun) {
        logger.info('DRY RUN - No changes made to database');
        return this.report;
      }
      
      // Update products
      let updatedCount = 0;
      for (const product of products) {
        try {
          if (product.tags && Array.isArray(product.tags) && product.tags.length > 0) {
            const originalTags = [...product.tags];
            const normalizedTags = normalizeTags(product.tags);
            
            // Only update if tags actually changed
            if (JSON.stringify(originalTags.sort()) !== JSON.stringify(normalizedTags.sort())) {
              await Product.updateOne(
                { _id: product._id },
                { $set: { tags: normalizedTags } }
              );
              updatedCount++;
              
              logger.info(`Updated product ${product.sku}: [${originalTags.join(', ')}] → [${normalizedTags.join(', ')}]`);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to update product ${product._id}: ${error}`;
          logger.error(errorMsg);
          this.report.errors.push(errorMsg);
        }
      }
      
      this.report.productsUpdated = updatedCount;
      
      // Recalculate tag statistics
      const updatedProducts = await Product.find({}).lean();
      const allUpdatedTags: string[] = [];
      for (const product of updatedProducts) {
        if (product.tags && Array.isArray(product.tags)) {
          allUpdatedTags.push(...product.tags);
        }
      }
      this.report.tagsAfter = new Set(allUpdatedTags).size;
      
      logger.info(`Tag normalization completed. Updated ${updatedCount} products.`);
      logger.info(`Tags reduced from ${this.report.tagsBefore} to ${this.report.tagsAfter} unique tags.`);
      
      return this.report;
      
    } catch (error) {
      logger.error('Tag normalization failed:', error);
      throw error;
    }
  }

  async normalizeTagsForStore(storeId: string, dryRun: boolean = true): Promise<TagNormalizationReport> {
    try {
      logger.info(`Starting tag normalization for store ${storeId} (dry run: ${dryRun})`);
      
      // Get all products for the store
      const products = await Product.find({ store_id: storeId }).lean();
      this.report.totalProducts = products.length;
      
      logger.info(`Found ${products.length} products for store ${storeId}`);
      
      // Collect all unique tags for analysis
      const allTags: string[] = [];
      for (const product of products) {
        if (product.tags && Array.isArray(product.tags)) {
          allTags.push(...product.tags);
        }
      }
      
      this.report.tagsBefore = new Set(allTags).size;
      
      // Find similar tag groups
      const similarGroups = findSimilarTags(allTags);
      this.report.similarGroups = similarGroups.map(group => ({
        ...group,
        count: group.originals.length
      }));
      
      logger.info(`Found ${similarGroups.length} groups of similar tags for store ${storeId}`);
      
      // Show similar groups
      for (const group of similarGroups) {
        logger.info(`Similar tags: [${group.originals.join(', ')}] → "${group.suggestion}"`);
      }
      
      if (dryRun) {
        logger.info('DRY RUN - No changes made to database');
        return this.report;
      }
      
      // Update products
      let updatedCount = 0;
      for (const product of products) {
        try {
          if (product.tags && Array.isArray(product.tags) && product.tags.length > 0) {
            const originalTags = [...product.tags];
            const normalizedTags = normalizeTags(product.tags);
            
            // Only update if tags actually changed
            if (JSON.stringify(originalTags.sort()) !== JSON.stringify(normalizedTags.sort())) {
              await Product.updateOne(
                { _id: product._id },
                { $set: { tags: normalizedTags } }
              );
              updatedCount++;
              
              logger.info(`Updated product ${product.sku}: [${originalTags.join(', ')}] → [${normalizedTags.join(', ')}]`);
            }
          }
        } catch (error) {
          const errorMsg = `Failed to update product ${product._id}: ${error}`;
          logger.error(errorMsg);
          this.report.errors.push(errorMsg);
        }
      }
      
      this.report.productsUpdated = updatedCount;
      
      // Recalculate tag statistics
      const updatedProducts = await Product.find({ store_id: storeId }).lean();
      const allUpdatedTags: string[] = [];
      for (const product of updatedProducts) {
        if (product.tags && Array.isArray(product.tags)) {
          allUpdatedTags.push(...product.tags);
        }
      }
      this.report.tagsAfter = new Set(allUpdatedTags).size;
      
      logger.info(`Tag normalization for store ${storeId} completed. Updated ${updatedCount} products.`);
      logger.info(`Tags reduced from ${this.report.tagsBefore} to ${this.report.tagsAfter} unique tags.`);
      
      return this.report;
      
    } catch (error) {
      logger.error(`Tag normalization for store ${storeId} failed:`, error);
      throw error;
    }
  }

  printReport(report: TagNormalizationReport): void {
    console.log('\n=== TAG NORMALIZATION REPORT ===');
    console.log(`Total products processed: ${report.totalProducts}`);
    console.log(`Products updated: ${report.productsUpdated}`);
    console.log(`Tags before: ${report.tagsBefore}`);
    console.log(`Tags after: ${report.tagsAfter}`);
    console.log(`Tags reduced by: ${report.tagsBefore - report.tagsAfter}`);
    console.log(`Similar tag groups found: ${report.similarGroups.length}`);
    
    if (report.similarGroups.length > 0) {
      console.log('\nSimilar tag groups:');
      for (const group of report.similarGroups) {
        console.log(`  [${group.originals.join(', ')}] → "${group.suggestion}"`);
      }
    }
    
    if (report.errors.length > 0) {
      console.log('\nErrors:');
      for (const error of report.errors) {
        console.log(`  - ${error}`);
      }
    }
    
    console.log('\n================================\n');
  }
}

// CLI interface
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/market-management';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    const service = new TagNormalizationService();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    const storeId = args.find(arg => arg.startsWith('--store='))?.split('=')[1];
    
    if (dryRun) {
      console.log('Running in DRY RUN mode. Use --execute to make actual changes.');
    }
    
    let report: TagNormalizationReport;
    
    if (storeId) {
      report = await service.normalizeTagsForStore(storeId, dryRun);
    } else {
      report = await service.normalizeAllTags(dryRun);
    }
    
    service.printReport(report);
    
  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { TagNormalizationService };
