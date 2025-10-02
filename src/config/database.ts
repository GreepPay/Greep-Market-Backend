import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// Connection state tracking
let isConnecting = false;
let connectionAttempts = 0;
const maxRetries = 5;
const retryDelay = 5000; // 5 seconds

// MongoDB connection configuration with robust settings
const getConnectionOptions = () => ({
  // Connection pool settings
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2,  // Maintain at least 2 socket connections
  
  // Timeout settings
  serverSelectionTimeoutMS: 10000, // Keep trying to send operations for 10 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  
  // Retry settings
  retryWrites: true,
  retryReads: true,
  
  // Network settings
  family: 4, // Use IPv4, skip trying IPv6
  
  // Buffer settings
  bufferCommands: false, // Disable mongoose buffering
  
  // Heartbeat settings
  heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
  
  // Additional robustness
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
});

/**
 * Check if MongoDB connection is healthy
 */
export const isConnectionHealthy = (): boolean => {
  if (!mongoose.connection) {
    return false;
  }
  const state = mongoose.connection.readyState;
  return state === 1; // 1 = connected
};

/**
 * Wait for MongoDB connection to be established
 */
export const waitForConnection = async (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkConnection = () => {
      if (isConnectionHealthy()) {
        logger.info('✅ MongoDB connection is healthy');
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        logger.error('❌ MongoDB connection timeout');
        resolve(false);
        return;
      }
      
      setTimeout(checkConnection, 100);
    };
    
    checkConnection();
  });
};

/**
 * Robust MongoDB connection function with retry logic
 */
const connectDB = async (): Promise<void> => {
  if (isConnecting) {
    logger.warn('⚠️ MongoDB connection already in progress, waiting...');
    await waitForConnection();
    return;
  }

  if (isConnectionHealthy()) {
    logger.info('✅ MongoDB connection already established');
    return;
  }

  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    const error = new Error('MONGODB_URI environment variable is not defined');
    logger.error('❌ MongoDB connection failed:', error);
    throw error;
  }

  isConnecting = true;
  connectionAttempts++;

  try {
    logger.info(`🔄 Attempting MongoDB connection (attempt ${connectionAttempts}/${maxRetries})...`);
    
    // Close any existing connection first
    if (mongoose.connection && mongoose.connection.readyState !== 0) { // 0 = disconnected
      await mongoose.connection.close();
    }

    const options = getConnectionOptions();
    await mongoose.connect(mongoURI, options);
    
    // Wait for connection to be fully established
    await waitForConnection(5000);
    
    logger.info('✅ MongoDB connection successful');
    connectionAttempts = 0; // Reset on successful connection
    
  } catch (error) {
    logger.error(`❌ MongoDB connection failed (attempt ${connectionAttempts}/${maxRetries}):`, error);
    
    if (connectionAttempts < maxRetries) {
      logger.info(`⏳ Retrying connection in ${retryDelay}ms...`);
      setTimeout(() => {
        isConnecting = false;
        connectDB();
      }, retryDelay);
    } else {
      logger.error('❌ Max connection attempts reached. MongoDB connection failed permanently.');
      throw error;
    }
  } finally {
    isConnecting = false;
  }
};

/**
 * Enhanced database connection test with health checks
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    if (isConnectionHealthy()) {
      logger.info('✅ Database connection already established and healthy');
      return true;
    }
    
    logger.info('🔄 Testing database connection...');
    await connectDB();
    
    // Perform a simple operation to verify connection
    const testResult = await mongoose.connection.db?.admin().ping();
    if (testResult) {
      logger.info('✅ Database connection test successful');
      return true;
    } else {
      logger.error('❌ Database connection test failed');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Database connection test failed:', error);
    return false;
  }
};

/**
 * Graceful shutdown with proper cleanup
 */
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    logger.info('🔄 Closing database connections...');
    
    if (mongoose.connection && mongoose.connection.readyState !== 0) { // 0 = disconnected
      // Wait for any ongoing operations to complete
      await mongoose.connection.db?.admin().ping();
      
      // Close the connection
      await mongoose.connection.close();
      logger.info('✅ Database connections closed gracefully');
    } else {
      logger.info('ℹ️ Database connection already closed');
    }
    
  } catch (error) {
    logger.error('❌ Error closing database connections:', error);
    // Force close if graceful shutdown fails
    try {
      if (mongoose.connection) {
        await mongoose.connection.close();
      }
    } catch (forceError) {
      logger.error('❌ Force close also failed:', forceError);
    }
  }
};

/**
 * Connection event handlers with enhanced logging and recovery
 */
const setupConnectionHandlers = (): void => {
  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB connected successfully');
    connectionAttempts = 0;
  });

  mongoose.connection.on('error', (error) => {
    logger.error('❌ MongoDB connection error:', error);
    // Don't auto-reconnect on error - let the retry logic handle it
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB disconnected');
    // Attempt reconnection after a delay
    setTimeout(() => {
      if (!isConnectionHealthy() && !isConnecting) {
        logger.info('🔄 Attempting to reconnect to MongoDB...');
        connectDB().catch((error) => {
          logger.error('❌ Reconnection failed:', error);
        });
      }
    }, 5000);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected successfully');
    connectionAttempts = 0;
  });

  mongoose.connection.on('close', () => {
    logger.info('ℹ️ MongoDB connection closed');
  });

  // Handle process termination
  process.on('SIGINT', async () => {
    logger.info('🔄 Received SIGINT, closing database connection...');
    await closeDatabaseConnections();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('🔄 Received SIGTERM, closing database connection...');
    await closeDatabaseConnections();
    process.exit(0);
  });
};

/**
 * Initialize database connection with enhanced error handling
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Setup connection event handlers
    setupConnectionHandlers();
    
    // Test the connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to establish database connection');
    }
    
    logger.info('🎉 Database initialization completed successfully');
    
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Health check function for monitoring
 */
export const getConnectionStatus = () => {
  if (!mongoose.connection) {
    return {
      status: 'not_initialized',
      readyState: -1,
      isHealthy: false,
      host: null,
      port: null,
      name: null,
      connectionAttempts
    };
  }
  
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    status: states[state as keyof typeof states] || 'unknown',
    readyState: state,
    isHealthy: isConnectionHealthy(),
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    connectionAttempts
  };
};

// Export mongoose for use in other parts of the application
export { mongoose };
export default initializeDatabase;