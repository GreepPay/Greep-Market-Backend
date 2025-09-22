#!/usr/bin/env node

/**
 * Test Script for Environment Variables
 * Demonstrates how the API scripts use environment variables
 */

console.log('🔧 ENVIRONMENT VARIABLE TEST');
console.log('============================\n');

console.log('Environment Variables:');
console.log(`  API_URL: ${process.env.API_URL || 'Not set'}`);
console.log(`  SERVER_URL: ${process.env.SERVER_URL || 'Not set'}`);
console.log(`  API_TOKEN: ${process.env.API_TOKEN || 'Not set'}`);
console.log('');

// Simulate the same logic used in the scripts
const apiUrl = process.env.API_URL || process.env.SERVER_URL || 'http://localhost:3001';

console.log('Script Configuration:');
console.log(`  Final API URL: ${apiUrl}`);
console.log('');

console.log('Test Connection...');
const https = require('https');
const http = require('http');

async function testConnection(url) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;

        client.get(url, (res) => {
            resolve({ status: res.statusCode, success: true });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

testConnection(`${apiUrl}/health`)
    .then((result) => {
        console.log(`✅ Connection successful! Status: ${result.status}`);
        console.log(`📍 Server URL: ${apiUrl}`);
    })
    .catch((error) => {
        console.log(`❌ Connection failed: ${error.message}`);
        console.log(`📍 Attempted URL: ${apiUrl}`);
    });

console.log('\n💡 To set environment variables:');
console.log('  export API_URL=http://localhost:3001');
console.log('  npm run export:products:api');
console.log('\n  Or inline:');
console.log('  API_URL=http://localhost:3001 npm run export:products:api');
