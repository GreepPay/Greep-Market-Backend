import { Product } from '../models/Product';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { ExpenseService } from './expenseService';
import { logger } from '../utils/logger';

export interface DashboardFilters {
  dateRange?: string;
  paymentMethod?: string;
  orderSource?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DashboardMetrics {
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  growthRate: number;
  totalProducts: number;
  lowStockItems: number;
  todaySales: number;
  monthlySales: number;
  totalExpenses: number;
  monthlyExpenses: number;
  netProfit: number;
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
   * Get dashboard metrics with filtering support
   */
  static async getDashboardMetrics(storeId?: string, filters?: DashboardFilters): Promise<DashboardMetrics> {
    try {
      // Debug logging
      logger.info('Dashboard metrics request:', { storeId, filters });
      
      // Log the date filter that will be applied
      const dateFilter = this.getDateFilter(filters);
      logger.info('Date filter applied:', { dateFilter, filters });
      
      // Build base query filters
      const productFilter = storeId ? { store_id: storeId } : {};
      let transactionFilter: any = storeId ? { store_id: storeId } : {};

      // Apply filters
      if (filters) {
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          transactionFilter.status = filters.status;
        } else {
          transactionFilter.status = 'completed'; // Default to completed
        }

        // Apply payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== 'all') {
          transactionFilter.payment_method = filters.paymentMethod;
        }

        // Note: order_source filter is not available in current Transaction model
        // This can be added later if needed

        // Apply date range filter
        const dateFilter = this.getDateFilter(filters);
        if (dateFilter) {
          transactionFilter.created_at = dateFilter;
          logger.info('Applied date filter:', { dateFilter, transactionFilter });
        }
      } else {
        transactionFilter.status = 'completed'; // Default to completed
      }

      // Get current date ranges for today/monthly calculations
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Create separate filters for today and monthly calculations
      // Today filter: use the applied date filter (for "today" this will be today's range)
      // Monthly filter: always use the full month range for monthly calculations
      const todayFilter = transactionFilter; // Use the filtered date range
      const monthlyFilter = { ...transactionFilter, created_at: { $gte: startOfMonth } }; // Always use full month for monthly data

      // Get expense data - use same date filtering as transactions
      let expenseStartDate, expenseEndDate;
      if (filters && filters.dateRange) {
        // Use the same date range as transactions
        const dateFilter = this.getDateFilter(filters);
        if (dateFilter) {
          expenseStartDate = dateFilter.$gte;
          expenseEndDate = dateFilter.$lte;
        } else {
          expenseStartDate = startOfDay;
          expenseEndDate = endOfDay;
        }
      } else {
        expenseStartDate = startOfDay;
        expenseEndDate = endOfDay;
      }
      
      // Debug logging for filters
      logger.info('Filter breakdown:', { 
        todayFilter, 
        monthlyFilter, 
        expenseStartDate: expenseStartDate?.toISOString(), 
        expenseEndDate: expenseEndDate?.toISOString(),
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
        startOfMonth: startOfMonth.toISOString(),
        endOfMonth: endOfMonth.toISOString()
      });
      
      const expenseStats = await ExpenseService.getExpenseStats(storeId, expenseStartDate, expenseEndDate);
        
      // Monthly expenses should always use monthly date range
      const monthlyExpenseStats = await ExpenseService.getExpenseStats(storeId, startOfMonth, endOfMonth);

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
        Transaction.find(todayFilter),
        Transaction.find(monthlyFilter),
        Transaction.find(transactionFilter).sort({ created_at: -1 }).limit(10),
        this.getTopProducts(storeId, 5, filters)
      ]);

      // Calculate totals
      const todaySales = todayTransactions.reduce((sum, t) => sum + t.total_amount, 0);
      const monthlySales = monthlyTransactions.reduce((sum, t) => sum + t.total_amount, 0);
      const totalSales = await Transaction.aggregate([
        { $match: transactionFilter },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ]);

      // Calculate transaction count and average transaction value
      const totalTransactions = await Transaction.countDocuments(transactionFilter);
      const averageTransactionValue = totalTransactions > 0 ? (totalSales[0]?.total || 0) / totalTransactions : 0;

      // Calculate growth rate (current period vs previous period)
      const growthRate = await this.calculateGrowthRate(storeId, filters);

      // Get sales data based on the filter period
      let salesByPeriod;
      if (filters && filters.dateRange) {
        // Use the appropriate period-based sales data
        salesByPeriod = await this.getSalesByPeriod(storeId, filters.dateRange);
      } else {
        // Default to monthly data for unfiltered dashboard
        salesByPeriod = await this.getSalesByMonth(storeId, filters);
      }

      // Calculate expense totals
      const totalExpenses = expenseStats.totalAmount;
      const monthlyExpenses = monthlyExpenseStats.totalAmount;
      const netProfit = (totalSales[0]?.total || 0) - totalExpenses;

      // Return consistent data structure
      return {
        totalSales: totalSales[0]?.total || 0,
        totalTransactions,
        averageTransactionValue,
        growthRate,
        totalProducts,
        lowStockItems: lowStockProducts,
        todaySales: todaySales,
        monthlySales: monthlySales,
        totalExpenses,
        monthlyExpenses,
        netProfit,
        topProducts: topProductsData,
        recentTransactions: recentTransactions.map(t => ({
          id: t._id.toString(),
          totalAmount: t.total_amount,
          paymentMethod: t.payment_method,
          createdAt: t.created_at
        })),
        salesByMonth: salesByPeriod
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
   * Get filtered transactions for dashboard
   */
  static async getFilteredTransactions(storeId?: string, filters?: DashboardFilters, limit: number = 50): Promise<any[]> {
    try {
      let transactionFilter: any = storeId ? { store_id: storeId } : {};
      
      // Apply filters
      if (filters) {
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          transactionFilter.status = filters.status;
        } else {
          transactionFilter.status = 'completed'; // Default to completed
        }

        // Apply payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== 'all') {
          transactionFilter.payment_method = filters.paymentMethod;
        }

        // Note: order_source filter is not available in current Transaction model
        // This can be added later if needed

        // Apply date range filter
        const dateFilter = this.getDateFilter(filters);
        if (dateFilter) {
          transactionFilter.created_at = dateFilter;
        }
      } else {
        transactionFilter.status = 'completed'; // Default to completed
      }

      const transactions = await Transaction.find(transactionFilter)
        .sort({ created_at: -1 })
        .limit(limit)
        .select('_id total_amount payment_method status created_at customer_id items')
        .lean();

      return transactions.map(t => ({
        id: t._id.toString(),
        totalAmount: t.total_amount,
        paymentMethod: t.payment_method,
        status: t.status,
        createdAt: t.created_at,
        customerId: t.customer_id,
        itemCount: t.items?.length || 0
      }));
    } catch (error) {
      logger.error('Error getting filtered transactions:', error);
      return [];
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
   * Get date filter based on filters
   */
  private static getDateFilter(filters?: DashboardFilters): any {
    if (!filters) return null;

    // If date range is provided, prioritize it over custom dates
    if (filters.dateRange) {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          return {
            $gte: startDate,
            $lte: endOfDay
          };
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          return {
            $gte: startDate,
            $lte: endOfMonth
          };
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          return null;
      }

      return {
        $gte: startDate,
        $lte: now
      };
    }

    // If custom date range is provided (convert strings to dates)
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      return {
        $gte: startDate,
        $lte: endDate
      };
    }

    return null;
  }

  /**
   * Get top selling products
   */
  private static async getTopProducts(storeId?: string, limit: number = 10, filters?: DashboardFilters): Promise<any[]> {
    try {
      let matchFilter: any = storeId ? { store_id: storeId } : {};
      
      // Apply filters
      if (filters) {
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          matchFilter.status = filters.status;
        } else {
          matchFilter.status = 'completed'; // Default to completed
        }

        // Apply payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== 'all') {
          matchFilter.payment_method = filters.paymentMethod;
        }

        // Apply order source filter
        if (filters.orderSource && filters.orderSource !== 'all') {
          matchFilter.order_source = filters.orderSource;
        }

        // Apply date range filter
        const dateFilter = this.getDateFilter(filters);
        if (dateFilter) {
          matchFilter.created_at = dateFilter;
        }
      } else {
        matchFilter.status = 'completed'; // Default to completed
      }
      
      const topProducts = await Transaction.aggregate([
        { $match: matchFilter },
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
  private static async getSalesByMonth(storeId?: string, filters?: DashboardFilters): Promise<any[]> {
    try {
      let matchFilter: any = storeId ? { store_id: storeId } : {};
      
      // Apply filters
      if (filters) {
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          matchFilter.status = filters.status;
        } else {
          matchFilter.status = 'completed'; // Default to completed
        }

        // Apply payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== 'all') {
          matchFilter.payment_method = filters.paymentMethod;
        }

        // Apply order source filter
        if (filters.orderSource && filters.orderSource !== 'all') {
          matchFilter.order_source = filters.orderSource;
        }

        // Apply date range filter
        const dateFilter = this.getDateFilter(filters);
        if (dateFilter) {
          matchFilter.created_at = dateFilter;
        }
      } else {
        matchFilter.status = 'completed'; // Default to completed
      }
      
      const salesByMonth = await Transaction.aggregate([
        { $match: matchFilter },
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
   * Calculate growth rate (current period vs previous period)
   */
  private static async calculateGrowthRate(storeId?: string, filters?: DashboardFilters): Promise<number> {
    try {
      const now = new Date();
      let currentPeriodStart: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;

      // Determine period based on filters
      if (filters?.dateRange) {
        const days = this.getDaysFromDateRange(filters.dateRange);
        currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000);
        previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
      } else {
        // Default to monthly comparison
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }

      let baseFilter: any = storeId ? { store_id: storeId } : {};
      
      // Apply filters
      if (filters) {
        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          baseFilter.status = filters.status;
        } else {
          baseFilter.status = 'completed'; // Default to completed
        }

        // Apply payment method filter
        if (filters.paymentMethod && filters.paymentMethod !== 'all') {
          baseFilter.payment_method = filters.paymentMethod;
        }

        // Apply order source filter
        if (filters.orderSource && filters.orderSource !== 'all') {
          baseFilter.order_source = filters.orderSource;
        }
      } else {
        baseFilter.status = 'completed'; // Default to completed
      }

      const [currentPeriodSales, previousPeriodSales] = await Promise.all([
        Transaction.aggregate([
          { $match: { ...baseFilter, created_at: { $gte: currentPeriodStart } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ]),
        Transaction.aggregate([
          { $match: { ...baseFilter, created_at: { $gte: previousPeriodStart, $lte: previousPeriodEnd } } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ])
      ]);

      const currentTotal = currentPeriodSales[0]?.total || 0;
      const previousTotal = previousPeriodSales[0]?.total || 0;

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
   * Get number of days from date range string
   */
  private static getDaysFromDateRange(dateRange: string): number {
    switch (dateRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }

  /**
   * Get sales by period
   */
  private static async getSalesByPeriod(storeId?: string, period?: string): Promise<any[]> {
    try {
      const matchFilter = storeId ? { store_id: storeId, status: 'completed' } : { status: 'completed' };
      
      let groupBy = {};
      let periodFormat = {};
      
      if (period === 'today') {
        groupBy = { 
          year: { $year: '$created_at' }, 
          month: { $month: '$created_at' },
          day: { $dayOfMonth: '$created_at' },
          hour: { $hour: '$created_at' } 
        };
        periodFormat = { 
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $toString: { $cond: { if: { $lt: ['$_id.month', 10] }, then: { $concat: ['0', { $toString: '$_id.month' }] }, else: { $toString: '$_id.month' } } } },
            '-',
            { $toString: { $cond: { if: { $lt: ['$_id.day', 10] }, then: { $concat: ['0', { $toString: '$_id.day' }] }, else: { $toString: '$_id.day' } } } },
            ' ',
            { $toString: { $cond: { if: { $lt: ['$_id.hour', 10] }, then: { $concat: ['0', { $toString: '$_id.hour' }] }, else: { $toString: '$_id.hour' } } } },
            ':00'
          ]
        };
      } else if (period === 'week' || period === '7d') {
        groupBy = { 
          year: { $year: '$created_at' }, 
          week: { $week: '$created_at' },
          dayOfWeek: { $dayOfWeek: '$created_at' } 
        };
        periodFormat = { 
          $concat: [
            { $toString: '$_id.year' },
            '-W',
            { $toString: '$_id.week' },
            '-Day',
            { $toString: '$_id.dayOfWeek' }
          ]
        };
      } else if (period === 'month' || period === '30d') {
        groupBy = { 
          year: { $year: '$created_at' }, 
          month: { $month: '$created_at' },
          day: { $dayOfMonth: '$created_at' } 
        };
        periodFormat = { 
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $toString: { $cond: { if: { $lt: ['$_id.month', 10] }, then: { $concat: ['0', { $toString: '$_id.month' }] }, else: { $toString: '$_id.month' } } } },
            '-',
            { $toString: { $cond: { if: { $lt: ['$_id.day', 10] }, then: { $concat: ['0', { $toString: '$_id.day' }] }, else: { $toString: '$_id.day' } } } }
          ]
        };
      } else {
        // Default to monthly grouping
        groupBy = { 
          year: { $year: '$created_at' }, 
          month: { $month: '$created_at' } 
        };
        periodFormat = { 
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $toString: { $cond: { if: { $lt: ['$_id.month', 10] }, then: { $concat: ['0', { $toString: '$_id.month' }] }, else: { $toString: '$_id.month' } } } }
          ]
        };
      }

      const salesByPeriod = await Transaction.aggregate([
        { $match: matchFilter },
        { $group: { 
          _id: groupBy, 
          sales: { $sum: '$total_amount' },
          transactions: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } },
        { $addFields: { 
          month: periodFormat
        }},
        { $project: { 
          month: 1, 
          sales: 1, 
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
