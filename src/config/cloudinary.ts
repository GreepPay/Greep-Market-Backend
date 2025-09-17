import { v2 as cloudinary } from 'cloudinary';
import { config } from './app';
import { logger } from '../utils/logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export { cloudinary };

// Image upload options for compression
export const uploadOptions = {
  // Transformations for automatic compression
  transformation: [
    {
      quality: 'auto:low', // Auto quality with low compression
      fetch_format: 'auto', // Auto format (WebP, AVIF when supported)
      width: 800, // Max width
      height: 600, // Max height
      crop: 'limit', // Don't crop, just resize
      flags: 'progressive', // Progressive JPEG
    },
  ],
  // Folder structure
  folder: 'student-delivery/products',
  // Public ID will be generated automatically
  use_filename: true,
  unique_filename: true,
};

// Thumbnail options for smaller previews
export const thumbnailOptions = {
  transformation: [
    {
      quality: 'auto:low',
      fetch_format: 'auto',
      width: 200,
      height: 150,
      crop: 'limit',
      flags: 'progressive',
    },
  ],
  folder: 'student-delivery/products/thumbnails',
  use_filename: true,
  unique_filename: true,
};

// Image upload service
export class CloudinaryService {
  /**
   * Upload image with compression
   */
  static async uploadImage(
    filePath: string,
    options: any = uploadOptions
  ): Promise<{ url: string; public_id: string; secure_url: string }> {
    try {
      const result = await cloudinary.uploader.upload(filePath, options);
      
      logger.info(`Image uploaded successfully: ${result.public_id}`);
      
      return {
        url: result.url,
        public_id: result.public_id,
        secure_url: result.secure_url,
      };
    } catch (error) {
      logger.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload image to Cloudinary');
    }
  }

  /**
   * Upload image from buffer (for multer)
   */
  static async uploadImageFromBuffer(
    buffer: Buffer,
    options: any = uploadOptions
  ): Promise<{ url: string; public_id: string; secure_url: string }> {
    try {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(buffer);
      });

      logger.info(`Image uploaded from buffer successfully: ${(result as any).public_id}`);
      
      return {
        url: (result as any).url,
        public_id: (result as any).public_id,
        secure_url: (result as any).secure_url,
      };
    } catch (error) {
      logger.error('Cloudinary buffer upload error:', error);
      throw new Error('Failed to upload image from buffer to Cloudinary');
    }
  }

  /**
   * Generate thumbnail from existing image
   */
  static async generateThumbnail(
    publicId: string,
    options: any = thumbnailOptions
  ): Promise<{ url: string; secure_url: string }> {
    try {
      const result = await cloudinary.uploader.explicit(publicId, {
        ...options,
        type: 'upload',
        eager: options.transformation,
      });

      const thumbnailUrl = result.eager?.[0]?.secure_url || result.secure_url;
      
      return {
        url: thumbnailUrl,
        secure_url: thumbnailUrl,
      };
    } catch (error) {
      logger.error('Thumbnail generation error:', error);
      throw new Error('Failed to generate thumbnail');
    }
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      logger.info(`Image deleted: ${publicId}, result: ${result.result}`);
      return result.result === 'ok';
    } catch (error) {
      logger.error('Cloudinary delete error:', error);
      return false;
    }
  }

  /**
   * Get optimized image URL with transformations
   */
  static getOptimizedUrl(
    publicId: string,
    transformations: any = {
      quality: 'auto:low',
      fetch_format: 'auto',
      width: 400,
      height: 300,
      crop: 'limit',
    }
  ): string {
    return cloudinary.url(publicId, transformations);
  }
}
