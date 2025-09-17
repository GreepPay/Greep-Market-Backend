import { mongoose } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config/app';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    api: ServiceHealth;
  };
  metrics: {
    memory_usage: MemoryUsage;
    cpu_usage?: number;
    active_connections: number;
    response_time: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time: number;
  last_check: string;
  error?: string;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface SystemMetrics {
  timestamp: string;
  memory_usage: MemoryUsage;
  active_connections: number;
  response_time: number;
}

class MonitoringService {
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private startTime = Date.now();

  /**
   * Get overall system health
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Check all services
    const [databaseHealth, redisHealth, apiHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkApiHealth(),
    ]);

    // Determine overall status
    const serviceStatuses = [databaseHealth.status, redisHealth.status, apiHealth.status];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (serviceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    return {
      status: overallStatus,
      timestamp,
      uptime,
      version: config.app.version,
      environment: config.app.env,
      services: {
        database: databaseHealth,
        redis: redisHealth,
        api: apiHealth,
      },
      metrics,
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Test MongoDB connection
      await mongoose.connection.db.admin().ping();

      const responseTime = Date.now() - startTime;
      const status = responseTime > 1000 ? 'degraded' : 'healthy';

      return {
        status,
        response_time: responseTime,
        last_check: timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time: Date.now() - startTime,
        last_check: timestamp,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      await redis.ping();
      const responseTime = Date.now() - startTime;
      const status = responseTime > 500 ? 'degraded' : 'healthy';

      return {
        status,
        response_time: responseTime,
        last_check: timestamp,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        response_time: Date.now() - startTime,
        last_check: timestamp,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<ServiceHealth> {
    const timestamp = new Date().toISOString();
    const avgResponseTime = this.getAverageResponseTime();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (avgResponseTime > 2000) {
      status = 'unhealthy';
    } else if (avgResponseTime > 1000) {
      status = 'degraded';
    }

    return {
      status,
      response_time: avgResponseTime,
      last_check: timestamp,
    };
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;

    const memory: MemoryUsage = {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };

    // Get database connection count
    let databaseConnections = 0;
    try {
      const serverStatus = await mongoose.connection.db.admin().serverStatus();
      databaseConnections = serverStatus.connections?.current || 0;
    } catch (error) {
      logger.error('Failed to get database connection count:', error);
    }

    // Get Redis connection info
    let redisConnections = 0;
    try {
      const info = await redis.info('clients');
      const connectedClients = info.match(/connected_clients:(\d+)/);
      if (connectedClients) {
        redisConnections = parseInt(connectedClients[1]);
      }
    } catch (error) {
      logger.error('Failed to get Redis connection count:', error);
    }

    return {
      timestamp: new Date().toISOString(),
      memory_usage: memory,
      active_connections: databaseConnections + redisConnections,
      response_time: this.getAverageResponseTime(),
    };
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    if (isError) {
      this.errorCount++;
    }

    // Keep only last 100 response times for average calculation
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length);
  }

  /**
   * Get request statistics
   */
  getRequestStats(): {
    total_requests: number;
    error_count: number;
    error_rate: number;
    average_response_time: number;
    uptime_seconds: number;
  } {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;

    return {
      total_requests: this.requestCount,
      error_count: this.errorCount,
      error_rate: Math.round(errorRate * 100) / 100,
      average_response_time: this.getAverageResponseTime(),
      uptime_seconds: uptime,
    };
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    total_connections: number;
    active_connections: number;
    database_size: string;
    table_count: number;
  }> {
    try {
      const [serverStatus, dbStats, collections] = await Promise.all([
        mongoose.connection.db.admin().serverStatus(),
        mongoose.connection.db.stats(),
        mongoose.connection.db.listCollections().toArray(),
      ]);

      return {
        total_connections: serverStatus.connections?.current || 0,
        active_connections: serverStatus.connections?.current || 0,
        database_size: `${Math.round((dbStats.dataSize || 0) / 1024 / 1024)} MB`,
        table_count: collections.length,
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {
        total_connections: 0,
        active_connections: 0,
        database_size: 'Unknown',
        table_count: 0,
      };
    }
  }

  /**
   * Get Redis statistics
   */
  async getRedisStats(): Promise<{
    connected_clients: number;
    used_memory: string;
    used_memory_peak: string;
    keyspace_hits: number;
    keyspace_misses: number;
    hit_rate: number;
  }> {
    try {
      const info = await redis.info();
      const stats: any = {};

      // Parse Redis info
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

      return {
        connected_clients: parseInt(stats.connected_clients || '0'),
        used_memory: this.formatBytes(parseInt(stats.used_memory || '0')),
        used_memory_peak: this.formatBytes(parseInt(stats.used_memory_peak || '0')),
        keyspace_hits: hits,
        keyspace_misses: misses,
        hit_rate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get Redis stats:', error);
      return {
        connected_clients: 0,
        used_memory: 'Unknown',
        used_memory_peak: 'Unknown',
        keyspace_hits: 0,
        keyspace_misses: 0,
        hit_rate: 0,
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get application metrics for Prometheus
   */
  getPrometheusMetrics(): string {
    const stats = this.getRequestStats();
    const memory = process.memoryUsage();

    return `
# HELP market_api_requests_total Total number of requests
# TYPE market_api_requests_total counter
market_api_requests_total ${stats.total_requests}

# HELP market_api_errors_total Total number of errors
# TYPE market_api_errors_total counter
market_api_errors_total ${stats.error_count}

# HELP market_api_response_time_seconds Average response time in seconds
# TYPE market_api_response_time_seconds gauge
market_api_response_time_seconds ${stats.average_response_time / 1000}

# HELP market_api_memory_usage_bytes Memory usage in bytes
# TYPE market_api_memory_usage_bytes gauge
market_api_memory_usage_bytes{type="heap_used"} ${memory.heapUsed}
market_api_memory_usage_bytes{type="heap_total"} ${memory.heapTotal}
market_api_memory_usage_bytes{type="external"} ${memory.external}

# HELP market_api_uptime_seconds Application uptime in seconds
# TYPE market_api_uptime_seconds gauge
market_api_uptime_seconds ${stats.uptime_seconds}
`.trim();
  }
}

export const monitoringService = new MonitoringService();
