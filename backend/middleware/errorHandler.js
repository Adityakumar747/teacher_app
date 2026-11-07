const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8082',
  'http://localhost:19006',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
];

const errorHandler = (err, req, res, next) => {
  // Ensure CORS headers strictly for whitelisted origins on error responses
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  }

  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || err.status;

  // Body parser entity too large
  if (err.type === 'entity.too.large') {
    error.statusCode = 413;
    error.message = 'Payload too large. Maximum size is 10MB.';
  }

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // CORS error
  if (err.message.includes('Not allowed by CORS')) {
    const message = 'CORS policy violation';
    error = { message, statusCode: 403 };
  }

  // Rate limit error
  if (err.message.includes('Too many requests')) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const message = 'File too large. Maximum size is 10MB.';
      error = { message, statusCode: 400 };
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      const message = 'Too many files uploaded';
      error = { message, statusCode: 400 };
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const message = 'Unexpected file field';
      error = { message, statusCode: 400 };
    } else {
      const message = err.message || 'File upload error';
      error = { message, statusCode: 400 };
    }
  }

  // File upload error (legacy)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = { message, statusCode: 413 };
  }

  // Cloudinary upload errors
  if (err.message && (err.message.includes('Cloudinary') || err.message.includes('cloudinary'))) {
    const message = 'Image upload failed. Please try again.';
    error = { message, statusCode: 500 };
  }

  // File type errors
  if (err.message === 'Only image files are allowed') {
    const message = err.message;
    error = { message, statusCode: 400 };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  const responseData = {
    success: false,
    error: message,
  };

  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_STACK === 'true') {
    responseData.stack = err.stack;
  }

  res.status(statusCode).json(responseData);
};

module.exports = errorHandler;
