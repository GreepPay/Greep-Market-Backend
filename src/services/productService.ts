import { Product, IProduct } from '../models/Product';
import { CloudinaryService } from '../config/cloudinary';
import { logger } from '../utils/logger';
import { CustomError, validationError } from '../middleware/errorHandler';

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  barcode?: string;
  stock_quantity: number;
  min_stock_level?: number;
  unit?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  tags?: string[];
  is_featured?: boolean;
  created_by: string;
  store_id: string;
  images?: Express.Multer.File[];
}

export interface UpdateProductData extends Partial<CreateProductData> {
  is_active?: boolean;
}

export class ProductService {
  /**
   * Create a new product
   */
  static async createProduct(productData: CreateProductData): Promise<IProduct> {
    try {
      // Check if SKU already exists
      const existingProduct = await Product.findOne({ sku: productData.sku });
      if (existingProduct) {
        throw validationError('Product with this SKU already exists');
      }

      // Check if barcode already exists (if provided)
      if (productData.barcode) {
        const existingBarcode = await Product.findOne({ barcode: productData.barcode });
        if (existingBarcode) {
          throw validationError('Product with this barcode already exists');
        }
      }

      // Process images if provided
      let processedImages: { url: string; public_id: string; is_primary: boolean; thumbnail_url?: string }[] = [];
      
      if (productData.images && productData.images.length > 0) {
        for (let i = 0; i < productData.images.length; i++) {
          const image = productData.images[i];
          try {
            // Upload to Cloudinary
            const uploadResult = await CloudinaryService.uploadImageFromBuffer(image.buffer);
            
            processedImages.push({
              url: uploadResult.secure_url,
              public_id: uploadResult.public_id,
              is_primary: i === 0, // First image is primary
            });
          } catch (uploadError) {
            logger.error('Failed to upload image:', uploadError);
            // Continue with other images even if one fails
          }
        }
      }

      // Remove images from productData before creating the product
      const { images, ...productDataWithoutImages } = productData;
      
      const product = new Product({
        ...productDataWithoutImages,
        images: processedImages,
      });
      
      await product.save();

      logger.info(`Product created successfully: ${product.sku}`);
      return product;
    } catch (error) {
      logger.error('Create product error:', error);
      throw error;
    }
  }

  /**
   * Upload and add image to product
   */
  static async addProductImage(
    productId: string,
    imageFile: Express.Multer.File,
    isPrimary: boolean = false
  ): Promise<IProduct> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      // Upload image to Cloudinary
      const uploadResult = await CloudinaryService.uploadImageFromBuffer(
        imageFile.buffer,
        {
          folder: `student-delivery/products/${product.sku}`,
          public_id: `${product.sku}_${Date.now()}`,
          transformation: [
            {
              quality: 'auto:low',
              fetch_format: 'auto',
              width: 800,
              height: 600,
              crop: 'limit',
              flags: 'progressive',
            },
          ],
        }
      );

      // Generate thumbnail
      const thumbnailResult = await CloudinaryService.generateThumbnail(
        uploadResult.public_id,
        {
          folder: `student-delivery/products/${product.sku}/thumbnails`,
          transformation: [
            {
              quality: 'auto:low',
              fetch_format: 'auto',
              width: 200,
              height: 150,
              crop: 'limit',
            },
          ],
        }
      );

      // Add image to product
      await product.addImage({
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        is_primary: isPrimary,
        thumbnail_url: thumbnailResult.secure_url,
      });

      logger.info(`Image added to product ${product.sku}: ${uploadResult.public_id}`);
      return product;
    } catch (error) {
      logger.error('Add product image error:', error);
      throw error;
    }
  }

  /**
   * Set primary image for product
   */
  static async setPrimaryImage(productId: string, imagePublicId: string): Promise<IProduct> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      // Check if image exists in product
      const imageExists = product.images.some(img => img.public_id === imagePublicId);
      if (!imageExists) {
        throw validationError('Image not found in product');
      }

      await product.setPrimaryImage(imagePublicId);
      
      logger.info(`Primary image set for product ${product.sku}: ${imagePublicId}`);
      return product;
    } catch (error) {
      logger.error('Set primary image error:', error);
      throw error;
    }
  }

  /**
   * Remove image from product
   */
  static async removeProductImage(productId: string, imagePublicId: string): Promise<IProduct> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      // Remove from Cloudinary
      await CloudinaryService.deleteImage(imagePublicId);

      // Remove from product
      await product.removeImage(imagePublicId);

      logger.info(`Image removed from product ${product.sku}: ${imagePublicId}`);
      return product;
    } catch (error) {
      logger.error('Remove product image error:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  static async getProductById(productId: string): Promise<IProduct | null> {
    try {
      return await Product.findById(productId);
    } catch (error) {
      logger.error('Get product by ID error:', error);
      throw error;
    }
  }

  /**
   * Get product by SKU
   */
  static async getProductBySku(sku: string): Promise<IProduct | null> {
    try {
      return await Product.findOne({ sku: sku.toUpperCase() });
    } catch (error) {
      logger.error('Get product by SKU error:', error);
      throw error;
    }
  }

  /**
   * Get products with pagination and filters
   */
  static async getProducts(options: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    is_active?: boolean;
    is_featured?: boolean;
    store_id?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    products: IProduct[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        search,
        is_active,
        is_featured,
        store_id,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      // Build query
      const query: any = {};

      if (category) query.category = category;
      if (is_active !== undefined) query.is_active = is_active;
      if (is_featured !== undefined) query.is_featured = is_featured;
      if (store_id) query.store_id = store_id;

      // Text search
      if (search) {
        query.$text = { $search: search };
      }

      // Calculate skip
      const skip = (page - 1) * limit;

      // Execute query
      const [products, total] = await Promise.all([
        Product.find(query)
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        Product.countDocuments(query),
      ]);

      return {
        products,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Get products error:', error);
      throw error;
    }
  }

  /**
   * Update product
   */
  static async updateProduct(
    productId: string,
    updateData: UpdateProductData
  ): Promise<IProduct> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      // Check SKU uniqueness if updating
      if (updateData.sku && updateData.sku !== product.sku) {
        const existingProduct = await Product.findOne({ sku: updateData.sku });
        if (existingProduct) {
          throw validationError('Product with this SKU already exists');
        }
      }

      // Check barcode uniqueness if updating
      if (updateData.barcode && updateData.barcode !== product.barcode) {
        const existingBarcode = await Product.findOne({ barcode: updateData.barcode });
        if (existingBarcode) {
          throw validationError('Product with this barcode already exists');
        }
      }

      // Update product
      Object.assign(product, updateData);
      await product.save();

      logger.info(`Product updated: ${product.sku}`);
        return product;
    } catch (error) {
      logger.error('Update product error:', error);
      throw error;
    }
  }

  /**
   * Delete product
   */
  static async deleteProduct(productId: string): Promise<boolean> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      // Delete images from Cloudinary
      for (const image of product.images) {
        await CloudinaryService.deleteImage(image.public_id);
      }

      // Delete product
      await Product.findByIdAndDelete(productId);

      logger.info(`Product deleted: ${product.sku}`);
      return true;
    } catch (error) {
      logger.error('Delete product error:', error);
      throw error;
    }
  }

  /**
   * Update stock quantity
   */
  static async updateStock(productId: string, newQuantity: number): Promise<IProduct> {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw validationError('Product not found');
      }

      product.stock_quantity = newQuantity;
      await product.save();

      logger.info(`Stock updated for product ${product.sku}: ${newQuantity}`);
      return product;
    } catch (error) {
      logger.error('Update stock error:', error);
      throw error;
    }
  }
}

export const productService = new ProductService();