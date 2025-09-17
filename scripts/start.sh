#!/bin/bash

# Market Management System - Startup Script

echo "🚀 Starting Market Management System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "   Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET"
    exit 1
fi

# Start services with Docker Compose
echo "🐳 Starting services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Check API
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API is ready"
else
    echo "❌ API is not ready"
fi

echo ""
echo "🎉 Market Management System is starting up!"
echo ""
echo "📚 API Documentation: http://localhost:3000/api/docs"
echo "🏥 Health Check: http://localhost:3000/health"
echo "🔧 Grafana Dashboard: http://localhost:3001 (if monitoring enabled)"
echo ""
echo "📋 Useful commands:"
echo "   docker-compose logs -f api     # View API logs"
echo "   docker-compose logs -f postgres # View database logs"
echo "   docker-compose down            # Stop all services"
echo "   docker-compose restart api     # Restart API service"
echo ""
