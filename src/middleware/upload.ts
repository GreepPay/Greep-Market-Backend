import multer from 'multer';
import sharp from 'sharp';
import { Request } from 'express';
import { logger } from '../utils/logger';

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Memory storage for processing files with Sharp
const storage = multer.memoryStorage();

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files
  },
});

// Image processing middleware using Sharp
export const processImages = async (req: Request, res: any, next: any) => {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return next();
    }

    const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
    const processedFiles: Express.Multer.File[] = [];

    for (const file of files) {
      if (file.buffer) {
        // Process image with Sharp for compression
        const processedBuffer = await sharp(file.buffer)
          .resize(800, 600, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true,
          })
          .toBuffer();

        // Update file buffer with processed image
        const processedFile: Express.Multer.File = {
          ...file,
          buffer: processedBuffer,
          size: processedBuffer.length,
        };

        processedFiles.push(processedFile);
        
        logger.info(`Image processed: ${file.originalname}, original size: ${file.size}, compressed size: ${processedBuffer.length}`);
      }
    }

    // Replace files with processed versions
    if (Array.isArray(req.files)) {
      req.files = processedFiles;
    } else {
      // Handle multiple field uploads
      const processedFilesObj: { [fieldname: string]: Express.Multer.File[] } = {};
      Object.keys(req.files).forEach(key => {
        processedFilesObj[key] = processedFiles;
      });
      req.files = processedFilesObj as any;
    }

    next();
  } catch (error) {
    logger.error('Image processing error:', error);
    next(new Error('Failed to process images'));
  }
};

// Single image upload
export const uploadSingle = (fieldName: string) => [
  upload.single(fieldName),
  processImages,
];

// Multiple images upload
export const uploadMultiple = (fieldName: string, maxCount: number = 5) => [
  upload.array(fieldName, maxCount),
  processImages,
];

// Multiple fields upload
export const uploadFields = (fields: multer.Field[]) => [
  upload.fields(fields),
  processImages,
];
