import { Product } from '../models/Product';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';

export interface DashboardMetrics {
  totalSales: number;
  totalProducts: number;
  lowStockItems: number;
  todaySales: number;
  monthlySales: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  recentTransactions: Array<{
    id: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: Date;
  }>;
  salesByMonth: Array<{
    month: string;
    sales: number;
    transactions: number;
  }>;
}

export interface SalesAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  salesByPeriod: Array<{
    period: string;
    revenue: number;
    transactions: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
}

export interface ProductAnalytics {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    totalValue: number;
  }>;
}

export interface InventoryAnalytics {
  totalInventoryValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  stockAlerts: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    minStockLevel: number;
    alertType: 'low_stock' | 'out_of_stock';
  }>;
  categoryStock: Array<{
    category: string;
    totalStock: number;
    totalValue: number;
  }>;
}

export class AnalyticsService {
  /**
   * Get dashboard metrics
   */
  static async getDashboardMetrics(storeId?: string): Promise<DashboardMetrics> {
    try {
      // Build query filters
      const productFilter = storeId ? { store_id: storeId } : {};
      const transactionFilter = storeId ? { store_id: storeId } : {};

      // Get current date ranges
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Parallel queries for better performance
      const [
        totalProducts,
        lowStockProducts,
        todayTransactions,
        monthlyTransactions,
        recentTransactions,
        topProductsData
      ] = await Promise.all([
        Product.countDocuments(productFilter),
        Product.countDocuments({ ...productFilter, stock_quantity: { $lte: '$min_stock_level' } }),
        Transaction.find({ 
          ...transactionFilter, 
          created_at: { $gte: startOfDay },
          status: 'completed'
        }),
        Transaction.find({ 
          ...transactionFilter, 
          created_at: { $gte: startOfMonth },
          status: 'completed'
        }),
        Transaction.find({ 
          ...transactionFilter, 
          status: 'completed'
        }).sort({ created_at: -1 }).limit(10),
        this.getTopProducts(storeId, 5)
      ]);

      // Calculate totals
      const todaySales = todayTransactions.reduce((sum, t) => sum + t.total_amount, 0);
      const monthlySales = monthlyTransactions.reduce((sum, t) => sum + t.total_amount, 0);
      const totalSales = await Transaction.aggregate([
        { $match: { ...transactionFilter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ]);

      // Get sales by month for the last 12 months
      const salesByMonth = await this.getSalesByMonth(storeId);

      return {
        totalSales: totalSales[0]?.total || 0,
        totalProducts,
        lowStockItems: lowStockProducts,
        todaySales,
        monthlySales,
        topProducts: topProductsData,
        recentTransactions: recentTransactions.map(t => ({
          id: t._id.toString(),
          totalAmount: t.total_amount,
          paymentMethod: t.payment_method,
          createdAt: t.created_at
        })),
        salesByMonth
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get sales analytics
   */
  static async getSalesAnalytics(storeId?: string, period?: string): Promise<SalesAnalytics> {
    try {
      const filter = storeId ? { store_id: storeId, status: 'completed' } : { status: 'completed' };

      // Get date range based on period
      let dateFilter = {};
      if (period === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        dateFilter = { created_at: { $gte: startOfDay } };
      } else if (period === 'week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        dateFilter = { created_at: { $gte: startOfWeek } };
      } else if (period === 'month') {
        const startOfMonth = new Date();
        startOfMonth.setMonth(startOfMonth.getMonth() - 1);
        dateFilter = { created_at: { $gte: startOfMonth } };
      }

      const transactions = await Transaction.find({ ...filter, ...dateFilter });

      const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const totalTransactions = transactions.length;
      const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Get sales by period
      const salesByPeriod = await this.getSalesByPeriod(storeId, period);

      // Get top products
      const topProducts = await this.getTopProducts(storeId, 10);

      // Get payment method breakdown
      const paymentMethodBreakdown = await Transaction.aggregate([
        { $match: { ...filter, ...dateFilter } },
        { $group: { 
          _id: '$payment_method', 
          count: { $sum: 1 }, 
          amount: { $sum: '$total_amount' } 
        }},
        { $project: { 
          method: '$_id', 
          count: 1, 
          amount: 1, 
          _id: 0 
        }}
      ]);

      return {
        totalRevenue,
        totalTransactions,
        averageTransactionValue,
        salesByPeriod,
        topProducts,
        paymentMethodBreakdown
      };
    } catch (error) {
      console.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get product analytics
   */
  static async getProductAnalytics(storeId?: string): Promise<ProductAnalytics> {
    try {
      const filter = storeId ? { store_id: storeId } : {};

      const [
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        categoryBreakdown
      ] = await Promise.all([
        Product.countDocuments(filter),
        Product.countDocuments({ ...filter, is_active: true }),
        Product.countDocuments({ ...filter, stock_quantity: { $lte: '$min_stock_level', $gt: 0 } }),
        Product.countDocuments({ ...filter, stock_quantity: 0 }),
        Product.aggregate([
          { $match: filter },
          { $group: { 
            _id: '$category', 
            count: { $sum: 1 }, 
            totalValue: { $sum: { $multiply: ['$price', '$stock_quantity'] } }
          }},
          { $project: { 
            category: '$_id', 
            count: 1, 
            totalValue: 1, 
            _id: 0 
          }}
        ])
      ]);

      const topSellingProducts = await this.getTopProducts(storeId, 10);

      return {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        topSellingProducts,
        categoryBreakdown
      };
    } catch (error) {
      console.error('Error getting product analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics
   */
  static async getInventoryAnalytics(storeId?: string): Promise<InventoryAnalytics> {
    try {
      const filter = storeId ? { store_id: storeId } : {};

      const products = await Product.find(filter);
      
      const totalInventoryValue = products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0);
      
      const lowStockItems = products.filter(p => p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0).length;
      const outOfStockItems = products.filter(p => p.stock_quantity === 0).length;

      const stockAlerts = products
        .filter(p => p.stock_quantity <= p.min_stock_level)
        .map(p => ({
          productId: p._id.toString(),
          productName: p.name,
          currentStock: p.stock_quantity,
          minStockLevel: p.min_stock_level,
          alertType: p.stock_quantity === 0 ? 'out_of_stock' as const : 'low_stock' as const
        }));

      const categoryStock = await Product.aggregate([
        { $match: filter },
        { $group: { 
          _id: '$category', 
          totalStock: { $sum: '$stock_quantity' }, 
          totalValue: { $sum: { $multiply: ['$price', '$stock_quantity'] } }
        }},
        { $project: { 
          category: '$_id', 
          totalStock: 1, 
          totalValue: 1, 
          _id: 0 
        }}
      ]);

      return {
        totalInventoryValue,
        lowStockItems,
        outOfStockItems,
        stockAlerts,
        categoryStock
      };
    } catch (error) {
      console.error('Error getting inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Get top selling products
   */
  private static async getTopProducts(storeId?: string, limit: number = 10): Promise<any[]> {
    try {
      const matchFilter = storeId ? { store_id: storeId } : {};
      
      const topProducts = await Transaction.aggregate([
        { $match: { ...matchFilter, status: 'completed' } },
        { $unwind: '$items' },
        { $group: { 
          _id: '$items.product_id', 
          productName: { $first: '$items.product_name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.unit_price'] } }
        }},
        { $sort: { revenue: -1 } },
        { $limit: limit },
        { $project: { 
          productId: '$_id', 
          productName: 1, 
          quantitySold: 1, 
          revenue: 1, 
          _id: 0 
        }}
      ]);

      return topProducts;
    } catch (error) {
      console.error('Error getting top products:', error);
      return [];
    }
  }

  /**
   * Get sales by month
   */
  private static async getSalesByMonth(storeId?: string): Promise<any[]> {
    try {
      const matchFilter = storeId ? { store_id: storeId } : {};
      
      const salesByMonth = await Transaction.aggregate([
        { $match: { ...matchFilter, status: 'completed' } },
        { $group: { 
          _id: { 
            year: { $year: '$created_at' }, 
            month: { $month: '$created_at' } 
          }, 
          sales: { $sum: '$total_amount' },
          transactions: { $sum: 1 }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 },
        { $project: { 
          month: { $dateToString: { format: '%Y-%m', date: { $dateFromParts: { year: '$_id.year', month: '$_id.month', day: 1 } } } },
          sales: 1, 
          transactions: 1, 
          _id: 0 
        }}
      ]);

      return salesByMonth;
    } catch (error) {
      console.error('Error getting sales by month:', error);
      return [];
    }
  }

  /**
   * Get sales by period
   */
  private static async getSalesByPeriod(storeId?: string, period?: string): Promise<any[]> {
    try {
      const matchFilter = storeId ? { store_id: storeId, status: 'completed' } : { status: 'completed' };
      
      let groupBy = {};
      if (period === 'today') {
        groupBy = { hour: { $hour: '$created_at' } };
      } else if (period === 'week') {
        groupBy = { day: { $dayOfWeek: '$created_at' } };
      } else {
        groupBy = { day: { $dayOfMonth: '$created_at' } };
      }

      const salesByPeriod = await Transaction.aggregate([
        { $match: matchFilter },
        { $group: { 
          _id: groupBy, 
          revenue: { $sum: '$total_amount' },
          transactions: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } },
        { $project: { 
          period: '$_id', 
          revenue: 1, 
          transactions: 1, 
          _id: 0 
        }}
      ]);

      return salesByPeriod;
    } catch (error) {
      console.error('Error getting sales by period:', error);
      return [];
    }
  }
}
