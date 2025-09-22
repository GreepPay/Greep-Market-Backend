# Product Export/Import Scripts

This directory contains scripts for exporting products from your development environment and importing them into your live/production environment.

## 📦 Product Export Scripts

### 🚀 Recommended: API-Based Export (Easiest)

**Best for most users** - Uses the running server's API to export products.

```bash
# Export all products via API
npm run export:products:api

# Export with custom output file
npm run export:products:api -- --output my-products.json

# Export from different server
npm run export:products:api -- --api-url https://your-server.com
```

### 🔧 Direct Database Export (Advanced)

**For advanced users** - Directly connects to the database.

```bash
# Export all products
npm run export:products

# Export products for specific store
npm run export:products -- --store-id your-store-id

# Export with custom output file
npm run export:products -- --output my-products.json

# Export in minimal format (only essential fields)
npm run export:products -- --format minimal
```

### Options

- `--store-id <id>`: Export products for specific store only
- `--output <file>`: Custom output file path
- `--format <format>`: Export format (`full` or `minimal`)

### Example Output

```json
[
  {
    "_id": "64f8b2c3d4e5f6a7b8c9d0e1",
    "name": "Premium Coffee Beans",
    "description": "High-quality Arabica coffee beans",
    "price": 25.99,
    "cost_price": 15.5,
    "category": "Beverages",
    "sku": "COFFEE-001",
    "barcode": "1234567890123",
    "stock_quantity": 50,
    "min_stock_level": 10,
    "max_stock_level": 100,
    "unit": "kg",
    "is_active": true,
    "is_featured": false,
    "created_by": "admin-user-id",
    "store_id": "default-store",
    "created_at": "2025-09-22T10:30:00.000Z",
    "updated_at": "2025-09-22T10:30:00.000Z"
  }
]
```

## 📥 Product Import Script

Imports products from a JSON file into the database.

### Usage

```bash
# Import products from file
npm run import:products products-export-2025-09-22.json

# Import with store ID override
npm run import:products products.json --store-id new-store-123

# Import with user override
npm run import:products products.json --created-by admin-user-id

# Dry run (see what would be imported)
npm run import:products products.json --dry-run

# Update existing products instead of skipping
npm run import:products products.json --update-existing
```

### Options

- `--store-id <id>`: Override store_id for all products
- `--created-by <id>`: Override created_by for all products
- `--dry-run`: Show what would be imported without importing
- `--skip-duplicates`: Skip products that already exist (by SKU) [default]
- `--update-existing`: Update existing products instead of skipping

## 🔄 Complete Workflow

### Step 1: Export from Development

**Option A: API-Based Export (Recommended)**

```bash
# Make sure your development server is running
npm run dev

# In another terminal, export products
npm run export:products:api
```

**Option B: Direct Database Export**

```bash
# Export all products
npm run export:products
```

This creates a file like `products-export-api-2025-09-22.json`

### Step 2: Transfer to Production

Copy the JSON file to your production server:

```bash
# Copy file to production server
scp products-export-api-2025-09-22.json user@production-server:/path/to/backend/
```

### Step 3: Import to Production

```bash
# On your production server
cd /path/to/your/backend
npm run import:products products-export-api-2025-09-22.json --store-id production-store-id
```

## 🛡️ Safety Features

### Dry Run Mode

Always test your import with dry run first:

```bash
npm run import:products products.json --dry-run
```

This shows you exactly what would be imported without making any changes.

### Duplicate Handling

The import script handles duplicates intelligently:

- **Skip Duplicates** (default): Skips products that already exist (by SKU)
- **Update Existing**: Updates existing products with new data
- **Allow Duplicates**: Creates new products even if SKU exists (not recommended)

### Validation

The import script validates:

- Required fields (name, price, category, sku, store_id, created_by)
- JSON file format
- Product data structure

## 📊 Import Summary

After import, you'll see a detailed summary:

```
📊 IMPORT SUMMARY
==================
📁 File: /path/to/products-export-2025-09-22.json
📦 Total Products: 150
➕ Imported: 145
🔄 Updated: 3
⏭️  Skipped: 2
❌ Errors: 0
```

## 🔧 Advanced Usage

### Export for Specific Store

```bash
npm run export:products -- --store-id development-store --output dev-products.json
```

### Import with Overrides

```bash
npm run import:products dev-products.json --store-id production-store --created-by production-admin
```

### Batch Operations

```bash
# Export multiple stores
npm run export:products -- --store-id store-1 --output store1-products.json
npm run export:products -- --store-id store-2 --output store2-products.json

# Import to different production stores
npm run import:products store1-products.json --store-id prod-store-1
npm run import:products store2-products.json --store-id prod-store-2
```

## 🚨 Important Notes

1. **Always backup** your production database before importing
2. **Use dry run** to verify imports before executing
3. **Check file permissions** when transferring between servers
4. **Verify store IDs** and user IDs exist in your production environment
5. **Review stock quantities** after import to ensure accuracy

## 🐛 Troubleshooting

### Common Issues

**"Missing required fields" error:**

- Ensure your JSON file has all required fields
- Check field names match the expected format

**"Product with SKU already exists" error:**

- Use `--update-existing` to update existing products
- Or use `--skip-duplicates` to skip them

**"Store ID not found" error:**

- Ensure the store exists in your production database
- Use `--store-id` to override with a valid store ID

**"Created by user not found" error:**

- Ensure the user exists in your production database
- Use `--created-by` to override with a valid user ID

### Getting Help

```bash
# Show help for export script
npm run export:products -- --help

# Show help for import script
npm run import:products --help
```

## 📝 Environment Variables

Make sure these are set in your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/market-management
```

For production, use your production MongoDB connection string.
