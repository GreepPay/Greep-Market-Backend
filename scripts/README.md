# Product Migration Script

This script allows you to copy all products from your development environment to your production environment safely.

## Features

- ✅ **Safe Migration**: Skips products that already exist (based on SKU)
- ✅ **Complete Product Data**: Migrates all product information including images, pricing, inventory, etc.
- ✅ **Error Handling**: Continues migration even if individual products fail
- ✅ **Progress Tracking**: Shows real-time progress and detailed statistics
- ✅ **Validation**: Validates migration success after completion
- ✅ **Logging**: Comprehensive logging of all operations

## Prerequisites

1. **Node.js** installed on your system
2. **Access** to both development and production databases
3. **Backup** of your production database (recommended)

## Setup

### 1. Configure Environment Variables

Copy the example environment file:

```bash
cp migration.env.example migration.env
```

Edit `migration.env` with your actual database connection strings:

```bash
# Development Database (source)
DEV_MONGODB_URI=mongodb://localhost:27017/greep-market-dev

# Production Database (destination)
PROD_MONGODB_URI=mongodb://localhost:27017/greep-market-prod
```

### 2. Load Environment Variables

The script will automatically load environment variables from:

- `.env` file (if exists)
- `migration.env` file (if exists)
- System environment variables

## Usage

### Option 1: Using npm script (Recommended)

```bash
npm run migrate:products
```

### Option 2: Direct execution

```bash
node scripts/migrate-products.js
```

### Option 3: With custom environment file

```bash
node -r dotenv/config scripts/migrate-products.js dotenv_config_path=migration.env
```

## What Gets Migrated

The script migrates all product data including:

- ✅ Basic Information (name, description, price, cost_price)
- ✅ Inventory Data (stock_quantity, min/max stock levels)
- ✅ Product Details (SKU, barcode, category, unit, weight)
- ✅ Images and Media
- ✅ Supplier Information
- ✅ Tax and Discount Settings
- ✅ Product Status (active, featured)
- ✅ Creation and Update Timestamps
- ✅ Store Association

## Migration Process

1. **Connect** to both development and production databases
2. **Fetch** all products from development database
3. **Check** for existing products in production (by SKU)
4. **Migrate** new products one by one
5. **Validate** migration results
6. **Report** detailed statistics

## Example Output

```
🚀 PRODUCT MIGRATION SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 Connecting to databases...
✅ Connected to development database
✅ Connected to production database
📦 Fetching products from development database...
📊 Found 150 products to migrate

🚀 Starting product migration...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/150] Migrating "Apple iPhone 14"... ✅ Migrated: "Apple iPhone 14" (SKU: IPH14-001)
[2/150] Migrating "Samsung Galaxy S23"... ✅ Migrated: "Samsung Galaxy S23" (SKU: SGS23-001)
[3/150] Migrating "MacBook Pro M2"... ⏭️  Skipping product "MacBook Pro M2" - SKU MBPM2-001 already exists
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Validating migration...
📊 Development products: 150
📊 Production products: 145
✅ Migration validation successful!

📋 MIGRATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Total products: 150
✅ Successfully migrated: 145
⏭️  Skipped (already exist): 5
❌ Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Migration completed successfully!
```

## Safety Features

- **Duplicate Prevention**: Products with existing SKUs are automatically skipped
- **Error Isolation**: If one product fails, others continue to migrate
- **Transaction Safety**: Each product is migrated individually
- **Validation**: Post-migration validation ensures data integrity

## Troubleshooting

### Common Issues

1. **Connection Failed**

   ```
   ❌ Database connection failed: Authentication failed
   ```

   **Solution**: Check your database credentials and connection strings

2. **Permission Denied**

   ```
   ❌ Failed to migrate product: E11000 duplicate key error
   ```

   **Solution**: This is expected behavior - the script will skip duplicates

3. **Schema Mismatch**
   ```
   ❌ Failed to migrate product: ValidationError
   ```
   **Solution**: Ensure both databases have compatible schemas

### Environment Variables

Make sure these environment variables are set:

- `DEV_MONGODB_URI`: Development database connection string
- `PROD_MONGODB_URI`: Production database connection string

### Database Requirements

- Both databases must be MongoDB
- Both databases must have the same Product schema
- Production database must be writable
- Development database must be readable

## Advanced Usage

### Custom Migration

You can modify the script to:

- Filter products by category, date, or other criteria
- Transform data during migration
- Migrate to different database types
- Add custom validation rules

### Batch Processing

For large datasets, the script includes:

- Small delays between migrations (100ms)
- Progress tracking
- Memory-efficient processing
- Error recovery

## Support

If you encounter issues:

1. Check the logs for specific error messages
2. Verify your database connections
3. Ensure both databases are accessible
4. Check that your schemas are compatible

For additional help, check the script source code in `scripts/migrate-products.js`.
