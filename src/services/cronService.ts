import * as cron from 'node-cron';
import { AutoCompleteService } from './autoCompleteService';
import { logger } from '../utils/logger';

export class CronService {
  private static autoCompleteJob: cron.ScheduledTask | null = null;

  /**
   * Start all cron jobs
   */
  static startAllJobs(): void {
    logger.info('Starting cron jobs...');
    
    // Start auto-complete job
    this.startAutoCompleteJob();
    
    logger.info('All cron jobs started successfully');
  }

  /**
   * Stop all cron jobs
   */
  static stopAllJobs(): void {
    logger.info('Stopping cron jobs...');
    
    if (this.autoCompleteJob) {
      this.autoCompleteJob.stop();
      this.autoCompleteJob = null;
      logger.info('Auto-complete cron job stopped');
    }
    
    logger.info('All cron jobs stopped');
  }

  /**
   * Start the auto-complete job that runs every hour
   */
  private static startAutoCompleteJob(): void {
    // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
    this.autoCompleteJob = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running scheduled auto-complete process...');
        
        const result = await AutoCompleteService.autoCompletePendingTransactions(3);
        
        logger.info(`Scheduled auto-complete completed: ${result.completed} transactions completed, ${result.errors} errors`);
        
      } catch (error) {
        logger.error('Error in scheduled auto-complete process:', error);
      }
    }, {
      timezone: 'UTC'
    });

    logger.info('Auto-complete cron job scheduled to run every hour');
  }

  /**
   * Manually trigger the auto-complete process
   */
  static async triggerAutoComplete(): Promise<{
    completed: number;
    errors: number;
  }> {
    try {
      logger.info('Manually triggering auto-complete process...');
      
      const result = await AutoCompleteService.autoCompletePendingTransactions(3);
      
      logger.info(`Manual auto-complete completed: ${result.completed} transactions completed, ${result.errors} errors`);
      
      return result;
      
    } catch (error) {
      logger.error('Error in manual auto-complete process:', error);
      throw error;
    }
  }

  /**
   * Get status of all cron jobs
   */
  static getJobStatus(): {
    autoCompleteJob: {
      running: boolean;
      nextRun?: Date;
      lastRun?: Date;
    };
  } {
    return {
      autoCompleteJob: {
        running: this.autoCompleteJob ? this.autoCompleteJob.getStatus() === 'scheduled' : false,
        // Note: node-cron doesn't provide nextRun/lastRun info directly
        // You could implement this by tracking manually if needed
      }
    };
  }
}
