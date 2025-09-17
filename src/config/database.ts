import mongoose from 'mongoose';

// MongoDB connection configuration
const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(mongoURI, options);
    
    console.log('✅ MongoDB connection successful');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

// Database connection test
export const testConnection = async (): Promise<boolean> => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Database connection already established');
      return true;
    }
    
    await connectDB();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('✅ Database connections closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

// Export mongoose for use in other parts of the application
export { mongoose };
export default connectDB;