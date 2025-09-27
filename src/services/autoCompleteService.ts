import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';

export class AutoCompleteService {
  /**
   * Auto-complete pending transactions that are older than specified hours
   */
  static async autoCompletePendingTransactions(hoursOld: number = 3): Promise<{
    completed: number;
    errors: number;
  }> {
    try {
      logger.info(`Starting auto-complete process for transactions older than ${hoursOld} hours`);

      // Calculate the cutoff time (3 hours ago by default)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursOld);

      // Find pending transactions older than the cutoff time
      const pendingTransactions = await Transaction.find({
        status: 'pending',
        created_at: { $lt: cutoffTime }
      });

      logger.info(`Found ${pendingTransactions.length} pending transactions older than ${hoursOld} hours`);

      let completedCount = 0;
      let errorCount = 0;

      // Process each transaction
      for (const transaction of pendingTransactions) {
        try {
          // Update transaction status to completed
          await Transaction.findByIdAndUpdate(
            transaction._id,
            {
              status: 'completed',
              payment_status: 'completed',
              updated_at: new Date()
            }
          );

          completedCount++;
          logger.info(`Auto-completed transaction ${transaction._id} (amount: ${transaction.total_amount})`);

        } catch (error) {
          errorCount++;
          logger.error(`Error auto-completing transaction ${transaction._id}:`, error);
        }
      }

      const result = {
        completed: completedCount,
        errors: errorCount
      };

      logger.info(`Auto-complete process completed: ${completedCount} transactions completed, ${errorCount} errors`);

      return result;

    } catch (error) {
      logger.error('Error in auto-complete process:', error);
      throw error;
    }
  }

  /**
   * Get statistics about pending transactions
   */
  static async getPendingTransactionStats(): Promise<{
    totalPending: number;
    pendingOlderThan3Hours: number;
    pendingOlderThan1Hour: number;
    oldestPendingTransaction?: {
      id: string;
      amount: number;
      createdAt: Date;
      hoursOld: number;
    };
  }> {
    try {
      // Get all pending transactions
      const allPending = await Transaction.find({ status: 'pending' }).sort({ created_at: 1 });

      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Count transactions by age
      const pendingOlderThan3Hours = allPending.filter(t => t.created_at < threeHoursAgo).length;
      const pendingOlderThan1Hour = allPending.filter(t => t.created_at < oneHourAgo).length;

      // Get oldest pending transaction
      let oldestPendingTransaction;
      if (allPending.length > 0) {
        const oldest = allPending[0];
        const hoursOld = Math.round((now.getTime() - oldest.created_at.getTime()) / (1000 * 60 * 60) * 100) / 100;
        
        oldestPendingTransaction = {
          id: oldest._id.toString(),
          amount: oldest.total_amount,
          createdAt: oldest.created_at,
          hoursOld
        };
      }

      return {
        totalPending: allPending.length,
        pendingOlderThan3Hours,
        pendingOlderThan1Hour,
        oldestPendingTransaction
      };

    } catch (error) {
      logger.error('Error getting pending transaction stats:', error);
      throw error;
    }
  }

  /**
   * Manual completion of a specific transaction
   */
  static async completeTransaction(transactionId: string): Promise<boolean> {
    try {
      const result = await Transaction.findByIdAndUpdate(
        transactionId,
        {
          status: 'completed',
          payment_status: 'completed',
          updated_at: new Date()
        }
      );

      if (result) {
        logger.info(`Manually completed transaction ${transactionId}`);
        return true;
      } else {
        logger.warn(`Transaction ${transactionId} not found for manual completion`);
        return false;
      }

    } catch (error) {
      logger.error(`Error manually completing transaction ${transactionId}:`, error);
      throw error;
    }
  }
}
