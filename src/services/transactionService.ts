import { Transaction, ITransaction } from '../models/Transaction';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';

export interface CreateTransactionData {
  store_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  payment_method: 'cash' | 'card' | 'transfer' | 'crypto';
  notes?: string;
  cashier_id: string;
}

export interface TransactionResponse {
  _id: string;
  store_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    discount_amount?: number;
  }>;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  cashier_id: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export class TransactionService {
  /**
   * Create a new transaction
   */
  static async createTransaction(transactionData: CreateTransactionData): Promise<TransactionResponse> {
    try {
      // Validate and get product details
      const itemsWithDetails = await Promise.all(
        transactionData.items.map(async (item) => {
          const product = await Product.findById(item.product_id);
          if (!product) {
            throw new Error(`Product with ID ${item.product_id} not found`);
          }

          // Check if enough stock is available
          if (product.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
          }

          return {
            product_id: item.product_id,
            product_name: product.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price - (item.discount_amount || 0),
            discount_amount: item.discount_amount || 0
          };
        })
      );

      // Calculate totals
      const subtotal = itemsWithDetails.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const totalDiscount = itemsWithDetails.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
      const taxAmount = 0; // No automatic tax calculation
      const totalAmount = subtotal - totalDiscount; // Total = subtotal - discounts (no tax)

      // Create transaction
      const transaction = new Transaction({
        store_id: transactionData.store_id,
        customer_id: transactionData.customer_id,
        items: itemsWithDetails,
        subtotal,
        discount_amount: totalDiscount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: transactionData.payment_method,
        payment_status: 'completed',
        status: 'completed',
        cashier_id: transactionData.cashier_id,
        notes: transactionData.notes,
      });

      await transaction.save();

      // Update product stock quantities
      await Promise.all(
        itemsWithDetails.map(async (item) => {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { stock_quantity: -item.quantity },
            updated_at: new Date()
          });
        })
      );

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Get transactions with filters
   */
  static async getTransactions(
    storeId?: string,
    status?: string,
    paymentMethod?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    transactions: TransactionResponse[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    try {
      const query: any = {};
      
      if (storeId) {
        query.store_id = storeId;
      }
      
      if (status) {
        query.status = status;
      }
      
      if (paymentMethod) {
        query.payment_method = paymentMethod;
      }

      // Add date filtering
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) {
          query.created_at.$gte = new Date(startDate);
        }
        if (endDate) {
          query.created_at.$lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit),
        Transaction.countDocuments(query),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        transactions: transactions.map(t => this.formatTransactionResponse(t)),
        total,
        page,
        limit,
        pages
      };
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(transactionId: string): Promise<TransactionResponse | null> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return null;
      }

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error('Error getting transaction by ID:', error);
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(
    transactionId: string, 
    status: 'pending' | 'completed' | 'cancelled' | 'voided',
    paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded'
  ): Promise<TransactionResponse> {
    try {
      const updateData: any = { status };
      
      if (paymentStatus) {
        updateData.payment_status = paymentStatus;
      }

      const transaction = await Transaction.findByIdAndUpdate(
        transactionId,
        updateData,
        { new: true }
      );

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error('Error updating transaction status:', error);
      throw error;
    }
  }

  /**
   * Cancel transaction and restore stock
   */
  static async cancelTransaction(transactionId: string): Promise<TransactionResponse> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Restore product stock quantities
      await Promise.all(
        transaction.items.map(async (item) => {
          await Product.findByIdAndUpdate(item.product_id, {
            $inc: { stock_quantity: item.quantity },
            updated_at: new Date()
          });
        })
      );

      // Update transaction status
      transaction.status = 'cancelled';
      transaction.payment_status = 'refunded';
      await transaction.save();

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error('Error cancelling transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats(storeId?: string): Promise<{
    totalTransactions: number;
    totalRevenue: number;
    averageTransactionValue: number;
    transactionsByStatus: Array<{ status: string; count: number }>;
    transactionsByPaymentMethod: Array<{ method: string; count: number; amount: number }>;
  }> {
    try {
      const filter = storeId ? { store_id: storeId } : {};

      const [
        totalTransactions,
        revenueStats,
        statusStats,
        paymentMethodStats
      ] = await Promise.all([
        Transaction.countDocuments(filter),
        Transaction.aggregate([
          { $match: filter },
          { $group: { 
            _id: null, 
            totalRevenue: { $sum: '$total_amount' },
            averageValue: { $avg: '$total_amount' }
          }}
        ]),
        Transaction.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { status: '$_id', count: 1, _id: 0 } }
        ]),
        Transaction.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$payment_method', 
            count: { $sum: 1 },
            amount: { $sum: '$total_amount' }
          }},
          { $project: { method: '$_id', count: 1, amount: 1, _id: 0 } }
        ])
      ]);

      const revenue = revenueStats[0] || { totalRevenue: 0, averageValue: 0 };

      return {
        totalTransactions,
        totalRevenue: revenue.totalRevenue,
        averageTransactionValue: revenue.averageValue,
        transactionsByStatus: statusStats,
        transactionsByPaymentMethod: paymentMethodStats
      };
    } catch (error) {
      logger.error('Error getting transaction stats:', error);
      throw error;
    }
  }

  /**
   * Format transaction response
   */
  private static formatTransactionResponse(transaction: ITransaction): TransactionResponse {
    return {
      _id: transaction._id.toString(),
      store_id: transaction.store_id,
      customer_id: transaction.customer_id,
      items: transaction.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        discount_amount: item.discount_amount
      })),
      subtotal: transaction.subtotal,
      discount_amount: transaction.discount_amount,
      tax_amount: transaction.tax_amount,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      payment_status: transaction.payment_status,
      status: transaction.status,
      cashier_id: transaction.cashier_id,
      notes: transaction.notes,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }
}
