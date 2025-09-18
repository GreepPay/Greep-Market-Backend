import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Application
  app: {
    name: 'Market Management System',
    version: process.env.API_VERSION || 'v1',
    port: parseInt(process.env.PORT || '3000'),
    env: process.env.NODE_ENV || 'development',
    url: process.env.APP_URL || 'http://localhost:3000',
  },

  // Database
  database: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/market_management',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '27017'),
    name: process.env.DB_NAME || 'market_management',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
    corsOrigin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || '50000'),
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ],
  },

  // AWS
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-west-2',
    s3Bucket: process.env.AWS_S3_BUCKET || 'market-management-files',
  },

  // Email
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Student Delivery System',
    fromEmail: process.env.FROM_EMAIL || '',
    secure: process.env.EMAIL_SECURE === 'true',
  },

  // Monitoring
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  },

  // External APIs
  external: {
    paymentGateway: {
      url: process.env.PAYMENT_GATEWAY_URL || '',
      key: process.env.PAYMENT_GATEWAY_KEY || '',
    },
  },

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Zepto Mail
  zeptoMail: {
    user: process.env.ZEPTO_MAIL_USER || '',
    password: process.env.ZEPTO_MAIL_PASSWORD || '',
  },


  // Frontend URL
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // VAPID Keys
  vapid: {
    publicKey: process.env.REACT_APP_VAPID_PUBLIC_KEY || '',
  },

  // Currency (Turkish Lira as default)
  currency: {
    default: 'TRY',
    symbol: '₺',
    decimals: 2,
  },
};

// Validation
export const validateConfig = (): boolean => {
  const required = [
    'JWT_SECRET',
    'MONGODB_URI',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    return false;
  }

  if (config.app.env === 'production') {
    const productionRequired = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'SMTP_USER',
      'SMTP_PASS',
    ];

    const productionMissing = productionRequired.filter(key => !process.env[key]);
    
    if (productionMissing.length > 0) {
      console.error('❌ Missing required production environment variables:', productionMissing);
      return false;
    }
  }

  console.log('✅ Configuration validation successful');
  return true;
};
