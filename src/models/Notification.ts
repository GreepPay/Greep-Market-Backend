import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  user_id: string;
  store_id: string;
  type: 'milestone' | 'daily_summary' | 'goal_reminder' | 'achievement' | 'system';
  title: string;
  message: string;
  data?: {
    milestone_type?: 'daily_sales' | 'monthly_sales' | 'transaction_count' | 'customer_count';
    milestone_value?: number;
    goal_percentage?: number;
    sales_data?: {
      total_sales: number;
      transaction_count: number;
      top_product?: string;
      growth_percentage?: number;
    };
    achievement_type?: 'first_sale' | 'big_sale' | 'streak' | 'goal_reached';
  };
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const notificationSchema = new Schema<INotification>({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  store_id: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['milestone', 'daily_summary', 'goal_reminder', 'achievement', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expires_at: {
    type: Date,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ store_id: 1, type: 1, created_at: -1 });
notificationSchema.index({ created_at: -1 });

// Update the updated_at field before saving
notificationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
