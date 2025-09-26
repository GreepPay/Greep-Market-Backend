# Market Management System - Backend

A comprehensive, scalable backend system for market management with microservices architecture, built with Node.js, TypeScript, Express.js, PostgreSQL, and Redis.

## 🏗️ Architecture Overview

This system follows a microservices architecture with the following components:

- **API Gateway**: Authentication, rate limiting, request routing
- **User Service**: Authentication, authorization, user management
- **Product Service**: Product catalog, search, pricing
- **Inventory Service**: Stock management, alerts, movements
- **Sales Service**: Transaction processing, payments, returns
- **Analytics Service**: Business metrics, reports, forecasting
- **Notification Service**: Real-time notifications, alerts
- **Report Service**: Report generation, exports
- **Audit Service**: Activity logging, compliance

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB
- **Cache**: Redis 7
- **Authentication**: JWT with refresh tokens
- **Validation**: Joi, express-validator
- **Logging**: Winston with daily rotation
- **Testing**: Jest, Supertest

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus, Grafana
- **Search**: Elasticsearch (optional)
- **File Storage**: AWS S3 compatible

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- MongoDB (if running locally)
- Redis 7 (if running locally)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BACKEND_MARKET
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start with Docker Compose (Recommended)**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Start with monitoring
   docker-compose --profile monitoring up -d
   
   # Start with search
   docker-compose --profile search up -d
   ```

5. **Or start locally**
   ```bash
   # Start PostgreSQL and Redis locally
   # Then run the application
   npm run dev
   ```

6. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

7. **Seed initial data (optional)**
   ```bash
   npm run db:seed
   ```

### API Documentation

Once the server is running, visit:
- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **Grafana Dashboard**: http://localhost:3001 (if monitoring is enabled)

## 📊 Database Schema

The system uses PostgreSQL with the following main entities:

- **Users**: Authentication, roles, permissions
- **Stores**: Business information, settings
- **Products**: Catalog, pricing, categories
- **Inventory**: Stock levels, movements, alerts
- **Transactions**: Sales, returns, payments
- **Customers**: Customer management, loyalty
- **Suppliers**: Vendor management
- **Expenses**: Cost tracking, categories

## 🔐 Authentication & Authorization

### JWT Authentication
- Access tokens (15 minutes)
- Refresh tokens (7 days)
- Token blacklisting for logout
- Role-based access control (RBAC)

### User Roles
- **Admin**: Full system access
- **Owner**: Store management, reports, analytics
- **Manager**: Products, inventory, transactions, reports
- **Cashier**: POS operations, basic transactions

### Permissions
Each role has specific permissions for different operations:
- `store:read`, `store:update`
- `products:manage`, `inventory:manage`
- `transactions:create`, `transactions:view`
- `reports:view`, `analytics:view`
- `users:manage`

## 🛡️ Security Features

- **Password Policy**: Strong password requirements
- **Rate Limiting**: API endpoint protection
- **CORS**: Configurable cross-origin policies
- **Helmet**: Security headers
- **Input Validation**: Request sanitization
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization

## 📈 Performance & Scalability

### Caching Strategy
- **L1**: Application-level caching
- **L2**: Redis caching with TTL
- **L3**: CDN for static assets

### Database Optimization
- Indexed queries for performance
- Connection pooling
- Read replicas for reporting
- Partitioning for large tables

### Monitoring
- Application metrics with Prometheus
- Log aggregation with Winston
- Health checks and alerts
- Performance monitoring

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## 📦 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Docker deployment**
   ```bash
   docker build -t market-management-api .
   docker run -p 3000:3000 market-management-api
   ```

3. **Kubernetes deployment**
   ```bash
   kubectl apply -f k8s/
   ```

### Environment Variables

Required environment variables for production:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: JWT refresh secret
- `AWS_ACCESS_KEY_ID`: AWS credentials
- `AWS_SECRET_ACCESS_KEY`: AWS credentials

## 🔧 Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── services/        # Business logic
├── models/          # Data models
├── middleware/      # Express middleware
├── routes/          # API routes
├── utils/           # Utility functions
├── types/           # TypeScript types
├── validators/      # Input validation
├── queues/          # Background jobs
└── websockets/      # Real-time features
```

### Code Style
- ESLint for code linting
- Prettier for code formatting
- TypeScript strict mode
- Consistent naming conventions

### Git Workflow
- Feature branches
- Pull request reviews
- Automated testing
- Semantic versioning

## 📝 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user

### Products
- `GET /api/v1/products` - List products
- `GET /api/v1/products/:id` - Get product
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Inventory
- `GET /api/v1/inventory` - List inventory
- `GET /api/v1/inventory/:productId` - Get product inventory
- `POST /api/v1/inventory/:productId/adjust` - Adjust inventory
- `GET /api/v1/inventory/low-stock` - Get low stock items

### Transactions
- `GET /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction
- `POST /api/v1/transactions/:id/complete` - Complete transaction
- `POST /api/v1/transactions/:id/void` - Void transaction

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🔄 Changelog

### v1.0.0
- Initial release
- Core authentication system
- Basic CRUD operations
- Docker support
- Monitoring setup
# Greep-Market-Backend
