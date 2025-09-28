import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from '../models/User';
import { cache, cacheKeys, cacheConfig } from '../config/redis';
import { config } from '../config/app';
import { logger } from '../utils/logger';
import { CustomError, unauthorizedError, validationError } from '../middleware/errorHandler';
import { DailyLoginService } from './dailyLoginService';

// User interface is now imported from models/User.ts

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'admin' | 'cashier' | 'manager' | 'owner';
  store_id?: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface AuthResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  storeId?: string;
  iat?: number;
  exp?: number;
}

class AuthService {
  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthResult> {
    const { email, password, role, store_id, first_name, last_name, phone } = userData;

    try {
      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw validationError('User with this email already exists');
      }

      // Hash password
      const saltRounds = config.security.bcryptRounds;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = new User({
        email,
        password_hash: passwordHash,
        role,
        store_id: store_id || undefined,
        first_name,
        last_name,
        phone: phone || undefined,
      });

      await user.save();

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Cache user data
      await cache.set(cacheKeys.user(user.id), user, cacheConfig.user);

      logger.info(`User registered successfully: ${email}`);

      return {
        user,
        ...tokens,
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    try {
      // Get user by email
      const user = await this.getUserByEmail(email);
      if (!user) {
        throw unauthorizedError('Invalid email or password');
      }

      // Check if user is active
      if (!user.is_active) {
        throw unauthorizedError('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw unauthorizedError('Invalid email or password');
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Handle daily login notification (check if first login of the day)
      try {
        const storeId = user.store_id || 'default-store';
        const isFirstLoginToday = await DailyLoginService.handleDailyLogin(user.id, storeId);
        
        if (isFirstLoginToday) {
          logger.info(`Good morning notification sent to user: ${email}`);
        }
      } catch (notificationError) {
        // Don't fail login if notification fails
        logger.error('Error handling daily login notification:', notificationError);
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Cache user data
      await cache.set(cacheKeys.user(user.id), user, cacheConfig.user);

      logger.info(`User logged in successfully: ${email}`);

      return {
        user,
        ...tokens,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;

      // Get user from cache or database
      let user = await cache.get<IUser>(cacheKeys.user(decoded.userId));
      if (!user) {
        user = await this.getUserById(decoded.userId);
        if (!user) {
          throw unauthorizedError('User not found');
        }
      }

      // Check if user is still active
      if (!user.is_active) {
        throw unauthorizedError('Account is deactivated');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Cache updated user data
      await cache.set(cacheKeys.user(user.id), user, cacheConfig.user);

      return {
        user,
        ...tokens,
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw unauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, token: string): Promise<boolean> {
    try {
      // Add token to blacklist (implement token blacklist in Redis)
      await cache.set(`blacklist:${token}`, true, 7 * 24 * 60 * 60); // 7 days

      // Clear user cache
      await cache.del(cacheKeys.user(userId));

      logger.info(`User logged out successfully: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get user
      const user = await this.getUserById(userId);
      if (!user) {
        throw unauthorizedError('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw unauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = config.security.bcryptRounds;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await User.findByIdAndUpdate(userId, { 
        password_hash: newPasswordHash,
        updated_at: new Date()
      }).exec();

      // Clear user cache
      await cache.del(cacheKeys.user(userId));

      logger.info(`Password changed successfully for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: IUser): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.store_id || undefined,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    // Parse expires in to seconds
    const expiresIn = this.parseExpiresIn(config.jwt.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      // Try cache first
      const cachedUser = await cache.get<IUser>(cacheKeys.userByEmail(email));
      if (cachedUser) {
        return cachedUser;
      }

      // Get from database
      const user = await User.findOne({ email }).exec();

      if (!user) {
        return null;
      }

      // Cache user data
      await cache.set(cacheKeys.user(user.id), user, cacheConfig.user);
      await cache.set(cacheKeys.userByEmail(email), user, cacheConfig.user);

      return user;
    } catch (error) {
      logger.error('Get user by email error:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      // Try cache first
      const cachedUser = await cache.get<IUser>(cacheKeys.user(userId));
      if (cachedUser) {
        return cachedUser;
      }

      // Get from database
      const user = await User.findById(userId).select('-password_hash').exec();

      if (!user) {
        return null;
      }

      // Cache user data
      await cache.set(cacheKeys.user(userId), user, cacheConfig.user);

      return user;
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { 
        last_login: new Date(),
        updated_at: new Date()
      }).exec();
    } catch (error) {
      logger.error('Update last login error:', error);
    }
  }

  /**
   * Parse expires in string to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  /**
   * Verify if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      return await cache.exists(`blacklist:${token}`);
    } catch (error) {
      logger.error('Check token blacklist error:', error);
      return false;
    }
  }
}

export const authService = new AuthService();
