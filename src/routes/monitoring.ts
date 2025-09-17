import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { monitoringService } from '../services/monitoringService';

const router = Router();

/**
 * @route   GET /api/v1/monitoring/health
 * @desc    Get system health status
 * @access  Public (for load balancers)
 */
router.get('/health', asyncHandler(async (req, res) => {
  const health = await monitoringService.getHealthStatus();
  
  // Return appropriate HTTP status based on health
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
}));

/**
 * @route   GET /api/v1/monitoring/metrics
 * @desc    Get system metrics
 * @access  Private (admin/owner only)
 */
router.get('/metrics', authenticate, authorize('admin', 'owner'), asyncHandler(async (req, res) => {
  const metrics = await monitoringService.getSystemMetrics();
  const stats = monitoringService.getRequestStats();
  
  res.json({
    success: true,
    data: {
      metrics,
      stats,
    },
  });
}));

/**
 * @route   GET /api/v1/monitoring/prometheus
 * @desc    Get Prometheus metrics
 * @access  Public (for Prometheus scraping)
 */
router.get('/prometheus', asyncHandler(async (req, res) => {
  const metrics = monitoringService.getPrometheusMetrics();
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
}));

/**
 * @route   GET /api/v1/monitoring/database
 * @desc    Get database statistics
 * @access  Private (admin/owner only)
 */
router.get('/database', authenticate, authorize('admin', 'owner'), asyncHandler(async (req, res) => {
  const stats = await monitoringService.getDatabaseStats();
  
  res.json({
    success: true,
    data: { stats },
  });
}));

/**
 * @route   GET /api/v1/monitoring/redis
 * @desc    Get Redis statistics
 * @access  Private (admin/owner only)
 */
router.get('/redis', authenticate, authorize('admin', 'owner'), asyncHandler(async (req, res) => {
  const stats = await monitoringService.getRedisStats();
  
  res.json({
    success: true,
    data: { stats },
  });
}));

/**
 * @route   GET /api/v1/monitoring/stats
 * @desc    Get application statistics
 * @access  Private (admin/owner only)
 */
router.get('/stats', authenticate, authorize('admin', 'owner'), asyncHandler(async (req, res) => {
  const stats = monitoringService.getRequestStats();
  
  res.json({
    success: true,
    data: { stats },
  });
}));

export default router;
