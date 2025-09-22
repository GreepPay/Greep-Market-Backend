/**
 * Configuration Example for Product Export/Import Scripts
 * 
 * Copy this file to config.js and update the values for your environment
 */

module.exports = {
    // API Configuration
    apiUrl: process.env.API_URL || process.env.SERVER_URL || 'http://localhost:3001',

    // Authentication (if required)
    token: process.env.API_TOKEN || null,

    // Default export settings
    export: {
        limit: 1000, // Maximum products to export per request
        format: 'full' // 'full' or 'minimal'
    },

    // Default import settings
    import: {
        batchSize: 10, // Process products in batches
        skipDuplicates: true, // Skip existing products by default
        updateExisting: false // Update existing products instead of skipping
    }
};

// Environment Examples:
// 
// Development (local):
// API_URL=http://localhost:3001
// 
// Staging:
// API_URL=https://staging-api.yourdomain.com
// 
// Production:
// API_URL=https://api.yourdomain.com
// API_TOKEN=your-auth-token-here
