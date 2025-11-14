import { Transaction, ITransaction } from '../models/Transaction';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';
import { parseDateRange, getStoreTimezone, debugTimezoneInfo } from '../utils/timezone';

export interface CreateTransactionData {
  store_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  payment_method: 'cash' | 'pos_isbank_transfer' | 'naira_transfer' | 'crypto_payment';
  order_source?: 'online' | 'in-store' | 'phone' | 'delivery';
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
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  order_source?: string;
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

          // Note: Stock availability will be checked when transaction is completed
          // This allows creating pending transactions even if stock is temporarily low

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
      const totalAmount = subtotal - totalDiscount; // Total = subtotal - discounts

      // Create transaction
      const transaction = new Transaction({
        store_id: transactionData.store_id,
        customer_id: transactionData.customer_id,
        items: itemsWithDetails,
        subtotal,
        discount_amount: totalDiscount,
        total_amount: totalAmount,
        payment_method: transactionData.payment_method,
        payment_status: 'pending',
        status: 'pending',
        order_source: transactionData.order_source || 'in-store',
        cashier_id: transactionData.cashier_id,
        notes: transactionData.notes,
      });

      await transaction.save();

      // Note: Stock is NOT reduced here - it will be reduced when transaction is completed
      // This prevents double stock reduction and allows proper cancellation handling

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
      
      // Always filter by storeId - use provided storeId or default
      const finalStoreId = storeId || 'default-store';
      query.store_id = finalStoreId;
      
      if (status) {
        query.status = status;
      }
      
      if (paymentMethod) {
        query.payment_method = paymentMethod;
      }

      // Add timezone-aware date filtering
      if (startDate || endDate) {
        // Debug timezone information
        debugTimezoneInfo(startDate, getStoreTimezone(finalStoreId));
        
        // Parse date range with timezone awareness
        const dateRange = parseDateRange(startDate, endDate, getStoreTimezone(finalStoreId));
        
        if (dateRange) {
          query.created_at = {
            $gte: dateRange.start,
            $lte: dateRange.end
          };
          
          logger.info('Applied timezone-aware date filter:', {
            storeId: finalStoreId,
            startDate,
            endDate,
            timezone: getStoreTimezone(finalStoreId),
            filterRange: {
              start: dateRange.start.toISOString(),
              end: dateRange.end.toISOString()
            }
          });
        } else {
          logger.warn('Failed to parse date range, skipping date filter:', { startDate, endDate });
        }
      }

      // Debug the query being built
      logger.info('TransactionService.getTransactions - Query built:', {
        query,
        storeId: finalStoreId,
        status,
        paymentMethod,
        startDate,
        endDate,
        page,
        limit
      });

      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit),
        Transaction.countDocuments(query),
      ]);

      // Debug the results
      logger.info('TransactionService.getTransactions - Results:', {
        query,
        totalFound: total,
        transactionsReturned: transactions.length,
        sampleStoreIds: transactions.slice(0, 3).map(t => t.store_id),
        sampleDates: transactions.slice(0, 3).map(t => t.created_at)
      });

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
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const updateData: any = { status };
      
      if (paymentStatus) {
        updateData.payment_status = paymentStatus;
      }

      // If completing a transaction, reduce stock
      if (status === 'completed' && transaction.status === 'pending') {
        // Check stock availability before reducing
        for (const item of transaction.items) {
          const product = await Product.findById(item.product_id);
          if (!product) {
            throw new Error(`Product with ID ${item.product_id} not found`);
          }
          if (product.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Required: ${item.quantity}`);
          }
        }

        // Reduce stock for all items
        await Promise.all(
          transaction.items.map(async (item) => {
            await Product.findByIdAndUpdate(item.product_id, {
              $inc: { stock_quantity: -item.quantity },
              updated_at: new Date()
            });
          })
        );
      }

      // If cancelling a completed transaction, restore stock
      if (status === 'cancelled' && transaction.status === 'completed') {
        await Promise.all(
          transaction.items.map(async (item) => {
            await Product.findByIdAndUpdate(item.product_id, {
              $inc: { stock_quantity: item.quantity },
              updated_at: new Date()
            });
          })
        );
      }

      // Update the transaction
      const updatedTransaction = await Transaction.findByIdAndUpdate(
        transactionId,
        updateData,
        { new: true }
      );

      return this.formatTransactionResponse(updatedTransaction);
    } catch (error) {
      logger.error('Error updating transaction status:', error);
      throw error;
    }
  }

  /**
   * Cancel transaction and restore stock (if transaction was completed)
   */
  static async cancelTransaction(transactionId: string): Promise<TransactionResponse> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Only restore stock if the transaction was previously completed
      if (transaction.status === 'completed') {
        await Promise.all(
          transaction.items.map(async (item) => {
            await Product.findByIdAndUpdate(item.product_id, {
              $inc: { stock_quantity: item.quantity },
              updated_at: new Date()
            });
          })
        );
      }

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
   * Update transaction
   */
  static async updateTransaction(transactionId: string, updateData: {
    items?: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_amount?: number;
    }>;
    payment_method?: 'cash' | 'pos_isbank_transfer' | 'naira_transfer' | 'crypto_payment';
    order_source?: 'online' | 'in-store' | 'phone' | 'delivery';
    customer_id?: string;
    notes?: string;
  }): Promise<TransactionResponse> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Check if transaction can be updated (only pending transactions can be updated)
      if (transaction.status !== 'pending') {
        throw new Error('Only pending transactions can be updated');
      }

      // If items are being updated, validate and recalculate totals
      if (updateData.items) {
        // Validate items
        for (const item of updateData.items) {
          if (!item.product_id || !item.quantity || !item.unit_price) {
            throw new Error('Each item must have product_id, quantity, and unit_price');
          }
        }

        // Get product details and validate
        const productIds = updateData.items.map(item => item.product_id);
        const products = await Product.find({ _id: { $in: productIds } });
        
        if (products.length !== productIds.length) {
          throw new Error('One or more products not found');
        }

        // Update items with product names and calculate totals
        const updatedItems = updateData.items.map(item => {
          const product = products.find(p => p._id.toString() === item.product_id);
          if (!product) {
            throw new Error(`Product not found: ${item.product_id}`);
          }

          const totalPrice = (item.quantity * item.unit_price) - (item.discount_amount || 0);
          
          return {
            product_id: item.product_id,
            product_name: product.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: totalPrice,
            discount_amount: item.discount_amount || 0
          };
        });

        // Calculate new totals (consistent with creation logic)
        const subtotal = updatedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const discountAmount = updatedItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
        const totalAmount = subtotal - discountAmount; // Total = subtotal - discounts

        // Update transaction
        transaction.items = updatedItems;
        transaction.subtotal = subtotal;
        transaction.discount_amount = discountAmount;
        transaction.total_amount = totalAmount;
      }

      // Update other fields
      if (updateData.payment_method) {
        // Validate payment method
        const validPaymentMethods = ['cash', 'pos_isbank_transfer', 'naira_transfer', 'crypto_payment'];
        if (!validPaymentMethods.includes(updateData.payment_method)) {
          throw new Error(`Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`);
        }
        transaction.payment_method = updateData.payment_method;
      }
      if (updateData.order_source !== undefined) {
        transaction.order_source = updateData.order_source;
      }
      if (updateData.customer_id !== undefined) {
        transaction.customer_id = updateData.customer_id;
      }
      if (updateData.notes !== undefined) {
        transaction.notes = updateData.notes;
      }

      transaction.updated_at = new Date();
      await transaction.save();

      return this.formatTransactionResponse(transaction);
    } catch (error) {
      logger.error('Error updating transaction:', error);
      throw error;
    }
  }

  /**
   * Delete transaction
   */
  static async deleteTransaction(transactionId: string, options?: { force?: boolean }): Promise<void> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Check if transaction can be deleted (only pending transactions can be deleted)
      if (!options?.force && transaction.status !== 'pending') {
        throw new Error('Only pending transactions can be deleted');
      }

      await Transaction.findByIdAndDelete(transactionId);
    } catch (error) {
      logger.error('Error deleting transaction:', error);
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
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      payment_status: transaction.payment_status,
      status: transaction.status,
      order_source: transaction.order_source,
      cashier_id: transaction.cashier_id,
      notes: transaction.notes,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }
}
