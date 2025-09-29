import { NotificationService } from './notificationService';
import { TransactionService } from './transactionService';
import { AnalyticsService } from './analyticsService';
import { logger } from '../utils/logger';
import { getStoreTimezone } from '../utils/timezone';
import { DateTime } from 'luxon';
import mongoose from 'mongoose';

export interface MilestoneConfig {
  daily_sales_milestones: number[];
  monthly_sales_milestones: number[];
  transaction_count_milestones: number[];
  customer_count_milestones: number[];
}

export interface GoalConfig {
  daily_sales_goal: number;
  monthly_sales_goal: number;
  daily_transaction_goal: number;
  daily_customer_goal: number;
}

// Schema for persistent milestone tracking
const milestoneTrackingSchema = new mongoose.Schema({
  store_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  milestone_type: { 
    type: String, 
    enum: ['daily_sales', 'monthly_sales', 'transaction_count', 'customer_count'],
    required: true 
  },
  last_checked_value: { type: Number, default: 0 },
  last_checked_date: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

milestoneTrackingSchema.index({ store_id: 1, user_id: 1, milestone_type: 1 }, { unique: true });

const MilestoneTracking = mongoose.model('MilestoneTracking', milestoneTrackingSchema);

export class MilestoneService {
  private static milestoneConfigs: Map<string, MilestoneConfig> = new Map();
  private static goalConfigs: Map<string, GoalConfig> = new Map();

  /**
   * Set milestone configuration for a store
   */
  static setMilestoneConfig(storeId: string, config: MilestoneConfig): void {
    this.milestoneConfigs.set(storeId, config);
    logger.info(`Milestone config set for store ${storeId}`, config);
  }

  /**
   * Set goal configuration for a store
   */
  static setGoalConfig(storeId: string, config: GoalConfig): void {
    this.goalConfigs.set(storeId, config);
    logger.info(`Goal config set for store ${storeId}`, config);
  }

  /**
   * Get default milestone configuration
   */
  static getDefaultMilestoneConfig(): MilestoneConfig {
    return {
      daily_sales_milestones: [500, 1000, 1500, 2000, 2500, 3000, 5000, 7500, 10000],
      monthly_sales_milestones: [10000, 25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000],
      transaction_count_milestones: [10, 25, 50, 75, 100, 150, 200, 300, 500],
      customer_count_milestones: [5, 10, 20, 30, 50, 75, 100, 150, 200]
    };
  }

  /**
   * Get default goal configuration
   */
  static getDefaultGoalConfig(): GoalConfig {
    return {
      daily_sales_goal: 2000,
      monthly_sales_goal: 50000,
      daily_transaction_goal: 50,
      daily_customer_goal: 25
    };
  }

  /**
   * Get last checked milestone value from database
   */
  private static async getLastCheckedValue(
    storeId: string,
    userId: string,
    milestoneType: string
  ): Promise<number> {
    try {
      const tracking = await MilestoneTracking.findOne({
        store_id: storeId,
        user_id: userId,
        milestone_type: milestoneType
      });
      
      return tracking ? tracking.last_checked_value : 0;
    } catch (error) {
      logger.error(`Error getting last checked value for ${milestoneType}:`, error);
      return 0;
    }
  }

  /**
   * Update last checked milestone value in database
   */
  private static async updateLastCheckedValue(
    storeId: string,
    userId: string,
    milestoneType: string,
    value: number
  ): Promise<void> {
    try {
      await MilestoneTracking.findOneAndUpdate(
        {
          store_id: storeId,
          user_id: userId,
          milestone_type: milestoneType
        },
        {
          last_checked_value: value,
          last_checked_date: new Date(),
          updated_at: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error(`Error updating last checked value for ${milestoneType}:`, error);
    }
  }

  /**
   * Check and trigger milestone notifications for a store
   */
  static async checkMilestones(storeId: string, userId: string): Promise<void> {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      
      // Get today's data
      const todayStart = now.startOf('day').toJSDate();
      const todayEnd = now.endOf('day').toJSDate();
      
      // Get this month's data
      const monthStart = now.startOf('month').toJSDate();
      const monthEnd = now.endOf('month').toJSDate();

      // Get configuration
      const milestoneConfig = this.milestoneConfigs.get(storeId) || this.getDefaultMilestoneConfig();
      const goalConfig = this.goalConfigs.get(storeId) || this.getDefaultGoalConfig();

      // Get today's sales data
      const todayTransactions = await TransactionService.getTransactions(
        storeId,
        'completed',
        undefined,
        todayStart.toISOString(),
        todayEnd.toISOString(),
        1,
        1000
      );

      // Get this month's sales data
      const monthTransactions = await TransactionService.getTransactions(
        storeId,
        'completed',
        undefined,
        monthStart.toISOString(),
        monthEnd.toISOString(),
        1,
        10000
      );

      // Calculate metrics
      const todaySales = todayTransactions.transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const monthSales = monthTransactions.transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const todayTransactionCount = todayTransactions.transactions.length;
      const todayCustomerCount = new Set(todayTransactions.transactions.map(t => t.customer_id).filter(Boolean)).size;

      // Check daily sales milestones
      await this.checkSalesMilestones(
        storeId,
        userId,
        'daily_sales',
        todaySales,
        milestoneConfig.daily_sales_milestones,
        goalConfig.daily_sales_goal
      );

      // Check monthly sales milestones
      await this.checkSalesMilestones(
        storeId,
        userId,
        'monthly_sales',
        monthSales,
        milestoneConfig.monthly_sales_milestones,
        goalConfig.monthly_sales_goal
      );

      // Check transaction count milestones
      await this.checkCountMilestones(
        storeId,
        userId,
        'transaction_count',
        todayTransactionCount,
        milestoneConfig.transaction_count_milestones,
        goalConfig.daily_transaction_goal
      );

      // Check customer count milestones
      await this.checkCountMilestones(
        storeId,
        userId,
        'customer_count',
        todayCustomerCount,
        milestoneConfig.customer_count_milestones,
        goalConfig.daily_customer_goal
      );

      // Update last checked values in database
      await Promise.all([
        this.updateLastCheckedValue(storeId, userId, 'daily_sales', todaySales),
        this.updateLastCheckedValue(storeId, userId, 'monthly_sales', monthSales),
        this.updateLastCheckedValue(storeId, userId, 'transaction_count', todayTransactionCount),
        this.updateLastCheckedValue(storeId, userId, 'customer_count', todayCustomerCount)
      ]);

    } catch (error) {
      logger.error(`Error checking milestones for store ${storeId}:`, error);
    }
  }

  /**
   * Check sales milestones
   */
  private static async checkSalesMilestones(
    storeId: string,
    userId: string,
    milestoneType: 'daily_sales' | 'monthly_sales',
    currentValue: number,
    milestones: number[],
    goalValue: number
  ): Promise<void> {
    const lastValue = await this.getLastCheckedValue(storeId, userId, milestoneType);

    // Check each milestone
    for (const milestone of milestones) {
      if (currentValue >= milestone && lastValue < milestone) {
        const goalPercentage = (milestone / goalValue) * 100;
        
        await NotificationService.createMilestoneNotification(userId, storeId, {
          milestone_type: milestoneType,
          milestone_value: milestone,
          goal_percentage: Math.round(goalPercentage),
          previous_value: lastValue
        });

        logger.info(`Milestone reached: ${milestoneType} ${milestone} for store ${storeId}`);
      }
    }

    // Update last value in database
    await this.updateLastCheckedValue(storeId, userId, milestoneType, currentValue);
  }

  /**
   * Check count milestones
   */
  private static async checkCountMilestones(
    storeId: string,
    userId: string,
    milestoneType: 'transaction_count' | 'customer_count',
    currentValue: number,
    milestones: number[],
    goalValue: number
  ): Promise<void> {
    const lastValue = await this.getLastCheckedValue(storeId, userId, milestoneType);

    // Check each milestone
    for (const milestone of milestones) {
      if (currentValue >= milestone && lastValue < milestone) {
        const goalPercentage = (milestone / goalValue) * 100;
        
        await NotificationService.createMilestoneNotification(userId, storeId, {
          milestone_type: milestoneType,
          milestone_value: milestone,
          goal_percentage: Math.round(goalPercentage),
          previous_value: lastValue
        });

        logger.info(`Milestone reached: ${milestoneType} ${milestone} for store ${storeId}`);
      }
    }

    // Update last value in database
    await this.updateLastCheckedValue(storeId, userId, milestoneType, currentValue);
  }

  /**
   * Trigger daily summary notification
   */
  static async triggerDailySummary(storeId: string, userId: string): Promise<void> {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      
      // Get today's data
      const todayStart = now.startOf('day').toJSDate();
      const todayEnd = now.endOf('day').toJSDate();
      
      // Get yesterday's data for comparison
      const yesterdayStart = now.minus({ days: 1 }).startOf('day').toJSDate();
      const yesterdayEnd = now.minus({ days: 1 }).endOf('day').toJSDate();

      // Get today's transactions
      const todayTransactions = await TransactionService.getTransactions(
        storeId,
        'completed',
        undefined,
        todayStart.toISOString(),
        todayEnd.toISOString(),
        1,
        1000
      );

      // Get yesterday's transactions
      const yesterdayTransactions = await TransactionService.getTransactions(
        storeId,
        'completed',
        undefined,
        yesterdayStart.toISOString(),
        yesterdayEnd.toISOString(),
        1,
        1000
      );

      // Calculate metrics
      const todaySales = todayTransactions.transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const yesterdaySales = yesterdayTransactions.transactions.reduce((sum, t) => sum + t.total_amount, 0);
      const todayTransactionCount = todayTransactions.transactions.length;
      
      // Calculate growth percentage
      const growthPercentage = yesterdaySales > 0 
        ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 
        : todaySales > 0 ? 100 : 0;

      // Find top product (simplified - you might want to enhance this)
      const productCounts: { [key: string]: { count: number; name: string } } = {};
      todayTransactions.transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          if (!productCounts[item.product_id]) {
            productCounts[item.product_id] = { count: 0, name: item.product_name };
          }
          productCounts[item.product_id].count += item.quantity;
        });
      });

      const topProduct = Object.values(productCounts).reduce((top, current) => 
        current.count > top.count ? current : top, 
        { count: 0, name: 'No sales yet' }
      );

      // Get goal configuration
      const goalConfig = this.goalConfigs.get(storeId) || this.getDefaultGoalConfig();
      
      const dailyProgress = (todaySales / goalConfig.daily_sales_goal) * 100;
      const monthlyProgress = await this.getMonthlyProgress(storeId, goalConfig.monthly_sales_goal);

      // Create daily summary notification
      await NotificationService.createDailySummaryNotification(userId, storeId, {
        total_sales: todaySales,
        transaction_count: todayTransactionCount,
        top_product: topProduct.name,
        growth_percentage: growthPercentage,
        daily_goal: goalConfig.daily_sales_goal,
        monthly_goal: goalConfig.monthly_sales_goal,
        daily_progress: Math.round(dailyProgress),
        monthly_progress: Math.round(monthlyProgress)
      });

      logger.info(`Daily summary notification sent for store ${storeId}`);

    } catch (error) {
      logger.error(`Error triggering daily summary for store ${storeId}:`, error);
    }
  }

  /**
   * Get monthly progress percentage
   */
  private static async getMonthlyProgress(storeId: string, monthlyGoal: number): Promise<number> {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      
      const monthStart = now.startOf('month').toJSDate();
      const monthEnd = now.endOf('month').toJSDate();

      const monthTransactions = await TransactionService.getTransactions(
        storeId,
        'completed',
        undefined,
        monthStart.toISOString(),
        monthEnd.toISOString(),
        1,
        10000
      );

      const monthSales = monthTransactions.transactions.reduce((sum, t) => sum + t.total_amount, 0);
      return (monthSales / monthlyGoal) * 100;
    } catch (error) {
      logger.error('Error calculating monthly progress:', error);
      return 0;
    }
  }

  /**
   * Check for achievement notifications
   */
  static async checkAchievements(storeId: string, userId: string, transactionData: any): Promise<void> {
    try {
      // Check for big sale achievement
      if (transactionData.total_amount >= 1000) {
        await NotificationService.createAchievementNotification(
          userId,
          storeId,
          'big_sale',
          { sale_amount: transactionData.total_amount }
        );
      }

      // You can add more achievement checks here
      // - First sale of the day
      // - Streak achievements
      // - etc.

    } catch (error) {
      logger.error(`Error checking achievements for store ${storeId}:`, error);
    }
  }

  /**
   * Reset milestone tracking for a user (useful for clearing fake notifications)
   */
  static async resetMilestoneTracking(storeId: string, userId: string): Promise<void> {
    try {
      await MilestoneTracking.deleteMany({
        store_id: storeId,
        user_id: userId
      });

      logger.info(`Reset milestone tracking for store ${storeId}, user ${userId}`);
    } catch (error) {
      logger.error(`Error resetting milestone tracking for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get milestone tracking status for a user
   */
  static async getMilestoneTrackingStatus(storeId: string, userId: string): Promise<any[]> {
    try {
      const tracking = await MilestoneTracking.find({
        store_id: storeId,
        user_id: userId
      }).lean();

      return tracking;
    } catch (error) {
      logger.error(`Error getting milestone tracking status for store ${storeId}:`, error);
      throw error;
    }
  }
}
