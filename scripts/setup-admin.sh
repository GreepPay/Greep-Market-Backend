#!/bin/bash

# Admin Setup Script
# Creates admin user for production deployment

echo "🚀 Setting up admin user for production..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to project directory
cd "$(dirname "$0")/.."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Run the admin setup script
echo "👤 Setting up admin user..."
node scripts/setup-admin.js

echo "✅ Admin setup completed!"
echo ""
echo "🔐 Login Credentials:"
echo "   Email: aguntawisdom@gmail.com"
echo "   Password: qwerty1234"
echo ""
echo "⚠️  Remember to change the password after first login!"
