# Market Management System - API Documentation

## Overview

The Market Management System provides a comprehensive REST API for managing retail operations including products, inventory, sales transactions, customers, and analytics.

**Base URL**: `http://localhost:3000/api/v1`

**Authentication**: JWT Bearer Token

**Default Currency**: Turkish Lira (₺)

## Authentication

### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "role": "cashier",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+905551234567",
  "store_id": "uuid-here"
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer your-access-token
```

## Products

### Get Products (with search and filtering)

```http
GET /api/v1/products?store_id=uuid&search=product&category_id=uuid&min_price=10&max_price=100&page=1&limit=20
Authorization: Bearer your-access-token
```

### Get Product by ID

```http
GET /api/v1/products/{id}
Authorization: Bearer your-access-token
```

### Get Product by Barcode

```http
GET /api/v1/products/barcode/{barcode}
Authorization: Bearer your-access-token
```

### Create Product

```http
POST /api/v1/products
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "name": "Product Name",
  "description": "Product description",
  "sku": "SKU123",
  "barcode": "1234567890123",
  "category_id": "uuid",
  "cost_price": 50.00,
  "selling_price": 75.00,
  "tax_rate": 18.00,
  "unit_type": "piece",
  "weight": 0.5,
  "is_trackable": true,
  "reorder_level": 10,
  "reorder_quantity": 50
}
```

### Update Product

```http
PUT /api/v1/products/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Product Name",
  "selling_price": 80.00
}
```

### Update Product Pricing

```http
PUT /api/v1/products/{id}/pricing
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "cost_price": 55.00,
  "selling_price": 85.00,
  "tax_rate": 20.00
}
```

### Get Product Profit Margin

```http
GET /api/v1/products/{id}/profit-margin
Authorization: Bearer your-access-token
```

## Inventory

### Get All Inventory Items

```http
GET /api/v1/inventory?store_id=uuid&page=1&limit=50
Authorization: Bearer your-access-token
```

### Get Product Inventory

```http
GET /api/v1/inventory/{productId}?store_id=uuid
Authorization: Bearer your-access-token
```

### Adjust Inventory

```http
POST /api/v1/inventory/{productId}/adjust
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "movement_type": "in",
  "quantity": 100,
  "reason": "Stock received",
  "cost_per_unit": 50.00,
  "notes": "Purchase order #123"
}
```

### Reserve Stock

```http
POST /api/v1/inventory/{productId}/reserve
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "quantity": 5,
  "store_id": "uuid"
}
```

### Release Reserved Stock

```http
POST /api/v1/inventory/{productId}/release
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "quantity": 5,
  "store_id": "uuid"
}
```

### Get Low Stock Items

```http
GET /api/v1/inventory/low-stock?store_id=uuid
Authorization: Bearer your-access-token
```

### Perform Stock Count

```http
POST /api/v1/inventory/stock-count
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "product_id": "uuid",
  "counted_quantity": 95,
  "notes": "Physical count completed"
}
```

### Set Reorder Levels

```http
PUT /api/v1/inventory/{productId}/reorder-levels
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "min_stock_level": 10,
  "max_stock_level": 200,
  "reorder_quantity": 50
}
```

### Get Stock Movement History

```http
GET /api/v1/inventory/{productId}/movements?start_date=2024-01-01&end_date=2024-01-31&store_id=uuid
Authorization: Bearer your-access-token
```

## Transactions

### Get Transactions

```http
GET /api/v1/transactions?store_id=uuid&start_date=2024-01-01&end_date=2024-01-31&status=completed&page=1&limit=50
Authorization: Bearer your-access-token
```

### Get Transaction by ID

```http
GET /api/v1/transactions/{id}
Authorization: Bearer your-access-token
```

### Create Transaction

```http
POST /api/v1/transactions
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "customer_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "unit_price": 75.00
    }
  ],
  "discount_amount": 10.00,
  "payment_method": "cash",
  "notes": "Customer discount applied"
}
```

### Process Payment

```http
POST /api/v1/transactions/{id}/payment
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "amount": 140.00,
  "payment_method": "cash",
  "change_amount": 10.00
}
```

### Complete Transaction

```http
POST /api/v1/transactions/{id}/complete
Authorization: Bearer your-access-token
```

### Void Transaction

```http
POST /api/v1/transactions/{id}/void
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "reason": "Customer cancelled order"
}
```

### Process Return

```http
POST /api/v1/transactions/{id}/return
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "items": [
    {
      "transaction_item_id": "uuid",
      "quantity": 1,
      "reason": "Defective product"
    }
  ],
  "reason": "Product defect",
  "refund_method": "cash"
}
```

### Issue Refund

```http
POST /api/v1/transactions/{id}/refund
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "amount": 75.00,
  "reason": "Customer complaint",
  "refund_method": "cash"
}
```

## Customers

### Get Customers

```http
GET /api/v1/customers?store_id=uuid&page=1&limit=50
Authorization: Bearer your-access-token
```

### Get Customer by ID

```http
GET /api/v1/customers/{id}
Authorization: Bearer your-access-token
```

### Create Customer

```http
POST /api/v1/customers
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "uuid",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "phone": "+905559876543",
  "address": "123 Main St, Istanbul",
  "date_of_birth": "1990-01-01"
}
```

### Update Customer

```http
PUT /api/v1/customers/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "phone": "+905559876544",
  "address": "456 New St, Istanbul"
}
```

## Analytics

### Get Dashboard Analytics

```http
GET /api/v1/analytics/dashboard?store_id=uuid&period=month
Authorization: Bearer your-access-token
```

### Get Sales Analytics

```http
GET /api/v1/analytics/sales?store_id=uuid&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your-access-token
```

### Get Product Performance

```http
GET /api/v1/analytics/products?store_id=uuid&period=week
Authorization: Bearer your-access-token
```

### Get Inventory Analytics

```http
GET /api/v1/analytics/inventory?store_id=uuid
Authorization: Bearer your-access-token
```

### Get Customer Analytics

```http
GET /api/v1/analytics/customers?store_id=uuid&period=month
Authorization: Bearer your-access-token
```

## Monitoring

### Health Check

```http
GET /api/v1/monitoring/health
```

### Get System Metrics

```http
GET /api/v1/monitoring/metrics
Authorization: Bearer your-access-token
```

### Prometheus Metrics

```http
GET /api/v1/monitoring/prometheus
```

### Database Statistics

```http
GET /api/v1/monitoring/database
Authorization: Bearer your-access-token
```

### Redis Statistics

```http
GET /api/v1/monitoring/redis
Authorization: Bearer your-access-token
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/endpoint"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Rate Limiting

- **General API**: 1000 requests per hour per user
- **Authentication**: 5 attempts per minute
- **Reports**: 100 requests per hour per user
- **POS Operations**: 10000 requests per hour per store

## User Roles and Permissions

### Admin

- Full system access
- All permissions

### Owner

- Store management
- User management
- Reports and analytics
- Product and inventory management
- Transaction management
- Customer management
- Expense management

### Manager

- Product and inventory management
- Transaction viewing
- Reports and analytics
- Customer management
- Expense viewing

### Cashier

- POS operations
- Transaction creation
- Inventory viewing
- Product viewing
- Customer viewing

## Webhooks (Future Implementation)

The system will support webhooks for real-time notifications:

- `transaction.completed`
- `inventory.low_stock`
- `product.created`
- `customer.registered`

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @market-management/sdk
```

### Python

```bash
pip install market-management-sdk
```

## Support

For API support and questions:

- Documentation: `/api/docs`
- Health Check: `/health`
- Monitoring: `/api/v1/monitoring/health`
