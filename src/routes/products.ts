import { Router, Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/productService';
import { uploadMultiple } from '../middleware/upload';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Create a new product
 * POST /api/v1/products
 */
router.post('/', uploadMultiple('images', 5), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, category, sku, barcode, stock_quantity, store_id, created_by } = req.body;
    const images = req.files as Express.Multer.File[];

    if (!name || !price || !category || !sku || !stock_quantity || !store_id || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, price, category, sku, stock_quantity, store_id, created_by'
      });
    }

    const product = await ProductService.createProduct({
      name,
      description: description || '',
      price: parseFloat(price),
      category,
      sku,
      barcode,
      stock_quantity: parseInt(stock_quantity),
      store_id,
      created_by,
      images,
    });
    
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
 * Get all products with pagination and filters
 * GET /api/v1/products
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { store_id } = req.query;

    const result = await ProductService.getProducts({ store_id: store_id as string });

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
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await ProductService.updateProduct(id, updateData);
  
  if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
  }

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
    
    await ProductService.deleteProduct(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;