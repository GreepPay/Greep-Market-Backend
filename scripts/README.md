# Setup Scripts

This directory contains scripts for setting up the application for production deployment.

## Scripts Overview

### 1. `setup-admin.js`

Simple script to create or update an admin user with the specified credentials.

**Usage:**

```bash
node scripts/setup-admin.js
```

**What it does:**

- Creates or updates admin user: `aguntawisdom@gmail.com`
- Sets password to: `qwerty1234`
- Sets role to: `admin`
- Assigns to default store

### 2. `setup-production.js`

Comprehensive production setup script with additional features.

**Usage:**

```bash
# Basic setup
node scripts/setup-production.js

# Custom credentials
node scripts/setup-production.js --email admin@example.com --password mypassword

# Help
node scripts/setup-production.js --help
```

**What it does:**

- Creates/updates admin user
- Creates sample data (if none exists)
- Verifies setup
- Displays comprehensive setup information

### 3. `setup-admin.sh`

Shell script wrapper for easy execution.

**Usage:**

```bash
# Make executable (first time only)
chmod +x scripts/setup-admin.sh

# Run setup
./scripts/setup-admin.sh
```

**What it does:**

- Checks Node.js and npm installation
- Installs dependencies if needed
- Builds the project
- Runs admin setup
- Displays credentials

## Production Deployment

### Quick Setup

For quick production deployment, use the shell script:

```bash
./scripts/setup-admin.sh
```

### Manual Setup

For more control, run the scripts manually:

```bash
# Install dependencies
npm install

# Build project
npm run build

# Setup admin user
node scripts/setup-admin.js
```

## Default Admin Credentials

After running any setup script, you can log in with:

- **Email:** `aguntawisdom@gmail.com`
- **Password:** `qwerty1234`
- **Role:** `admin`

## Security Notes

⚠️ **IMPORTANT:**

1. Change the admin password after first login
2. Ensure MongoDB connection is secure
3. Use HTTPS in production
4. Set up proper environment variables
5. Configure proper CORS settings

## Environment Variables

Make sure these environment variables are set:

```bash
MONGODB_URI=mongodb://your-mongodb-connection-string
JWT_SECRET=your-jwt-secret-key
NODE_ENV=production
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check if MongoDB is running
   - Verify MONGODB_URI environment variable
   - Ensure network connectivity

2. **Build Errors**
   - Run `npm install` to install dependencies
   - Check Node.js version compatibility
   - Clear node_modules and reinstall if needed

3. **Permission Errors**
   - Make sure scripts are executable: `chmod +x scripts/*.sh`
   - Check file permissions

### Logs

Check the application logs for detailed error information:

- Application logs: `logs/combined-*.log`
- Error logs: `logs/error-*.log`

## Support

If you encounter issues:

1. Check the logs for error details
2. Verify environment variables
3. Ensure all dependencies are installed
4. Check MongoDB connectivity
