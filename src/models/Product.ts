import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  barcode?: string;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  images: {
    url: string;
    public_id: string;
    is_primary: boolean;
    thumbnail_url?: string;
  }[];
  tags: string[];
  is_active: boolean;
  is_featured: boolean;
  created_by: string; // User ID who created the product
  store_id: string;
  created_at: Date;
  updated_at: Date;
  
  // Methods
  addImage(imageData: {
    url: string;
    public_id: string;
    is_primary?: boolean;
    thumbnail_url?: string;
  }): Promise<IProduct>;
  setPrimaryImage(imageId: string): Promise<IProduct>;
  removeImage(publicId: string): Promise<IProduct>;
}

const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
  },
  stock_quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  min_stock_level: {
    type: Number,
    required: true,
    min: 0,
    default: 5,
  },
  unit: {
    type: String,
    required: true,
    trim: true,
    default: 'piece',
  },
  weight: {
    type: Number,
    min: 0,
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  images: [{
    url: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
    },
    is_primary: {
      type: Boolean,
      default: false,
    },
    thumbnail_url: {
      type: String,
    },
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  is_active: {
    type: Boolean,
    default: true,
  },
  is_featured: {
    type: Boolean,
    default: false,
  },
  created_by: {
    type: String,
    required: true,
  },
  store_id: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ sku: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ category: 1 });
productSchema.index({ store_id: 1 });
productSchema.index({ is_active: 1 });
productSchema.index({ is_featured: 1 });
productSchema.index({ created_at: -1 });

// Update the updated_at field before saving
productSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Virtual for primary image
productSchema.virtual('primary_image').get(function() {
  return this.images?.find(img => img.is_primary) || this.images?.[0];
});

// Virtual for thumbnail
productSchema.virtual('thumbnail').get(function() {
  const primaryImage = this.images?.find(img => img.is_primary) || this.images?.[0];
  return primaryImage?.thumbnail_url || primaryImage?.url;
});

// Method to add image
productSchema.methods.addImage = function(imageData: {
  url: string;
  public_id: string;
  is_primary?: boolean;
  thumbnail_url?: string;
}) {
  // If this is set as primary, unset other primary images
  if (imageData.is_primary) {
    this.images.forEach((img: any) => {
      img.is_primary = false;
    });
  }
  
  this.images.push(imageData);
  return this.save();
};

// Method to set primary image
productSchema.methods.setPrimaryImage = function(imageId: string) {
  this.images.forEach((img: any) => {
    img.is_primary = img.public_id === imageId;
  });
  return this.save();
};

// Method to remove image
productSchema.methods.removeImage = function(publicId: string) {
  const imageIndex = this.images.findIndex((img: any) => img.public_id === publicId);
  if (imageIndex !== -1) {
    this.images.splice(imageIndex, 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Create the model
export const Product = mongoose.model<IProduct>('Product', productSchema);
