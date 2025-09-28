import { NotificationService } from './notificationService';
import { logger } from '../utils/logger';
import { getStoreTimezone } from '../utils/timezone';
import { DateTime } from 'luxon';
import { User } from '../models/User';

export interface DailyLoginRecord {
  userId: string;
  storeId: string;
  loginDate: string; // YYYY-MM-DD format
  loginTime: Date;
  isFirstLoginOfDay: boolean;
}

export interface GoodMorningMessage {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class DailyLoginService {
  private static dailyLogins: Map<string, DailyLoginRecord> = new Map();

  /**
   * Check if user has logged in today and send good morning notification if first login
   */
  static async handleDailyLogin(userId: string, storeId: string): Promise<boolean> {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      const todayString = now.toFormat('yyyy-MM-dd');

      // Create a unique key for this user and date
      const loginKey = `${userId}_${todayString}`;
      
      // Check if user has already logged in today
      const existingLogin = this.dailyLogins.get(loginKey);
      
      if (existingLogin) {
        // User has already logged in today
        logger.info(`User ${userId} already logged in today at ${existingLogin.loginTime}`);
        return false;
      }

      // This is the first login of the day
      const loginRecord: DailyLoginRecord = {
        userId,
        storeId,
        loginDate: todayString,
        loginTime: now.toJSDate(),
        isFirstLoginOfDay: true
      };

      // Store the login record
      this.dailyLogins.set(loginKey, loginRecord);

      // Get user information for personalized message
      let userName = 'Team Member';
      try {
        const user = await User.findById(userId);
        userName = user?.first_name || user?.email?.split('@')[0] || 'Team Member';
      } catch (error) {
        // If user lookup fails (e.g., invalid ObjectId), use default name
        logger.warn(`Could not fetch user details for ${userId}, using default name`);
      }

      // Send good morning notification
      await this.sendGoodMorningNotification(userId, storeId, userName, now);

      logger.info(`First login of the day for user ${userId} (${userName}) at ${now.toFormat('HH:mm')}`);
      return true;

    } catch (error) {
      logger.error(`Error handling daily login for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send a personalized good morning notification
   */
  private static async sendGoodMorningNotification(
    userId: string,
    storeId: string,
    userName: string,
    loginTime: DateTime
  ): Promise<void> {
    try {
      const goodMorningMessage = this.generateGoodMorningMessage(userName, loginTime);

      await NotificationService.createNotification({
        user_id: userId,
        store_id: storeId,
        type: 'system',
        title: goodMorningMessage.title,
        message: goodMorningMessage.message,
        priority: goodMorningMessage.priority,
        expires_in_hours: 12 // Good morning messages expire at end of day
      });

      logger.info(`Good morning notification sent to ${userName} (${userId})`);
    } catch (error) {
      logger.error(`Error sending good morning notification to user ${userId}:`, error);
    }
  }

  /**
   * Generate personalized good morning message based on time and user
   */
  private static generateGoodMorningMessage(userName: string, loginTime: DateTime): GoodMorningMessage {
    const hour = loginTime.hour;
    
    // Determine time-based greeting
    let timeGreeting = '';
    let timeIcon = '';
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

    if (hour >= 5 && hour < 8) {
      timeGreeting = 'Early Bird';
      timeIcon = '🌅';
      priority = 'high';
    } else if (hour >= 8 && hour < 10) {
      timeGreeting = 'Good Morning';
      timeIcon = '☀️';
      priority = 'medium';
    } else if (hour >= 10 && hour < 12) {
      timeGreeting = 'Good Morning';
      timeIcon = '🌞';
      priority = 'medium';
    } else if (hour >= 12 && hour < 14) {
      timeGreeting = 'Good Afternoon';
      timeIcon = '☀️';
      priority = 'medium';
    } else if (hour >= 14 && hour < 18) {
      timeGreeting = 'Good Afternoon';
      timeIcon = '🌤️';
      priority = 'medium';
    } else {
      timeGreeting = 'Good Evening';
      timeIcon = '🌆';
      priority = 'low';
    }

    // Motivational messages pool
    const motivationalMessages = [
      "Ready to make today amazing? Let's crush those sales goals together! 💪",
      "Today is full of opportunities! Let's make every customer smile! 😊",
      "Your positive energy makes everything better! Let's have an incredible day! ⚡",
      "Success starts with a smile! Let's make today count! 🌟",
      "You've got this! Let's turn today into a record-breaking day! 🚀",
      "Every sale counts, and you're the superstar making it happen! ⭐",
      "Today's success story starts with you! Let's write an amazing chapter! 📖",
      "Your dedication is inspiring! Let's make today extraordinary! 🌈",
      "Ready to exceed expectations? Today's the perfect day for it! 🎯",
      "Your hard work pays off! Let's make today your best day yet! 🏆",
      "Energy and enthusiasm - that's what makes you unstoppable! Let's go! 🔥",
      "Today's customers are lucky to have you! Let's spread some joy! 🎉",
      "Your positive attitude is contagious! Let's make today memorable! 💫",
      "Ready to make magic happen? Today's your stage! ✨",
      "Your commitment to excellence shows in everything you do! Let's shine! 🌟"
    ];

    // Select a random motivational message
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    // Create personalized title and message
    const title = `${timeIcon} ${timeGreeting}, ${userName}!`;
    const message = `${randomMessage}\n\nTime to show the world what we're made of! 🎯`;

    return {
      title,
      message,
      priority
    };
  }

  /**
   * Get today's login record for a user
   */
  static getTodayLoginRecord(userId: string, storeId: string): DailyLoginRecord | null {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      const todayString = now.toFormat('yyyy-MM-dd');
      const loginKey = `${userId}_${todayString}`;
      
      return this.dailyLogins.get(loginKey) || null;
    } catch (error) {
      logger.error(`Error getting today's login record for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if user has logged in today
   */
  static hasUserLoggedInToday(userId: string, storeId: string): boolean {
    const loginRecord = this.getTodayLoginRecord(userId, storeId);
    return loginRecord !== null;
  }

  /**
   * Get login statistics for a store
   */
  static getStoreLoginStats(storeId: string): {
    totalLoginsToday: number;
    firstTimeLogins: number;
    loginTimes: string[];
  } {
    try {
      const timezone = getStoreTimezone(storeId);
      const now = DateTime.now().setZone(timezone);
      const todayString = now.toFormat('yyyy-MM-dd');

      const todayLogins = Array.from(this.dailyLogins.values()).filter(
        login => login.storeId === storeId && login.loginDate === todayString
      );

      return {
        totalLoginsToday: todayLogins.length,
        firstTimeLogins: todayLogins.filter(login => login.isFirstLoginOfDay).length,
        loginTimes: todayLogins.map(login => 
          DateTime.fromJSDate(login.loginTime).setZone(timezone).toFormat('HH:mm')
        ).sort()
      };
    } catch (error) {
      logger.error(`Error getting store login stats for store ${storeId}:`, error);
      return {
        totalLoginsToday: 0,
        firstTimeLogins: 0,
        loginTimes: []
      };
    }
  }

  /**
   * Clean up old login records (older than 7 days)
   */
  static cleanupOldRecords(): void {
    try {
      const cutoffDate = DateTime.now().minus({ days: 7 });
      
      for (const [key, record] of this.dailyLogins.entries()) {
        const recordDate = DateTime.fromJSDate(record.loginTime);
        if (recordDate < cutoffDate) {
          this.dailyLogins.delete(key);
        }
      }

      logger.info(`Cleaned up old login records. Remaining records: ${this.dailyLogins.size}`);
    } catch (error) {
      logger.error('Error cleaning up old login records:', error);
    }
  }

  /**
   * Get all login records for debugging
   */
  static getAllLoginRecords(): DailyLoginRecord[] {
    return Array.from(this.dailyLogins.values());
  }

  /**
   * Reset login records (for testing)
   */
  static resetLoginRecords(): void {
    this.dailyLogins.clear();
    logger.info('Login records reset');
  }
}
