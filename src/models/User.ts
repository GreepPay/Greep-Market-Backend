import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'cashier' | 'manager' | 'owner';
  store_id?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'cashier', 'manager', 'owner'],
    required: true,
  },
  store_id: {
    type: String,
    default: null,
  },
  first_name: {
    type: String,
    required: true,
    trim: true,
  },
  last_name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  last_login: {
    type: Date,
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
userSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Create the model
export const User = mongoose.model<IUser>('User', userSchema);

