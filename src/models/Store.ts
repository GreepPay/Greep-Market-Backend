import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  currency: string;
  timezone: string;
  business_type?: string;
  owner_id?: string;
  subscription_plan: string;
  subscription_expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const storeSchema = new Schema<IStore>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  address: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 255,
  },
  tax_id: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  currency: {
    type: String,
    default: 'TRY',
    enum: ['TRY', 'USD', 'EUR', 'GBP'],
    maxlength: 3,
  },
  timezone: {
    type: String,
    default: 'Europe/Istanbul',
    maxlength: 50,
  },
  business_type: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  owner_id: {
    type: String,
    ref: 'User',
  },
  subscription_plan: {
    type: String,
    default: 'basic',
    enum: ['basic', 'premium', 'enterprise'],
    maxlength: 50,
  },
  subscription_expires_at: {
    type: Date,
  },
  is_active: {
    type: Boolean,
    default: true,
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

// Update the updated_at field before saving
storeSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create the model
export const Store = mongoose.model<IStore>('Store', storeSchema);
