import cron from 'node-cron';
import { MilestoneService } from './milestoneService';
import { NotificationService } from './notificationService';
import { DailyLoginService } from './dailyLoginService';
import { logger } from '../utils/logger';
import { getStoreTimezone } from '../utils/timezone';
import { DateTime } from 'luxon';
import { maintenanceCleanup } from '../scripts/maintenanceCleanup';

export class SchedulerService {
  private static isInitialized = false;
  private static scheduledTasks: Map<string, any> = new Map();

  /**
   * Initialize all scheduled tasks
   */
  static initialize(): void {
    if (this.isInitialized) {
      logger.warn('SchedulerService already initialized');
      return;
    }

    logger.info('Initializing SchedulerService...');

    // Daily summary notifications at 6 PM and 9 PM
    this.scheduleDailySummaries();

    // Milestone checks every 30 minutes during business hours
    this.scheduleMilestoneChecks();

    // Cleanup old notifications daily at 2 AM
    this.scheduleCleanupTasks();

    this.isInitialized = true;
    logger.info('SchedulerService initialized successfully');
  }

  /**
   * Schedule daily summary notifications
   */
  private static scheduleDailySummaries(): void {
    // Evening summary at 6 PM
    const eveningTask = cron.schedule('0 18 * * *', async () => {
      logger.info('Running evening daily summary check...');
      await this.sendDailySummaries('evening');
    }, {
      timezone: 'Europe/Istanbul'
    });

    // Late evening summary at 9 PM
    const lateEveningTask = cron.schedule('0 21 * * *', async () => {
      logger.info('Running late evening daily summary check...');
      await this.sendDailySummaries('late_evening');
    }, {
      timezone: 'Europe/Istanbul'
    });

    this.scheduledTasks.set('evening_summary', eveningTask);
    this.scheduledTasks.set('late_evening_summary', lateEveningTask);

    // Start the tasks
    eveningTask.start();
    lateEveningTask.start();

    logger.info('Daily summary notifications scheduled');
  }

  /**
   * Schedule milestone checks
   */
  private static scheduleMilestoneChecks(): void {
    // Check milestones every 30 minutes during business hours (8 AM - 10 PM)
    const milestoneTask = cron.schedule('*/30 8-22 * * *', async () => {
      logger.info('Running milestone checks...');
      await this.checkAllMilestones();
    }, {
      timezone: 'Europe/Istanbul'
    });

    this.scheduledTasks.set('milestone_checks', milestoneTask);
    milestoneTask.start();

    logger.info('Milestone checks scheduled');
  }

  /**
   * Schedule cleanup tasks
   */
  private static scheduleCleanupTasks(): void {
    // Cleanup old notifications daily at 2 AM
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Running cleanup tasks...');
      await this.performCleanup();
    }, {
      timezone: 'Europe/Istanbul'
    });

    this.scheduledTasks.set('cleanup', cleanupTask);
    cleanupTask.start();

    logger.info('Cleanup tasks scheduled');
  }

  /**
   * Send daily summaries to all active stores
   */
  private static async sendDailySummaries(timeOfDay: 'evening' | 'late_evening'): Promise<void> {
    try {
      // For now, we'll use a default store and user
      // In a real implementation, you'd fetch all active stores and their users
      const defaultStoreId = 'default-store';
      const defaultUserId = 'default-user';

      // Set up default configurations if not already set
      if (!MilestoneService['milestoneConfigs'].has(defaultStoreId)) {
        MilestoneService.setMilestoneConfig(defaultStoreId, MilestoneService.getDefaultMilestoneConfig());
      }
      if (!MilestoneService['goalConfigs'].has(defaultStoreId)) {
        MilestoneService.setGoalConfig(defaultStoreId, MilestoneService.getDefaultGoalConfig());
      }

      await MilestoneService.triggerDailySummary(defaultStoreId, defaultUserId);

      logger.info(`Daily summary sent for ${timeOfDay}`);
    } catch (error) {
      logger.error('Error sending daily summaries:', error);
    }
  }

  /**
   * Check milestones for all active stores
   */
  private static async checkAllMilestones(): Promise<void> {
    try {
      // For now, we'll use a default store and user
      // In a real implementation, you'd fetch all active stores and their users
      const defaultStoreId = 'default-store';
      const defaultUserId = 'default-user';

      // Set up default configurations if not already set
      if (!MilestoneService['milestoneConfigs'].has(defaultStoreId)) {
        MilestoneService.setMilestoneConfig(defaultStoreId, MilestoneService.getDefaultMilestoneConfig());
      }
      if (!MilestoneService['goalConfigs'].has(defaultStoreId)) {
        MilestoneService.setGoalConfig(defaultStoreId, MilestoneService.getDefaultGoalConfig());
      }

      await MilestoneService.checkMilestones(defaultStoreId, defaultUserId);

      logger.info('Milestone checks completed');
    } catch (error) {
      logger.error('Error checking milestones:', error);
    }
  }

  /**
   * Perform cleanup tasks
   */
  private static async performCleanup(): Promise<void> {
    try {
      logger.info('Starting comprehensive maintenance cleanup...');
      
      // Run the comprehensive maintenance cleanup
      await maintenanceCleanup();
      
      logger.info('Maintenance cleanup completed successfully');
    } catch (error) {
      logger.error('Error performing maintenance cleanup:', error);
      
      // Fallback to basic cleanup if comprehensive cleanup fails
      try {
        logger.info('Running fallback basic cleanup...');
        
        // Clean up old notifications (older than 30 days)
        const deletedCount = await NotificationService.deleteOldNotifications(30);
        
        // Clean up expired notifications
        const expiredCount = await NotificationService.cleanupExpiredNotifications();

        // Clean up old daily login records
        DailyLoginService.cleanupOldRecords();

        logger.info(`Fallback cleanup completed: ${deletedCount} old notifications, ${expiredCount} expired notifications deleted, old login records cleaned`);
      } catch (fallbackError) {
        logger.error('Fallback cleanup also failed:', fallbackError);
      }
    }
  }

  /**
   * Manually trigger daily summary for a specific store
   */
  static async triggerDailySummary(storeId: string, userId: string): Promise<void> {
    try {
      await MilestoneService.triggerDailySummary(storeId, userId);
      logger.info(`Daily summary manually triggered for store ${storeId}`);
    } catch (error) {
      logger.error(`Error manually triggering daily summary for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger milestone check for a specific store
   */
  static async triggerMilestoneCheck(storeId: string, userId: string): Promise<void> {
    try {
      await MilestoneService.checkMilestones(storeId, userId);
      logger.info(`Milestone check manually triggered for store ${storeId}`);
    } catch (error) {
      logger.error(`Error manually triggering milestone check for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Stop all scheduled tasks
   */
  static stop(): void {
    logger.info('Stopping all scheduled tasks...');
    
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      logger.info(`Stopped task: ${name}`);
    });

    this.scheduledTasks.clear();
    this.isInitialized = false;
    
    logger.info('All scheduled tasks stopped');
  }

  /**
   * Get status of scheduled tasks
   */
  static getStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    
    this.scheduledTasks.forEach((task, name) => {
      status[name] = task.running;
    });

    return status;
  }

  /**
   * Add a new scheduled task
   */
  static addTask(name: string, cronExpression: string, taskFunction: () => Promise<void>, timezone: string = 'Europe/Istanbul'): void {
    if (this.scheduledTasks.has(name)) {
      logger.warn(`Task ${name} already exists, stopping existing task`);
      this.scheduledTasks.get(name).stop();
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        await taskFunction();
      } catch (error) {
        logger.error(`Error in scheduled task ${name}:`, error);
      }
    }, {
      timezone
    });

    this.scheduledTasks.set(name, task);
    logger.info(`Added new scheduled task: ${name} (${cronExpression})`);
  }

  /**
   * Remove a scheduled task
   */
  static removeTask(name: string): boolean {
    const task = this.scheduledTasks.get(name);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(name);
      logger.info(`Removed scheduled task: ${name}`);
      return true;
    }
    return false;
  }
}
