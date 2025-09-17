import Redis from 'ioredis';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3, // Limit retries
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 5000, // Reduced timeout
  commandTimeout: 3000, // Reduced timeout
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: true,
  maxLoadingTimeout: 3000, // Reduced timeout
  enableAutoPipelining: false,
};

// Create Redis client with error handling
export const redis = new Redis(redisConfig);

// Handle Redis connection errors gracefully
redis.on('error', (error) => {
  console.warn('⚠️ Redis connection error (continuing without cache):', error.message);
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('ready', () => {
  console.log('✅ Redis ready');
});

// Cache configuration
export const cacheConfig = {
  // Default TTL in seconds
  defaultTTL: 3600, // 1 hour
  
  // Service-specific TTLs
  user: 1800, // 30 minutes
  product: 3600, // 1 hour
  inventory: 300, // 5 minutes
  analytics: 900, // 15 minutes
  store: 7200, // 2 hours
  category: 3600, // 1 hour
};

// Cache key generators
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,
  product: (id: string) => `product:${id}`,
  productByBarcode: (barcode: string) => `product:barcode:${barcode}`,
  productBySku: (sku: string) => `product:sku:${sku}`,
  inventory: (productId: string) => `inventory:${productId}`,
  store: (id: string) => `store:${id}`,
  category: (id: string) => `category:${id}`,
  transaction: (id: string) => `transaction:${id}`,
  customer: (id: string) => `customer:${id}`,
  analytics: (storeId: string, type: string, period: string) => `analytics:${storeId}:${type}:${period}`,
  session: (token: string) => `session:${token}`,
  rateLimit: (ip: string, endpoint: string) => `rate_limit:${ip}:${endpoint}`,
};

// Redis connection test
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping();
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
};

// Cache helper functions with graceful Redis failure handling
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      if (redis.status !== 'ready') {
        return null; // Return null if Redis is not ready
      }
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Cache get error (Redis unavailable):', (error as Error).message);
      return null;
    }
  },

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        return false; // Return false if Redis is not ready
      }
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.warn('Cache set error (Redis unavailable):', (error as Error).message);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        return false;
      }
      await redis.del(key);
      return true;
    } catch (error) {
      console.warn('Cache delete error (Redis unavailable):', (error as Error).message);
      return false;
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        return false;
      }
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Cache exists error (Redis unavailable):', (error as Error).message);
      return false;
    }
  },

  async flush(): Promise<boolean> {
    try {
      if (redis.status !== 'ready') {
        return false;
      }
      await redis.flushall();
      return true;
    } catch (error) {
      console.warn('Cache flush error (Redis unavailable):', (error as Error).message);
      return false;
    }
  },
};

// Graceful shutdown
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log('✅ Redis connection closed');
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
  }
};