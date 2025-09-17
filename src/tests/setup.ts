import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// Global test setup
beforeAll(async () => {
  // Setup test database connection
  // Setup test Redis connection
});

afterAll(async () => {
  // Cleanup test database
  // Cleanup test Redis
});

// Global test utilities
global.testUtils = {
  // Add common test utilities here
};
