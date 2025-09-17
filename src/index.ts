import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/app';
import { testConnection, closeDatabaseConnections } from './config/database';
// import { testRedisConnection, closeRedisConnection } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
// import { requestMonitoring, performanceMonitoring, errorMonitoring } from './middleware/monitoring';

// Import routes
// import authRoutes from './routes/auth';
// import userRoutes from './routes/users';
// import storeRoutes from './routes/stores';
import productRoutes from './routes/products';
// import inventoryRoutes from './routes/inventory';
// import transactionRoutes from './routes/transactions';
// import customerRoutes from './routes/customers';
// import analyticsRoutes from './routes/analytics';
// import monitoringRoutes from './routes/monitoring';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.security.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));

    // Monitoring middleware
    // this.app.use(requestMonitoring);
    // this.app.use(performanceMonitoring);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
        version: config.app.version,
      });
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: config.app.name,
        version: config.app.version,
        description: 'Market Management System API',
        endpoints: {
          auth: '/api/v1/auth',
          users: '/api/v1/users',
          stores: '/api/v1/stores',
          products: '/api/v1/products',
          inventory: '/api/v1/inventory',
          transactions: '/api/v1/transactions',
          customers: '/api/v1/customers',
          analytics: '/api/v1/analytics',
        },
      });
    });
  }

  private initializeRoutes(): void {
    const apiPrefix = `/api/${config.app.version}`;

    // API routes (temporarily disabled for basic startup)
    // this.app.use(`${apiPrefix}/auth`, authRoutes);
    // this.app.use(`${apiPrefix}/users`, userRoutes);
    // this.app.use(`${apiPrefix}/stores`, storeRoutes);
    this.app.use(`${apiPrefix}/products`, productRoutes);
    // this.app.use(`${apiPrefix}/inventory`, inventoryRoutes);
    // this.app.use(`${apiPrefix}/transactions`, transactionRoutes);
    // this.app.use(`${apiPrefix}/customers`, customerRoutes);
    // this.app.use(`${apiPrefix}/analytics`, analyticsRoutes);
    // this.app.use(`${apiPrefix}/monitoring`, monitoringRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to Student Delivery System API',
        version: config.app.version,
        documentation: '/api/docs',
        health: '/health',
      });
    });
  }

  private initializeErrorHandling(): void {
    // Error monitoring
    // this.app.use(errorMonitoring);

    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      // Test Redis connection (disabled)
      // const redisConnected = await testRedisConnection();
      // if (!redisConnected) {
      //   logger.warn('Redis connection failed - continuing without cache');
      // }

      // Start server
      this.app.listen(config.app.port, () => {
        logger.info(`🚀 Server running on port ${config.app.port}`);
        logger.info(`📚 API Documentation: http://localhost:${config.app.port}/api/docs`);
        logger.info(`🏥 Health Check: http://localhost:${config.app.port}/health`);
        logger.info(`🌍 Environment: ${config.app.env}`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      await closeDatabaseConnections();
      // await closeRedisConnection();
      logger.info('✅ Server stopped gracefully');
    } catch (error) {
      logger.error('Error stopping server:', error);
    }
  }
}

// Create and start the application
const app = new App();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default app;
