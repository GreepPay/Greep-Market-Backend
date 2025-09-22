import { Product } from '../models/Product';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface DashboardMetrics {
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  growthRate: number;
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
        Product.countDocuments({ 
          ...productFilter, 
          $expr: { $lte: ['$stock_quantity', '$min_stock_level'] }
        }),
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

      // Calculate transaction count and average transaction value
      const totalTransactions = await Transaction.countDocuments({ ...transactionFilter, status: 'completed' });
      const averageTransactionValue = totalTransactions > 0 ? (totalSales[0]?.total || 0) / totalTransactions : 0;

      // Calculate growth rate (current month vs previous month)
      const growthRate = await this.calculateGrowthRate(storeId);

      // Get sales by month for the last 12 months
      const salesByMonth = await this.getSalesByMonth(storeId);

      return {
        totalSales: totalSales[0]?.total || 0,
        totalTransactions,
        averageTransactionValue,
        growthRate,
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
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get sales analytics for a specific date range
   */
  static async getSalesAnalyticsByDateRange(
    storeId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<SalesAnalytics> {
    try {
      const query: any = {
        store_id: storeId,
        status: 'completed',
        created_at: {
          $gte: startDate,
          $lte: endDate
        }
      };

      const [transactions, totalRevenue, totalTransactions] = await Promise.all([
        Transaction.find(query).sort({ created_at: -1 }).lean(),
        Transaction.aggregate([
          { $match: query },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        Transaction.countDocuments(query)
      ]);

      const revenue = totalRevenue[0]?.total || 0;
      const transactionCount = totalTransactions || 0;
      const averageTransactionValue = transactionCount > 0 ? revenue / transactionCount : 0;

      // Get sales by period (daily for custom ranges, monthly for longer ranges)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      let salesByPeriod: Array<{ period: string; revenue: number; transactions: number }> = [];

      if (daysDiff <= 31) {
        // Daily breakdown
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);

          const dayQuery = { ...query, created_at: { $gte: dayStart, $lte: dayEnd } };
          
          const [dayRevenue, dayTransactions] = await Promise.all([
            Transaction.aggregate([
              { $match: dayQuery },
              { $group: { _id: null, total: { $sum: '$total_amount' } } }
            ]),
            Transaction.countDocuments(dayQuery)
          ]);

          salesByPeriod.push({
            period: d.toISOString().split('T')[0],
            revenue: dayRevenue[0]?.total || 0,
            transactions: dayTransactions || 0
          });
        }
      } else {
        // Monthly breakdown
        const current = new Date(startDate);
        while (current <= endDate) {
          const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
          const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
          
          const monthQuery = { 
            ...query, 
            created_at: { 
              $gte: monthStart, 
              $lte: monthEnd 
            } 
          };
          
          const [monthRevenue, monthTransactions] = await Promise.all([
            Transaction.aggregate([
              { $match: monthQuery },
              { $group: { _id: null, total: { $sum: '$total_amount' } } }
            ]),
            Transaction.countDocuments(monthQuery)
          ]);

          salesByPeriod.push({
            period: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
            revenue: monthRevenue[0]?.total || 0,
            transactions: monthTransactions || 0
          });

          current.setMonth(current.getMonth() + 1);
        }
      }

      // Get top products for the period
      const topProducts = await Transaction.aggregate([
        { $match: query },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product_id',
            productName: { $first: '$items.name' },
            quantitySold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
      ]);

      // Get payment method breakdown
      const paymentBreakdown = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $ifNull: ['$payment_method', 'Unknown'] },
            count: { $sum: 1 },
            totalAmount: { $sum: '$total_amount' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return {
        totalRevenue: revenue,
        totalTransactions: transactionCount,
        averageTransactionValue,
        salesByPeriod,
        topProducts: topProducts.map(p => ({
          productId: p._id,
          productName: p.productName,
          quantitySold: p.quantitySold,
          revenue: p.revenue
        })),
        paymentMethodBreakdown: paymentBreakdown.map(p => ({
          method: p._id,
          count: p.count,
          amount: p.totalAmount
        }))
      };
    } catch (error) {
      logger.error('Error getting sales analytics by date range:', error);
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
      } else if (period === 'week' || period === '7d') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        dateFilter = { created_at: { $gte: startOfWeek } };
      } else if (period === 'month' || period === '30d') {
        const startOfMonth = new Date();
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        dateFilter = { created_at: { $gte: startOfMonth } };
      } else if (period === '90d') {
        const startOfPeriod = new Date();
        startOfPeriod.setDate(startOfPeriod.getDate() - 90);
        dateFilter = { created_at: { $gte: startOfPeriod } };
      } else if (period === 'year') {
        const startOfYear = new Date();
        startOfYear.setFullYear(startOfYear.getFullYear() - 1);
        dateFilter = { created_at: { $gte: startOfYear } };
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
          _id: { $ifNull: ['$payment_method', 'Unknown'] }, 
          count: { $sum: 1 }, 
          amount: { $sum: '$total_amount' } 
        }},
        { $project: { 
          method: '$_id', 
          count: 1, 
          amount: 1, 
          _id: 0 
        }},
        { $sort: { count: -1 } }
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
      logger.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get product analytics for a specific date range
   */
  static async getProductAnalyticsByDateRange(
    storeId: string, 
    startDate: Date, 
    endDate: Date,
    limit: number = 10
  ): Promise<ProductAnalytics> {
    try {
      const filter = { store_id: storeId };
      
      // Get products created in the date range
      const productFilter = {
        ...filter,
        created_at: {
          $gte: startDate,
          $lte: endDate
        }
      };

      const [
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        topSellingProducts,
        categoryBreakdown
      ] = await Promise.all([
        Product.countDocuments(productFilter),
        Product.countDocuments({ ...productFilter, is_active: true }),
        Product.aggregate([
          { $match: filter },
          { $addFields: {
            isLowStock: {
              $and: [
                { $lte: ['$stock_quantity', { $ifNull: ['$min_stock_level', 5] }] },
                { $gt: ['$stock_quantity', 0] }
              ]
            }
          }},
          { $match: { isLowStock: true } },
          { $count: 'count' }
        ]).then(result => result[0]?.count || 0),
        Product.find({
          ...filter,
          stock_quantity: 0
        }).countDocuments(),
        Transaction.aggregate([
          {
            $match: {
              store_id: storeId,
              status: 'completed',
              created_at: { $gte: startDate, $lte: endDate }
            }
          },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.product_id',
              productName: { $first: '$items.name' },
              quantitySold: { $sum: '$items.quantity' },
              revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: limit }
        ]),
        Product.aggregate([
          { $match: productFilter },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              totalValue: { $sum: { $multiply: ['$price', '$stock_quantity'] } }
            }
          }
        ])
      ]);

      return {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        topSellingProducts: topSellingProducts.map(p => ({
          productId: p._id,
          productName: p.productName,
          quantitySold: p.quantitySold,
          revenue: p.revenue
        })),
        categoryBreakdown: categoryBreakdown.map(c => ({
          category: c._id,
          count: c.count,
          totalValue: c.totalValue
        }))
      };
    } catch (error) {
      logger.error('Error getting product analytics by date range:', error);
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
        Product.aggregate([
          { $match: filter },
          { $addFields: {
            isLowStock: {
              $and: [
                { $lte: ['$stock_quantity', { $ifNull: ['$min_stock_level', 5] }] },
                { $gt: ['$stock_quantity', 0] }
              ]
            }
          }},
          { $match: { isLowStock: true } },
          { $count: 'count' }
        ]).then(result => result[0]?.count || 0),
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
      logger.error('Error getting product analytics:', error);
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
      logger.error('Error getting inventory analytics:', error);
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
      logger.error('Error getting top products:', error);
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
      logger.error('Error getting sales by month:', error);
      return [];
    }
  }

  /**
   * Calculate growth rate (current month vs previous month)
   */
  private static async calculateGrowthRate(storeId?: string): Promise<number> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const filter = storeId ? { store_id: storeId, status: 'completed' } : { status: 'completed' };

      const [currentMonthSales, previousMonthSales] = await Promise.all([
        Transaction.aggregate([
          { $match: { ...filter, created_at: { $gte: currentMonthStart } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        Transaction.aggregate([
          { $match: { ...filter, created_at: { $gte: previousMonthStart, $lte: previousMonthEnd } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ])
      ]);

      const currentTotal = currentMonthSales[0]?.total || 0;
      const previousTotal = previousMonthSales[0]?.total || 0;

      if (previousTotal === 0) {
        return currentTotal > 0 ? 100 : 0; // 100% growth if no previous data but current exists
      }

      const growthRate = ((currentTotal - previousTotal) / previousTotal) * 100;
      return Math.round(growthRate * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      logger.error('Error calculating growth rate:', error);
      return 0;
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
      logger.error('Error getting sales by period:', error);
      return [];
    }
  }
}
