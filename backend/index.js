const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
if (fs.existsSync('./config.env')) {
  dotenv.config({ path: './config.env' });
} else {
  dotenv.config();
}

// Validate JWT Secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL SECURITY] In production, JWT_SECRET must be set to a secure, uncommitted secret (>= 32 chars).');
    process.exit(1);
  } else {
    // Generate secure random secret for dev if placeholder detected
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
      const crypto = require('crypto');
      process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
      console.log('[SECURITY] Generated secure high-entropy JWT_SECRET for local runtime environment.');
    }
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/schools');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const productRoutes = require('./routes/products');
const schoolProductRoutes = require('./routes/schoolProducts');
const billingRoutes = require('./routes/billing');
const adRoutes = require('./routes/ads');
const photoRoutes = require('./routes/photos');
const promoCodeRoutes = require('./routes/promoCodes');
const teacherRoutes = require('./routes/teachers');
const classRoutes = require('./routes/classes');
const subjectRoutes = require('./routes/subjects');
const syllabusRoutes = require('./routes/syllabus');
const studentRoutes = require('./routes/students');
const parentRoutes = require('./routes/parents');
const admissionsRoutes = require('./routes/admissions');
const announcementsRoutes = require('./routes/announcements');
const inventoryRoutes = require('./routes/inventory');
const scheduleRoutes = require('./routes/schedules');
const teacherAttendanceRoutes = require('./routes/teacherAttendance');
const attendanceRoutes = require('./routes/attendance');
const messageRoutes = require('./routes/messages');
const assignmentRoutes = require('./routes/assignments');
const notificationRoutes = require('./routes/notifications');
const subjectCourseRoutes = require('./routes/subjectCourses');
const transportRouteRoutes = require('./routes/transportRoutes');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const studentTransportRoutes = require('./routes/studentTransports');
const studentDormitoryRoutes = require('./routes/studentDormitories');
const examRoutes = require('./routes/exams');
const invoiceRoutes = require('./routes/invoices');
const salaryRoutes = require('./routes/salaries');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const quizRoutes = require('./routes/quizzes');
const adminQuizRoutes = require('./routes/adminQuizzes');
const doubtRoutes = require('./routes/doubts');
const meetingRoutes = require('./routes/meetings');
const bookRoutes = require('./routes/books');
const bookBorrowingRoutes = require('./routes/bookBorrowings');
const coCurricularRoutes = require('./routes/coCurricular');
const idCardRoutes = require('./routes/idCards');
const houseRoutes = require('./routes/houses');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { verifyToken } = require('./middleware/auth');

// Import socket handlers
const socketHandler = require('./socket/socketHandler');

// Import setSocketIO functions from controllers
const { setSocketIO: setMessageSocketIO } = require('./controllers/messageController');
const { setSocketIO: setAssignmentSocketIO } = require('./controllers/assignmentController');
const { setSocketIO: setNoteSocketIO } = require('./controllers/noteController');
const { setSocketIO: setQuizSocketIO } = require('./controllers/quizController');

// Allowed origins whitelist for CORS
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
  'http://192.168.29.130:8081',
  'http://192.168.29.130:8082',
  'http://192.168.29.130:19006',
  'http://192.168.29.130:5000',
  'http://192.168.1.11:8081',
  'http://192.168.1.11:5000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [])
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
  }
  return false;
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Ensure uploads directories exist at startup
const uploadsPath = path.join(__dirname, 'uploads');
const documentsPath = path.join(__dirname, 'uploads', 'documents');
const avatarsPath = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('[System] Created uploads folder');
}
if (!fs.existsSync(documentsPath)) {
  fs.mkdirSync(documentsPath, { recursive: true });
  console.log('[System] Created uploads/documents folder');
}
if (!fs.existsSync(avatarsPath)) {
  fs.mkdirSync(avatarsPath, { recursive: true });
  console.log('[System] Created uploads/avatars folder');
}

// ============================================
// CRITICAL: CORS MUST BE FIRST
// ============================================
// CORS configuration - Restrict to explicit whitelist
const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// Apply CORS FIRST - before any other middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests
app.options('*', cors(corsOptions));

// Enforce CORS headers strictly for whitelisted origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Auth-Token, Access-Control-Request-Method, Access-Control-Request-Headers');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    if (isAllowedOrigin(origin)) {
      return res.status(200).end();
    } else {
      return res.status(403).json({ error: 'Origin not allowed by CORS' });
    }
  }

  next();
});

// ============================================
// Security middleware - AFTER CORS
// ============================================
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());

// Serve static files (uploaded documents, avatars, etc.) with security headers
const uploadsStaticPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsStaticPath, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login attempts per 15 minutes per IP
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000', 10), // generous limit for active mobile usage
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip uploads and static files to ensure large transfers don't hit limits
    return req.originalUrl.includes('/upload') || req.originalUrl.includes('/uploads');
  },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/firebase-login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/', generalLimiter);

// Body parsing middleware - General JSON body size limited to 10mb
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize request data against NoSQL query injection
app.use(mongoSanitize());

// Increase server timeout for large file uploads
app.use((req, res, next) => {
  // Set timeout to 30 minutes for file uploads
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  next();
});

// Handle large file uploads (photos and videos for fact of the day)
app.use('/api/photos/upload', (req, res, next) => {
  // Increase limit for photo/video uploads - videos can be large
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours for large video uploads
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

app.use('/api/courses/*/videos/upload', (req, res, next) => {
  // Increase limit for video uploads - 2 hours for very large files
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

app.use('/api/subject-courses/*/videos/upload', (req, res, next) => {
  // Increase limit for video uploads - 2 hours for very large files
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Root endpoint for health checks (handles both GET and HEAD)
app.all('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Master Portal Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173,http://localhost:4000'],
    timestamp: new Date().toISOString(),
  });
});

// Swagger Documentation & Interactive UI
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/school-products', schoolProductRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/id-cards', idCardRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/teacher-attendance', teacherAttendanceRoutes);
app.use('/api/important-dates', require('./routes/importantDates'));
app.use('/api/calendar', require('./routes/importantDates'));
app.use('/api/messages', messageRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/admissions', admissionsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/homework', assignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/groups', require('./routes/groups'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/meetings', meetingRoutes);
app.use('/api/subject-courses', subjectCourseRoutes);
app.use('/api/transport-routes', transportRouteRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/student-transports', studentTransportRoutes);
app.use('/api/student-dormitories', studentDormitoryRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin-quizzes', adminQuizRoutes);
app.use('/api/student-quiz-battle', require('./routes/studentQuizBattle'));
app.use('/api/doubts', doubtRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/book-borrowings', bookBorrowingRoutes);
app.use('/api/co-curricular', coCurricularRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/leaves', require('./routes/leaves')); // Teacher leave management

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('❌ WebSocket Auth: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = verifyToken(token);
    console.log('🔐 WebSocket Auth: Token decoded:', {
      id: decoded.id,
      role: decoded.role,
      schoolId: decoded.schoolId,
      email: decoded.email
    });

    // Debug: Check if the ID is a valid ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.log('❌ WebSocket Auth: Invalid ObjectId in token:', decoded.id);
      return next(new Error('Authentication error: Invalid user ID in token'));
    }

    const User = require('./models/User');
    const Student = require('./models/Student');

    let user;
    console.log('🔍 WebSocket Auth: Looking up user with role:', decoded.role, 'and ID:', decoded.id);

    if (decoded.role === 'student') {
      console.log('🔍 WebSocket Auth: Looking in Student model...');
      user = await Student.findById(decoded.id).select('-password');
      if (user) {
        user.role = 'student';
        console.log('✅ WebSocket Auth: Student found:', user.name);
      } else {
        console.log('❌ WebSocket Auth: Student not found with ID:', decoded.id);
      }
    } else if (decoded.role === 'parent') {
      // For parent role, find the parent record directly
      console.log('🔍 WebSocket Auth: Looking in Parent model...');
      const Parent = require('./models/Parent');
      user = await Parent.findById(decoded.id).select('-password');
      if (user) {
        console.log('✅ WebSocket Auth: Parent found:', user.name, user.email);
        user.role = 'parent';
        // Parent record already has the correct data
      } else {
        console.log('❌ WebSocket Auth: Parent not found with ID:', decoded.id);
      }
    } else if (decoded.role) {
      // If role is specified, look in the appropriate model
      console.log('🔍 WebSocket Auth: Looking in User model for role:', decoded.role);
      user = await User.findById(decoded.id).select('-password');
      if (user) {
        console.log('✅ WebSocket Auth: User found:', user.name);
      } else {
        console.log('❌ WebSocket Auth: User not found with ID:', decoded.id);
      }
    } else {
      // If no role in token, check both models (backward compatibility)
      console.log('🔍 WebSocket Auth: No role specified, checking both models...');
      user = await User.findById(decoded.id).select('-password');
      if (!user) {
        console.log('🔍 WebSocket Auth: Not found in User model, checking Student model...');
        user = await Student.findById(decoded.id).select('-password');
        if (user) {
          user.role = 'student';
          console.log('✅ WebSocket Auth: Student found (backward compatibility):', user.name);
        } else {
          console.log('❌ WebSocket Auth: Not found in either model with ID:', decoded.id);
        }
      } else {
        console.log('✅ WebSocket Auth: User found (backward compatibility):', user.name);
      }
    }

    if (!user) {
      console.log('❌ WebSocket Auth: User not found in database for ID:', decoded.id);
      return next(new Error('Authentication error: User not found'));
    }

    console.log('✅ WebSocket Auth: User found:', {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
      email: user.email,
      isActive: user.isActive,
      isLocked: user.isLocked
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ WebSocket Auth: User account is deactivated');
      return next(new Error('Authentication error: User account is deactivated'));
    }

    // Check if user is locked
    if (user.isLocked) {
      console.log('❌ WebSocket Auth: User account is locked');
      return next(new Error('Authentication error: User account is locked'));
    }

    socket.userId = user._id;
    socket.userRole = user.role;
    socket.schoolId = user.schoolId;
    socket.user = user;

    console.log('✅ WebSocket Auth: Authentication successful for user:', user.name);
    next();
  } catch (error) {
    console.log('❌ WebSocket Auth: Authentication failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Set global.io for use in controllers
global.io = io;

// Inject WebSocket instance into controllers
console.log('[Main Server] Injecting SocketIO into controllers...');
setMessageSocketIO(io);
setAssignmentSocketIO(io);
setNoteSocketIO(io);
setQuizSocketIO(io);
console.log('[Main Server] SocketIO injection completed');

// WebSocket connection handling
io.on('connection', (socket) => {
  socketHandler(io, socket);
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';

    await mongoose.connect(mongoURI);
    console.log('[Database] MongoDB connected successfully');

    // Default admin auto-creation removed for production security.
    // Use manual administration scripts (e.g. node scripts/createAdmin.js) if initial setup is needed.

  } catch (error) {
    console.error('[Database] MongoDB connection error:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n[Database] MongoDB Connection Issue:');
      console.log('   MongoDB is not running on your system.');
      console.log('\nQuick Solutions:');
      console.log('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
      console.log('   2. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
      console.log('   3. Or use Docker: docker run -d -p 27017:27017 mongo');
      console.log('\nAfter installing MongoDB, run: npm run dev');
      console.log('   Or create admin user manually: node scripts/createAdmin.js');
    }

    console.log('\nServer will continue running but database features will be unavailable.');
    console.log('   Fix MongoDB connection and restart the server.');
  }
};


// Start server
const startServer = async () => {
  // Try to connect to database (non-blocking)
  connectDB();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
    console.log(`Swagger Docs: http://localhost:${PORT}/api-docs`);
    console.log(`WebSocket Server: ws://localhost:${PORT}`);
    // [DISABLED FOR NOW] Master admin credentials disabled during Teacher module development
    // console.log(`\nDefault Admin Credentials:`);
    // console.log(`   Email: admin@masterportal.com`);
    // console.log(`   Password: admin123`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Error] Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Error] Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[System] SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('[Database] MongoDB connection closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;
