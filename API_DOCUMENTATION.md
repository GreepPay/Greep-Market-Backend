# Market Management System - API Documentation

## Overview

The Market Management System provides a comprehensive REST API for managing retail operations including products, inventory, sales transactions, customers, expenses, analytics, and user management.

**Base URL**: `http://localhost:3001/api/v1`

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
  "store_id": "default-store"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "cashier",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+905551234567",
    "store_id": "default-store",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
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

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "role": "cashier",
      "first_name": "John",
      "last_name": "Doe",
      "store_id": "default-store"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
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

### Update Profile (Self)

```http
PUT /api/v1/auth/profile
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "email": "newemail@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+905551234567"
}
```

## Users

### Get Users (Admin/Owner/Manager only)

```http
GET /api/v1/users?page=1&limit=20&search=john&role=cashier&store_id=default-store
Authorization: Bearer your-access-token
```

### Get User by ID

```http
GET /api/v1/users/{id}
Authorization: Bearer your-access-token
```

### Create User (Admin/Owner/Manager only)

```http
POST /api/v1/users
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "role": "cashier",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+905559876543",
  "store_id": "default-store"
}
```

### Update User (Admin/Owner only)

```http
PUT /api/v1/users/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "email": "updated@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+905559876543",
  "role": "manager"
}
```

### Update User Password

```http
PUT /api/v1/users/{id}/password
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "password": "NewSecurePassword123!"
}
```

### Delete User (Admin/Owner only)

```http
DELETE /api/v1/users/{id}
Authorization: Bearer your-access-token
```

### Toggle User Status (Admin/Owner only)

```http
PATCH /api/v1/users/{id}/toggle-status
Authorization: Bearer your-access-token
```

## Products

### Get Products

```http
GET /api/v1/products?store_id=default-store&category=food&search=bread&is_active=true&is_featured=false&sortBy=name&sortOrder=asc
Authorization: Bearer your-access-token
```

**Response:**

```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "products": [
      {
        "_id": "product_id",
        "name": "Product Name",
        "description": "Product description",
        "price": 75.0,
        "category": "food",
        "sku": "SKU123",
        "barcode": "1234567890123",
        "stock_quantity": 100,
        "store_id": "default-store",
        "created_by": "user_id",
        "tags": ["tag1", "tag2"],
        "images": ["image1.jpg", "image2.jpg"],
        "is_active": true,
        "is_featured": false,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
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
Content-Type: multipart/form-data

{
  "name": "Product Name",
  "description": "Product description",
  "price": 75.00,
  "category": "food",
  "sku": "SKU123",
  "barcode": "1234567890123",
  "stock_quantity": 100,
  "store_id": "default-store",
  "created_by": "user_id",
  "tags": "tag1,tag2",
  "images": [file1, file2]
}
```

### Update Product

```http
PUT /api/v1/products/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": 80.00,
  "description": "Updated description"
}
```

### Delete Product

```http
DELETE /api/v1/products/{id}
Authorization: Bearer your-access-token
```

### Export Products

```http
GET /api/v1/products/export?store_id=default-store
Authorization: Bearer your-access-token
```

### Import Products

```http
POST /api/v1/products/import
Authorization: Bearer your-access-token
Content-Type: multipart/form-data

{
  "file": [json_file],
  "store_id": "default-store"
}
```

## Transactions

### Get Transactions

```http
GET /api/v1/transactions?store_id=default-store&start_date=2024-01-01&end_date=2024-01-31&status=completed&payment_method=cash&page=1&limit=20
Authorization: Bearer your-access-token
```

**Response:**

```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "_id": "transaction_id",
        "store_id": "default-store",
        "customer_id": "customer_id",
        "items": [
          {
            "product_id": "product_id",
            "product_name": "Product Name",
            "quantity": 2,
            "unit_price": 75.0,
            "total_price": 150.0
          }
        ],
        "subtotal": 150.0,
        "discount_amount": 10.0,
        "total_amount": 140.0,
        "payment_method": "cash",
        "payment_status": "completed",
        "status": "completed",
        "notes": "Transaction notes",
        "created_by": "user_id",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "pages": 1,
    "total": 1
  }
}
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
  "store_id": "default-store",
  "customer_id": "customer_id",
  "items": [
    {
      "product_id": "product_id",
      "quantity": 2,
      "unit_price": 75.00
    }
  ],
  "discount_amount": 10.00,
  "payment_method": "cash",
  "notes": "Transaction notes"
}
```

### Update Transaction (Pending only)

```http
PUT /api/v1/transactions/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "items": [
    {
      "product_id": "product_id",
      "quantity": 3,
      "unit_price": 75.00
    }
  ],
  "discount_amount": 15.00,
  "payment_method": "card",
  "notes": "Updated transaction notes"
}
```

### Delete Transaction (Pending only)

```http
DELETE /api/v1/transactions/{id}
Authorization: Bearer your-access-token
```

## Expenses

### Get Expenses

```http
GET /api/v1/expenses?page=1&limit=20&category=food&payment_method=cash&start_date=2024-01-01&end_date=2024-01-31&search=supplies
Authorization: Bearer your-access-token
```

**Response:**

```json
{
  "success": true,
  "message": "Expenses retrieved successfully",
  "data": {
    "expenses": [
      {
        "_id": "expense_id",
        "store_id": "default-store",
        "category": "food",
        "description": "Grocery supplies",
        "amount": 500.0,
        "payment_method": "cash",
        "receipt_number": "RCP001",
        "notes": "Monthly grocery purchase",
        "created_by": "user_id",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "pages": 1,
    "total": 1
  }
}
```

### Get Expense by ID

```http
GET /api/v1/expenses/{id}
Authorization: Bearer your-access-token
```

### Create Expense

```http
POST /api/v1/expenses
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "default-store",
  "category": "food",
  "description": "Grocery supplies",
  "amount": 500.00,
  "payment_method": "cash",
  "receipt_number": "RCP001",
  "notes": "Monthly grocery purchase"
}
```

### Update Expense

```http
PUT /api/v1/expenses/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "category": "supplies",
  "description": "Updated description",
  "amount": 600.00
}
```

### Delete Expense

```http
DELETE /api/v1/expenses/{id}
Authorization: Bearer your-access-token
```

### Get Expense Statistics

```http
GET /api/v1/expenses/stats?start_date=2024-01-01&end_date=2024-01-31&store_id=default-store
Authorization: Bearer your-access-token
```

## Analytics

### Get Dashboard Analytics

```http
GET /api/v1/analytics/dashboard?dateRange=today&startDate=2024-01-01&endDate=2024-01-31&paymentMethod=cash&orderSource=pos&status=completed
Authorization: Bearer your-access-token
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSales": 15000.0,
    "totalTransactions": 150,
    "averageTransactionValue": 100.0,
    "growthRate": 15.5,
    "totalProducts": 500,
    "lowStockItems": 25,
    "todaySales": 500.0,
    "monthlySales": 15000.0,
    "totalExpenses": 5000.0,
    "monthlyExpenses": 5000.0,
    "netProfit": 10000.0,
    "topProducts": [
      {
        "productName": "Product Name",
        "quantitySold": 50,
        "revenue": 3750.0,
        "productId": "product_id"
      }
    ],
    "recentTransactions": [
      {
        "id": "transaction_id",
        "totalAmount": 150.0,
        "paymentMethod": "cash",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "salesByMonth": [
      {
        "sales": 5000.0,
        "transactions": 50,
        "month": "2024-01"
      }
    ]
  }
}
```

### Get Sales Analytics

```http
GET /api/v1/analytics/sales?start_date=2024-01-01&end_date=2024-01-31&store_id=default-store
Authorization: Bearer your-access-token
```

### Get Product Performance

```http
GET /api/v1/analytics/products?period=week&store_id=default-store
Authorization: Bearer your-access-token
```

### Get Inventory Analytics

```http
GET /api/v1/analytics/inventory?store_id=default-store
Authorization: Bearer your-access-token
```

## Goals

### Get Goals

```http
GET /api/v1/goals?goal_type=daily&is_active=true&store_id=default-store
Authorization: Bearer your-access-token
```

### Create Goal

```http
POST /api/v1/goals
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "default-store",
  "goal_type": "daily",
  "target_amount": 5000.00,
  "period_start": "2024-01-01",
  "period_end": "2024-01-31",
  "description": "Daily sales target"
}
```

### Update Goal

```http
PUT /api/v1/goals/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "target_amount": 6000.00,
  "description": "Updated daily sales target"
}
```

### Delete Goal

```http
DELETE /api/v1/goals/{id}
Authorization: Bearer your-access-token
```

## Stores

### Get Store Settings

```http
GET /api/v1/stores/settings?store_id=default-store
Authorization: Bearer your-access-token
```

### Update Store Settings

```http
PUT /api/v1/stores/settings
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "default-store",
  "name": "Updated Store Name",
  "address": "New Address",
  "phone": "+905551234567",
  "email": "store@example.com",
  "currency": "TRY",
  "tax_rate": 18.00,
  "timezone": "Europe/Istanbul"
}
```

### Get Store by ID

```http
GET /api/v1/stores/{id}
Authorization: Bearer your-access-token
```

## Customers

### Get Customers

```http
GET /api/v1/customers?store_id=default-store&page=1&limit=20&search=john
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
  "store_id": "default-store",
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

### Delete Customer (Admin/Owner/Manager only)

```http
DELETE /api/v1/customers/{id}
Authorization: Bearer your-access-token
```

## Inventory

### Get Inventory Items

```http
GET /api/v1/inventory?store_id=default-store&page=1&limit=50&product_id=product_id
Authorization: Bearer your-access-token
```

### Get Product Inventory

```http
GET /api/v1/inventory/{productId}?store_id=default-store
Authorization: Bearer your-access-token
```

### Adjust Inventory

```http
POST /api/v1/inventory/{productId}/adjust
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "default-store",
  "movement_type": "in",
  "quantity": 100,
  "reason": "Stock received",
  "cost_per_unit": 50.00,
  "notes": "Purchase order #123"
}
```

### Get Low Stock Items

```http
GET /api/v1/inventory/low-stock?store_id=default-store
Authorization: Bearer your-access-token
```

### Get Stock Movement History

```http
GET /api/v1/inventory/{productId}/movements?start_date=2024-01-01&end_date=2024-01-31&store_id=default-store
Authorization: Bearer your-access-token
```

## Riders

### Get Riders

```http
GET /api/v1/riders?store_id=default-store&page=1&limit=20&search=john
Authorization: Bearer your-access-token
```

### Get Rider by ID

```http
GET /api/v1/riders/{id}
Authorization: Bearer your-access-token
```

### Create Rider

```http
POST /api/v1/riders
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "store_id": "default-store",
  "name": "John Rider",
  "phone": "+905551234567",
  "email": "rider@example.com",
  "vehicle_type": "bike",
  "license_number": "LIC123",
  "is_active": true
}
```

### Update Rider

```http
PUT /api/v1/riders/{id}
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Rider Name",
  "phone": "+905559876543",
  "vehicle_type": "motorcycle"
}
```

### Delete Rider

```http
DELETE /api/v1/riders/{id}
Authorization: Bearer your-access-token
```

### Get Rider Cash History

```http
GET /api/v1/riders/{id}/cash-history?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your-access-token
```

## Audit Logs

### Get Audit Logs (Admin/Owner/Manager only)

```http
GET /api/v1/audit/logs?page=1&limit=20&entity_type=USER&action=CREATE&start_date=2024-01-01&end_date=2024-01-31&user_id=user_id
Authorization: Bearer your-access-token
```

### Get Audit Analytics (Admin/Owner/Manager only)

```http
GET /api/v1/audit/analytics?start_date=2024-01-01&end_date=2024-01-31&store_id=default-store
Authorization: Bearer your-access-token
```

## Public Customer Catalog

### Get Public Product Catalog

```http
GET /api/v1/public/catalog?store_id=default-store&category=food&search=bread&is_active=true&sortBy=name&sortOrder=asc
```

**Response:**

```json
{
  "success": true,
  "message": "Catalog retrieved successfully",
  "data": {
    "products": [
      {
        "_id": "product_id",
        "name": "Product Name",
        "description": "Product description",
        "price": 75.0,
        "category": "food",
        "sku": "SKU123",
        "barcode": "1234567890123",
        "stock_quantity": 100,
        "store_id": "default-store",
        "tags": ["tag1", "tag2"],
        "images": ["image1.jpg", "image2.jpg"],
        "is_active": true,
        "is_featured": false
      }
    ],
    "total": 1
  }
}
```

### Get Product by ID (Public)

```http
GET /api/v1/public/product/{id}?store_id=default-store
```

### Get Product by Barcode (Public)

```http
GET /api/v1/public/product/barcode/{barcode}?store_id=default-store
```

### Get Product Categories (Public)

```http
GET /api/v1/public/categories?store_id=default-store
```

### Create Customer Order

```http
POST /api/v1/public/orders
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_phone": "+905551234567",
  "customer_email": "john@example.com",
  "store_id": "default-store",
  "items": [
    {
      "product_id": "product_id",
      "quantity": 2,
      "notes": "Extra fresh please"
    }
  ],
  "payment_method": "cash_on_delivery",
  "delivery_method": "delivery",
  "delivery_address": "123 Main St, Istanbul",
  "notes": "Please call before delivery"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "_id": "order_id",
      "order_number": "ORD-20240101-001",
      "customer_name": "John Doe",
      "customer_phone": "+905551234567",
      "customer_email": "john@example.com",
      "store_id": "default-store",
      "items": [
        {
          "product_id": "product_id",
          "product_name": "Product Name",
          "quantity": 2,
          "unit_price": 75.0,
          "total_price": 150.0,
          "notes": "Extra fresh please"
        }
      ],
      "status": "pending",
      "payment_method": "cash_on_delivery",
      "delivery_method": "delivery",
      "subtotal": 150.0,
      "delivery_fee": 25.0,
      "total_amount": 175.0,
      "delivery_address": "123 Main St, Istanbul",
      "notes": "Please call before delivery",
      "whatsapp_sent": false,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "whatsapp_share_link": "https://wa.me/905551234567?text=Hi!%20I've%20placed%20order%20%23ORD-20240101-001%20for%20John%20Doe.",
    "order_tracking_url": "http://localhost:3001/api/v1/public/orders/ORD-20240101-001/status"
  }
}
```

### Get Order Status (Public Tracking)

```http
GET /api/v1/public/orders/{orderNumber}/status
```

**Response:**

```json
{
  "success": true,
  "message": "Order status retrieved successfully",
  "data": {
    "order_number": "ORD-20240101-001",
    "customer_name": "John Doe",
    "status": "confirmed",
    "total_amount": 175.0,
    "payment_method": "cash_on_delivery",
    "delivery_method": "delivery",
    "created_at": "2024-01-01T00:00:00.000Z",
    "confirmed_at": "2024-01-01T00:30:00.000Z",
    "completed_at": null,
    "items": [
      {
        "product_name": "Product Name",
        "quantity": 2,
        "unit_price": 75.0,
        "total_price": 150.0
      }
    ]
  }
}
```

## Customer Orders Management (Admin)

### Get Customer Orders

```http
GET /api/v1/admin/customer-orders?store_id=default-store&status=pending&customer_phone=+905551234567&start_date=2024-01-01&end_date=2024-01-31&page=1&limit=20
Authorization: Bearer your-access-token
```

### Get Customer Order by ID

```http
GET /api/v1/admin/customer-orders/{id}
Authorization: Bearer your-access-token
```

### Update Order Status

```http
PUT /api/v1/admin/customer-orders/{id}/status
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "status": "confirmed",
  "notes": "Order confirmed and being prepared"
}
```

### Mark WhatsApp as Sent

```http
POST /api/v1/admin/customer-orders/{id}/whatsapp-sent
Authorization: Bearer your-access-token
```

### Convert Order to Transaction

```http
POST /api/v1/admin/customer-orders/{id}/convert-to-transaction
Authorization: Bearer your-access-token
```

### Get Order Statistics

```http
GET /api/v1/admin/customer-orders/stats/overview?store_id=default-store&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your-access-token
```

**Response:**

```json
{
  "success": true,
  "message": "Order statistics retrieved successfully",
  "data": {
    "totalOrders": 50,
    "totalRevenue": 8750.0,
    "pendingOrders": 5,
    "confirmedOrders": 10,
    "completedOrders": 35,
    "averageOrderValue": 175.0
  }
}
```

### Get WhatsApp Share Link

```http
GET /api/v1/admin/customer-orders/{id}/whatsapp-link
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
  "message": "Error description",
  "errors": [
    {
      "type": "field",
      "msg": "Validation error message",
      "path": "field_name",
      "location": "body"
    }
  ],
  "code": "ERROR_CODE",
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
- Can manage all users, stores, and settings

### Owner

- Store management
- User management (except admins)
- Reports and analytics
- Product and inventory management
- Transaction management
- Customer management
- Expense management
- Settings management

### Manager

- Product and inventory management
- Transaction viewing and management
- Reports and analytics
- Customer management
- Expense viewing and management
- User management (cashiers only)

### Cashier

- Product viewing
- Transaction creation and management
- Customer viewing
- Expense viewing
- Reports and analytics viewing
- Settings (profile only)

## Authentication Flow

1. **Register/Login**: Get access token and refresh token
2. **API Requests**: Include `Authorization: Bearer {access_token}` header
3. **Token Refresh**: Use refresh token to get new access token when expired
4. **Logout**: Invalidate tokens

## Data Models

### User

```json
{
  "id": "string",
  "email": "string",
  "role": "admin|owner|manager|cashier",
  "first_name": "string",
  "last_name": "string",
  "phone": "string",
  "store_id": "string",
  "is_active": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Product

```json
{
  "_id": "string",
  "name": "string",
  "description": "string",
  "price": "number",
  "category": "string",
  "sku": "string",
  "barcode": "string",
  "stock_quantity": "number",
  "store_id": "string",
  "created_by": "string",
  "tags": ["string"],
  "images": ["string"],
  "is_active": "boolean",
  "is_featured": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Transaction

```json
{
  "_id": "string",
  "store_id": "string",
  "customer_id": "string",
  "items": [
    {
      "product_id": "string",
      "product_name": "string",
      "quantity": "number",
      "unit_price": "number",
      "total_price": "number"
    }
  ],
  "subtotal": "number",
  "discount_amount": "number",
  "total_amount": "number",
  "payment_method": "cash|pos_isbank_transfer|naira_transfer|crypto_payment",
  "payment_status": "pending|completed|failed",
  "status": "pending|completed|cancelled",
  "notes": "string",
  "created_by": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Webhooks (Future Implementation)

The system will support webhooks for real-time notifications:

- `transaction.completed`
- `inventory.low_stock`
- `product.created`
- `customer.registered`
- `expense.created`
- `goal.achieved`

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
- Base URL: `http://localhost:3001/api/v1`

## Changelog

### Version 1.0.0

- Initial API release
- Authentication and user management
- Product and inventory management
- Transaction processing
- Expense tracking
- Analytics and reporting
- Goal setting and tracking
- Customer management
- Rider management
- Audit logging
- Store settings
- Monitoring and health checks
