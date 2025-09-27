import { Goal, IGoal } from '../models/Goal';
import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';

export interface CreateGoalData {
  user_id: string;
  store_id: string;
  goal_type: 'daily' | 'monthly' | 'weekly' | 'yearly';
  target_amount: number;
  currency: string;
  period_start: Date;
  period_end: Date;
}

export interface GoalProgress {
  goal: IGoal;
  current_amount: number;
  progress_percentage: number;
  is_achieved: boolean;
  days_remaining?: number;
  streak_count: number;
}

export interface GoalAnalytics {
  total_goals: number;
  achieved_goals: number;
  current_streak: number;
  average_progress: number;
  goals_by_type: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
}

export class GoalService {
  /**
   * Create a new goal with comprehensive validation
   */
  static async createGoal(goalData: CreateGoalData): Promise<IGoal> {
    try {
      // Validate goal data
      this.validateGoalData(goalData);

      // Check for existing active goals of the same type
      const existingGoal = await Goal.findOne({
        user_id: goalData.user_id,
        store_id: goalData.store_id,
        goal_type: goalData.goal_type,
        is_active: true,
        $or: [
          {
            period_start: { $lte: goalData.period_end },
            period_end: { $gte: goalData.period_start }
          }
        ]
      });

      if (existingGoal) {
        // Deactivate existing goal
        await Goal.findByIdAndUpdate(existingGoal._id, { is_active: false });
        logger.info(`Deactivated existing ${goalData.goal_type} goal for user ${goalData.user_id}`);
      }

      // Create new goal
      const goal = new Goal(goalData);
      await goal.save();

      logger.info(`Goal created: ${goal.goal_type} - ${goal.target_amount} ${goal.currency}`);
      return goal;
    } catch (error) {
      logger.error('Error creating goal:', error);
      throw error;
    }
  }

  /**
   * Get all active goals for a user
   */
  static async getUserGoals(
    userId: string, 
    storeId: string, 
    filters?: {
      goal_type?: string;
      is_active?: boolean;
    }
  ): Promise<IGoal[]> {
    try {
      const query: any = {
        user_id: userId,
        store_id: storeId
      };

      // Apply filters
      if (filters?.goal_type) {
        query.goal_type = filters.goal_type;
      }
      
      if (filters?.is_active !== undefined) {
        query.is_active = filters.is_active;
      } else {
        // Default to active goals if no filter specified
        query.is_active = true;
      }

      const goals = await Goal.find(query).sort({ created_at: -1 });

      return goals;
    } catch (error) {
      logger.error('Error getting user goals:', error);
      throw error;
    }
  }

  /**
   * Get goal progress for a specific goal
   */
  static async getGoalProgress(goalId: string, userId: string): Promise<GoalProgress | null> {
    try {
      const goal = await Goal.findOne({ _id: goalId, user_id: userId, is_active: true });
      if (!goal) {
        return null;
      }

      // Calculate current amount from transactions
      const currentAmount = await this.calculateCurrentAmount(goal);
      const progressPercentage = (currentAmount / goal.target_amount) * 100;
      const isAchieved = currentAmount >= goal.target_amount;

      // Calculate days remaining for daily goals
      let daysRemaining;
      if (goal.goal_type === 'daily') {
        const now = new Date();
        const endOfDay = new Date(goal.period_end);
        daysRemaining = Math.max(0, Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Calculate streak
      const streakCount = await this.calculateStreak(userId, goal.store_id, goal.goal_type);

      return {
        goal,
        current_amount: currentAmount,
        progress_percentage: Math.round(progressPercentage * 100) / 100,
        is_achieved: isAchieved,
        days_remaining: daysRemaining,
        streak_count: streakCount
      };
    } catch (error) {
      logger.error('Error getting goal progress:', error);
      throw error;
    }
  }

  /**
   * Get all goals with progress for a user
   */
  static async getUserGoalsWithProgress(userId: string, storeId: string): Promise<GoalProgress[]> {
    try {
      const goals = await this.getUserGoals(userId, storeId);
      const goalsWithProgress: GoalProgress[] = [];

      for (const goal of goals) {
        const progress = await this.getGoalProgress(goal._id.toString(), userId);
        if (progress) {
          goalsWithProgress.push(progress);
        }
      }

      return goalsWithProgress;
    } catch (error) {
      logger.error('Error getting goals with progress:', error);
      throw error;
    }
  }

  /**
   * Update a goal
   */
  static async updateGoal(goalId: string, userId: string, updateData: Partial<CreateGoalData>): Promise<IGoal | null> {
    try {
      const goal = await Goal.findOneAndUpdate(
        { _id: goalId, user_id: userId, is_active: true },
        updateData,
        { new: true, runValidators: true }
      );

      if (goal) {
        logger.info(`Goal updated: ${goal.goal_type} - ${goal.target_amount} ${goal.currency}`);
      }

      return goal;
    } catch (error) {
      logger.error('Error updating goal:', error);
      throw error;
    }
  }

  /**
   * Delete a goal
   */
  static async deleteGoal(goalId: string, userId: string): Promise<boolean> {
    try {
      const result = await Goal.findOneAndUpdate(
        { _id: goalId, user_id: userId },
        { is_active: false }
      );

      if (result) {
        logger.info(`Goal deleted: ${result.goal_type} - ${result.target_amount} ${result.currency}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting goal:', error);
      throw error;
    }
  }

  /**
   * Get performance analytics for goals
   */
  static async getPerformanceAnalytics(userId: string, storeId: string): Promise<GoalAnalytics> {
    try {
      const goals = await this.getUserGoals(userId, storeId);
      const goalsWithProgress = await this.getUserGoalsWithProgress(userId, storeId);

      const totalGoals = goals.length;
      const achievedGoals = goalsWithProgress.filter(g => g.is_achieved).length;
      const currentStreak = goalsWithProgress.length > 0 ? Math.max(...goalsWithProgress.map(g => g.streak_count)) : 0;
      const averageProgress = goalsWithProgress.length > 0 
        ? goalsWithProgress.reduce((sum, g) => sum + g.progress_percentage, 0) / goalsWithProgress.length 
        : 0;

      const goalsByType = {
        daily: goals.filter(g => g.goal_type === 'daily').length,
        weekly: goals.filter(g => g.goal_type === 'weekly').length,
        monthly: goals.filter(g => g.goal_type === 'monthly').length,
        yearly: goals.filter(g => g.goal_type === 'yearly').length
      };

      return {
        total_goals: totalGoals,
        achieved_goals: achievedGoals,
        current_streak: currentStreak,
        average_progress: Math.round(averageProgress * 100) / 100,
        goals_by_type: goalsByType
      };
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate current amount from transactions
   */
  private static async calculateCurrentAmount(goal: IGoal): Promise<number> {
    try {
      const transactions = await Transaction.find({
        store_id: goal.store_id,
        status: 'completed',
        created_at: {
          $gte: goal.period_start,
          $lte: goal.period_end
        }
      });

      return transactions.reduce((sum, transaction) => sum + transaction.total_amount, 0);
    } catch (error) {
      logger.error('Error calculating current amount:', error);
      return 0;
    }
  }

  /**
   * Calculate streak count
   */
  private static async calculateStreak(userId: string, storeId: string, goalType: string): Promise<number> {
    try {
      // Get all completed goals of the same type
      const completedGoals = await Goal.find({
        user_id: userId,
        store_id: storeId,
        goal_type: goalType,
        is_active: false
      }).sort({ period_end: -1 });

      let streak = 0;
      let currentDate = new Date();

      for (const goal of completedGoals) {
        const progress = await this.getGoalProgress(goal._id.toString(), userId);
        if (progress && progress.is_achieved) {
          streak++;
          // For daily goals, check consecutive days
          if (goalType === 'daily') {
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break; // For other types, just count completed goals
          }
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * Validate goal data
   */
  private static validateGoalData(data: CreateGoalData): void {
    if (!data.user_id || !data.store_id) {
      throw new Error('User ID and Store ID are required');
    }

    if (!data.goal_type || !['daily', 'monthly', 'weekly', 'yearly'].includes(data.goal_type)) {
      throw new Error('Invalid goal type');
    }

    if (!data.target_amount || data.target_amount <= 0) {
      throw new Error('Target amount must be greater than 0');
    }

    if (!data.currency || !['TRY', 'USD', 'EUR', 'NGN'].includes(data.currency)) {
      throw new Error('Invalid currency');
    }

    if (!data.period_start || !data.period_end) {
      throw new Error('Period start and end dates are required');
    }

    if (data.period_start >= data.period_end) {
      throw new Error('Period start must be before period end');
    }

    // Validate period based on goal type
    const periodDuration = data.period_end.getTime() - data.period_start.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    const oneYear = 365 * oneDay;

    switch (data.goal_type) {
      case 'daily':
        if (periodDuration > oneDay) {
          throw new Error('Daily goals cannot exceed 24 hours');
        }
        break;
      case 'weekly':
        if (periodDuration > oneWeek) {
          throw new Error('Weekly goals cannot exceed 7 days');
        }
        break;
      case 'monthly':
        if (periodDuration > oneMonth) {
          throw new Error('Monthly goals cannot exceed 30 days');
        }
        break;
      case 'yearly':
        if (periodDuration > oneYear) {
          throw new Error('Yearly goals cannot exceed 365 days');
        }
        break;
    }
  }

  /**
   * Get a goal by ID
   */
  static async getGoalById(goalId: string): Promise<IGoal | null> {
    try {
      const goal = await Goal.findById(goalId);
      return goal;
    } catch (error) {
      logger.error('Error getting goal by ID:', error);
      return null;
    }
  }
}