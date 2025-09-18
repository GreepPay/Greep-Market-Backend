# Database Management Scripts

This directory contains scripts for managing and clearing database data.

## Available Scripts

### 1. Clear Sales Only

```bash
# Using npm script (recommended)
npm run clear:sales

# Or directly
node scripts/clear-sales.js
```

**What it does:**

- Deletes all transactions/sales from the database
- Keeps products, users, and other data intact
- Shows count of deleted transactions

### 2. Advanced Data Clearing

```bash
# Using npm script
npm run clear:data [options]

# Or directly
node scripts/clear-data.js [options]
```

**Options:**

- `--products` - Also clear all products
- `--expenses` - Also clear all expenses
- `--users` - Clear non-admin users (keeps admin users)
- `--store=store-id` - Clear data for specific store only

**Examples:**

```bash
# Clear only sales (default)
npm run clear:data

# Clear sales and products
npm run clear:data --products

# Clear everything except admin users
npm run clear:data --products --expenses

# Clear data for specific store
npm run clear:data --store=default-store

# Clear everything for a store
npm run clear:data --store=store123 --products --expenses
```

## Safety Features

- ✅ **Admin Protection**: `--users` option never deletes admin users
- ✅ **Confirmation**: Scripts show what will be deleted before proceeding
- ✅ **Count Display**: Shows exact number of records deleted
- ✅ **Error Handling**: Graceful error handling with clear messages
- ✅ **Connection Management**: Properly closes database connections

## Use Cases

### Development/Testing

```bash
# Clear test data after testing
npm run clear:sales
```

### Store Reset

```bash
# Reset a specific store completely
npm run clear:data --store=store123 --products --expenses
```

### Fresh Start

```bash
# Clear everything for a complete reset (keeps admin users)
npm run clear:data --products --expenses --users
```

## ⚠️ Important Notes

- **Backup First**: Always backup your data before running these scripts
- **Production Warning**: Be extremely careful when running these in production
- **Admin Users**: Admin users are never deleted by these scripts
- **Irreversible**: These operations cannot be undone

## Environment Requirements

- Node.js installed
- MongoDB connection configured in `.env`
- Database models compiled (`npm run build`)
