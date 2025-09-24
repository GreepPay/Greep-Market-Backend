import { Router, Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/productService';
import { AuditService } from '../services/auditService';
import { uploadMultiple, uploadJsonFile } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Create a new product
 * POST /api/v1/products
 */
router.post('/', uploadMultiple('images', 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, category, sku, barcode, stock_quantity, store_id, created_by, tags } = req.body;
    const images = req.files as Express.Multer.File[];

    // Check for required fields - allow empty strings but not undefined/null
    if (name === undefined || name === null || 
        price === undefined || price === null || 
        category === undefined || category === null || 
        sku === undefined || sku === null || 
        stock_quantity === undefined || stock_quantity === null || 
        store_id === undefined || store_id === null || 
        created_by === undefined || created_by === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, price, category, sku, stock_quantity, store_id, created_by'
      });
    }

    // Parse tags if provided (could be string or array)
    let parsedTags: string[] = [];
    if (tags) {
      if (typeof tags === 'string') {
        // If tags is a string, split by comma and clean up
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        // If tags is already an array, clean up each tag
        parsedTags = tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
      }
    }

    const product = await ProductService.createProduct({
      name: name || 'Unnamed Product',
      description: description || '', // Always provide empty string if not provided
      price: parseFloat(price) || 0,
      category: category || 'Uncategorized',
      sku: sku || `SKU-IMPORT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      barcode: barcode || undefined,
      stock_quantity: parseInt(stock_quantity) || 0,
      store_id: store_id || 'default-store',
      created_by: created_by || 'default-user',
      tags: parsedTags,
      images,
    });
    
    // Log the creation action
    await AuditService.logCreate(
      req,
      'PRODUCT',
      product._id.toString(),
      product.name
    );

    res.status(201).json({
    success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all products with filters
 * GET /api/v1/products
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      store_id, 
      category, 
      search, 
      is_active, 
      is_featured, 
      sortBy, 
      sortOrder 
    } = req.query;

    const result = await ProductService.getProducts({
      store_id: store_id as string,
      category: category as string,
      search: search as string,
      is_active: is_active ? is_active === 'true' : undefined,
      is_featured: is_featured ? is_featured === 'true' : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Export all products for a store
 * GET /api/v1/products/export
 */
router.get('/export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get store_id from authenticated user or query parameter
    const store_id = req.user?.storeId || req.query.store_id as string || 'default-store';

    const exportData = await ProductService.exportProducts(store_id as string);

    // Set headers for file download
    const filename = `products-export-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json({
      success: true,
      message: `Successfully exported ${exportData.totalProducts} products`,
      data: exportData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get product by ID
 * GET /api/v1/products/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await ProductService.getProductById(id);
  
  if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
  }

  res.json({
    success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update product
 * PUT /api/v1/products/:id
 */
router.put('/:id', uploadMultiple('images', 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const newImages = req.files as Express.Multer.File[];
    const replaceImages = updateData.replace_images === 'true' || updateData.replace_images === true;

    // Get the old product data for audit logging
    const oldProduct = await ProductService.getProductById(id);
    
    // Handle image replacement if new images are provided
    if (newImages && newImages.length > 0) {
      if (replaceImages) {
        // Delete existing images from Cloudinary and database
        await ProductService.replaceProductImages(id, newImages);
      } else {
        // Add new images to existing ones
        for (let i = 0; i < newImages.length; i++) {
          await ProductService.addProductImage(id, newImages[i], i === 0);
        }
      }
    }

    // Remove images from updateData since they're handled separately
    const { images, replace_images, ...updateDataWithoutImages } = updateData;
    
    const product = await ProductService.updateProduct(id, updateDataWithoutImages);
  
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Log the update action
    await AuditService.logUpdate(
      req,
      'PRODUCT',
      product._id.toString(),
      product.name,
      oldProduct,
      product
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete product
 * DELETE /api/v1/products/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Get the product data before deletion for audit logging
    const product = await ProductService.getProductById(id);
    
    // Log the deletion action before actually deleting
    if (product) {
      await AuditService.logDelete(
        req,
        'PRODUCT',
        product._id.toString(),
        product.name,
        product
      );
    }
    
    await ProductService.deleteProduct(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Bulk delete all products for a store
 * DELETE /api/v1/products/bulk/all
 */
router.delete('/bulk/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { store_id } = req.query;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const result = await ProductService.deleteAllProducts(store_id as string);

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} products`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Import products from JSON file
 * POST /api/v1/products/import
 */
router.post('/import', authenticate, uploadJsonFile('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get store_id and created_by from authenticated user
    const store_id = req.user?.storeId || req.body.store_id || 'default-store';
    const created_by = req.user?.id || req.body.created_by || 'default-user';
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check file type
    if (file.mimetype !== 'application/json') {
      return res.status(400).json({
        success: false,
        message: 'Only JSON files are allowed'
      });
    }

    // Parse the JSON file
    let importData;
    try {
      importData = JSON.parse(file.buffer.toString('utf8'));
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON file format'
      });
    }

    const result = await ProductService.importProducts(importData, store_id, created_by);

    res.json({
      success: true,
      message: `Import completed: ${result.successCount} successful, ${result.errorCount} failed`,
      data: {
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        importedProducts: result.importedProducts
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update product price
 * PUT /api/v1/products/:id/price
 */
router.put('/:id/price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { price, newPrice, priceChangeReason, reason, changedBy } = req.body;

    // Handle both 'price' and 'newPrice' field names (frontend compatibility)
    const actualPrice = price || newPrice;
    const actualReason = priceChangeReason || reason;

    if (actualPrice === undefined || actualPrice === null || actualPrice === '') {
      return res.status(400).json({
        success: false,
        message: 'Price is required'
      });
    }

    if (isNaN(parseFloat(actualPrice)) || parseFloat(actualPrice) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number'
      });
    }

    const product = await ProductService.updateProduct(id, {
      price: parseFloat(actualPrice),
      priceChangeReason: actualReason || 'Price updated',
      changedBy: changedBy || 'system'
    });

    res.json({
      success: true,
      message: 'Product price updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get price history for a product
 * GET /api/v1/products/:id/price-history
 */
router.get('/:id/price-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;
    
    const limitNumber = limit ? parseInt(limit as string) : 50;
    
    const priceHistory = await ProductService.getProductPriceHistory(id, limitNumber);
    
    res.json({
      success: true,
      message: 'Price history retrieved successfully',
      data: priceHistory,
    });
  } catch (error) {
    next(error);
  }
});

export default router;