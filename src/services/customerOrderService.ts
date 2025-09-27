import { CustomerOrder, ICustomerOrder, IOrderItem, OrderStatus, PaymentMethod, DeliveryMethod } from '../models/CustomerOrder';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';

export interface CreateCustomerOrderData {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  store_id: string;
  items: {
    product_id: string;
    quantity: number;
    notes?: string;
  }[];
  payment_method: PaymentMethod;
  delivery_method: DeliveryMethod;
  delivery_address?: string;
  notes?: string;
}

export interface CustomerOrderFilters {
  store_id?: string;
  status?: OrderStatus;
  customer_phone?: string;
  start_date?: Date;
  end_date?: Date;
  page?: number;
  limit?: number;
}

export class CustomerOrderService {
  /**
   * Create a new customer order
   */
  static async createOrder(orderData: CreateCustomerOrderData): Promise<ICustomerOrder> {
    try {
      // Validate products and check availability
      const validatedItems: IOrderItem[] = [];
      let subtotal = 0;

      for (const item of orderData.items) {
        const product = await Product.findById(item.product_id);
        if (!product) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }

        if (!product.is_active) {
          throw new Error(`Product ${product.name} is not available`);
        }

        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`);
        }

        const unitPrice = product.price;
        const totalPrice = unitPrice * item.quantity;

        validatedItems.push({
          product_id: product._id.toString(),
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          notes: item.notes
        });

        subtotal += totalPrice;
      }

      // Calculate delivery fee (you can customize this logic)
      const deliveryFee = orderData.delivery_method === DeliveryMethod.DELIVERY ? 25 : 0;
      const totalAmount = subtotal + deliveryFee;

      // Generate WhatsApp message
      const whatsappMessage = this.generateWhatsAppMessage(orderData.customer_name, validatedItems, totalAmount);

      const order = new CustomerOrder({
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        customer_email: orderData.customer_email,
        store_id: orderData.store_id,
        items: validatedItems,
        payment_method: orderData.payment_method,
        delivery_method: orderData.delivery_method,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        delivery_address: orderData.delivery_address,
        notes: orderData.notes,
        whatsapp_message: whatsappMessage
      });

      await order.save();

      logger.info(`Customer order created: ${order.order_number} for ${order.customer_name}`);
      return order;
    } catch (error) {
      logger.error('Error creating customer order:', error);
      throw error;
    }
  }

  /**
   * Get customer orders with filters
   */
  static async getOrders(filters: CustomerOrderFilters = {}) {
    try {
      const {
        store_id,
        status,
        customer_phone,
        start_date,
        end_date,
        page = 1,
        limit = 20
      } = filters;

      const query: any = {};

      if (store_id) query.store_id = store_id;
      if (status) query.status = status;
      if (customer_phone) query.customer_phone = customer_phone;

      if (start_date || end_date) {
        query.created_at = {};
        if (start_date) query.created_at.$gte = start_date;
        if (end_date) query.created_at.$lte = end_date;
      }

      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        CustomerOrder.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CustomerOrder.countDocuments(query)
      ]);

      return {
        orders,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error getting customer orders:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  static async getOrderById(orderId: string): Promise<ICustomerOrder | null> {
    try {
      return await CustomerOrder.findById(orderId);
    } catch (error) {
      logger.error('Error getting order by ID:', error);
      throw error;
    }
  }

  /**
   * Get order by order number
   */
  static async getOrderByOrderNumber(orderNumber: string): Promise<ICustomerOrder | null> {
    try {
      return await CustomerOrder.findOne({ order_number: orderNumber });
    } catch (error) {
      logger.error('Error getting order by order number:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(orderId: string, status: OrderStatus, notes?: string): Promise<ICustomerOrder | null> {
    try {
      const updateData: any = { status };

      if (status === OrderStatus.CONFIRMED) {
        updateData.confirmed_at = new Date();
      } else if (status === OrderStatus.COMPLETED) {
        updateData.completed_at = new Date();
      }

      if (notes) {
        updateData.notes = notes;
      }

      const order = await CustomerOrder.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );

      if (order) {
        logger.info(`Order ${order.order_number} status updated to ${status}`);
      }

      return order;
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Mark WhatsApp as sent
   */
  static async markWhatsAppSent(orderId: string): Promise<ICustomerOrder | null> {
    try {
      return await CustomerOrder.findByIdAndUpdate(
        orderId,
        { whatsapp_sent: true },
        { new: true }
      );
    } catch (error) {
      logger.error('Error marking WhatsApp as sent:', error);
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  static async getOrderStats(storeId: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { store_id: storeId };

      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = startDate;
        if (endDate) query.created_at.$lte = endDate;
      }

      const stats = await CustomerOrder.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] }
            },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ['$status', OrderStatus.CONFIRMED] }, 1, 0] }
            },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', OrderStatus.COMPLETED] }, 1, 0] }
            },
            averageOrderValue: { $avg: '$total_amount' }
          }
        }
      ]);

      return stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        completedOrders: 0,
        averageOrderValue: 0
      };
    } catch (error) {
      logger.error('Error getting order statistics:', error);
      throw error;
    }
  }

  /**
   * Generate WhatsApp message for order
   */
  private static generateWhatsAppMessage(customerName: string, items: IOrderItem[], totalAmount: number): string {
    const itemsList = items.map(item => 
      `• ${item.product_name} x${item.quantity} - ₺${item.total_price.toFixed(2)}`
    ).join('\n');

    return `🛒 *New Order Placed*

👤 *Customer:* ${customerName}

📦 *Items:*
${itemsList}

💰 *Total:* ₺${totalAmount.toFixed(2)}

Please confirm this order and let me know when it's ready!

Thank you! 🙏`;
  }

  /**
   * Generate WhatsApp share link
   */
  static generateWhatsAppLink(orderNumber: string, customerName: string, storePhone: string = '+905551234567'): string {
    const message = `Hi! I've placed order #${orderNumber} for ${customerName}. Please confirm and let me know when it's ready!`;
    return `https://wa.me/${storePhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Convert customer order to transaction (for admin use)
   */
  static async convertToTransaction(orderId: string, userId: string): Promise<any> {
    try {
      const order = await CustomerOrder.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== OrderStatus.CONFIRMED) {
        throw new Error('Only confirmed orders can be converted to transactions');
      }

      // This would integrate with your existing TransactionService
      // For now, we'll just return the order data formatted for transaction creation
      const transactionData = {
        store_id: order.store_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items: order.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        total_amount: order.total_amount,
        payment_method: order.payment_method === PaymentMethod.CASH_ON_DELIVERY ? 'cash' : 
                       order.payment_method === PaymentMethod.POS ? 'card' : 'transfer',
        notes: `Converted from customer order ${order.order_number}. ${order.notes || ''}`,
        created_by: userId,
        status: 'completed',
        payment_status: 'completed'
      };

      return transactionData;
    } catch (error) {
      logger.error('Error converting order to transaction:', error);
      throw error;
    }
  }
}
