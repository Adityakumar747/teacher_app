let cloudinary, CloudinaryStorage, multer;

try {
  cloudinary = require('cloudinary').v2;
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
  multer = require('multer');
} catch (error) {
  console.error('[Cloudinary] Load error:', error.message);
}

const fs = require('fs');
const path = require('path');

// Configure Cloudinary with extended timeout for large uploads
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_timeout: 600000,
  upload_timeout: 600000,
});

// --- STORAGE CONFIGURATIONS ---

const photoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: isVideo ? 'master-portal/facts/videos' : 'master-portal/facts/photos',
      allowed_formats: isVideo ? ['mp4', 'mov', 'avi', 'mkv', 'webm'] : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      resource_type: isVideo ? 'video' : 'image',
      timeout: 600000
    };
  },
});

const productImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'master-portal/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'image'
  },
});

const inventoryImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'school-portal/inventory',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'image'
  },
});

const studentAvatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'school-portal/students/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'image',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
    ]
  },
});

const coCurricularImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'master-portal/co-curricular-posts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'image'
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'master-portal/videos',
      allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
      resource_type: 'video',
      timeout: 600000,
    };
  },
});

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, 'student-' + uniqueSuffix + '-' + sanitizedBaseName + ext.toLowerCase());
  }
});

const schoolLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/school-logos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'logo-' + uniqueSuffix + ext.toLowerCase());
  }
});

// --- MULTER MIDDLEWARES ---

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image and video files are allowed'), false);
  }
});

const uploadProductImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

const uploadInventoryImages = multer({
  storage: inventoryImageStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

const uploadCoCurricularImages = multer({
  storage: coCurricularImageStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files are allowed'), false);
  }
});

const multerUploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, TXT, and Image files (JPG, PNG, WEBP) are allowed'), false);
  }
});

const uploadSyllabusFiles = multer({
  storage: documentStorage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only PDF, image, and video files are allowed'), false);
  }
});

const uploadSchoolLogo = multer({
  storage: schoolLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for logo'), false);
  }
});

// --- UTILITY FUNCTIONS ---

const uploadToCloudinary = {
  uploadPhoto: async (filePath, options = {}) => {
    try {
      return await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/photos',
        resource_type: 'image',
        transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }, { format: 'auto' }],
        ...options
      });
    } catch (error) {
      throw new Error(`Photo upload failed: ${error.message}`);
    }
  },

  uploadVideo: async (filePath, options = {}) => {
    try {
      return await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/videos',
        resource_type: 'video',
        timeout: 600000,
        ...options
      });
    } catch (error) {
      throw new Error(`Video upload failed: ${error.message}`);
    }
  },

  uploadDocumentToCloudinary: async (filePath, options = {}) => {
    try {
      return await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/documents',
        resource_type: 'raw',
        timeout: 600000,
        ...options
      });
    } catch (error) {
      throw new Error(`Document upload failed: ${error.message}`);
    }
  },

  uploadPdfFromBuffer: async (buffer, filename, options = {}) => {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'master-portal/documents', resource_type: 'raw', public_id: filename, format: 'pdf', timeout: 600000, ...options },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
    } catch (error) {
      throw new Error(`PDF upload failed: ${error.message}`);
    }
  },

  uploadStudentAvatar: async (buffer, studentId, options = {}) => {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'school-portal/students/avatars',
            public_id: `student-${studentId}-${Date.now()}`,
            resource_type: 'image',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            timeout: 60000,
            ...options
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
    } catch (error) {
      throw new Error(`Student avatar upload failed: ${error.message}`);
    }
  },

  deleteResource: async (publicId, resourceType = 'image') => {
    try {
      return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  },

  deleteDocument: async (publicId) => {
    try {
      return await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (error) {
      throw new Error(`Document delete failed: ${error.message}`);
    }
  },

  generateThumbnailUrl: (publicId, width = 300, height = 200) => {
    return cloudinary.url(publicId, { width, height, crop: 'pad', format: 'jpg', quality: 'auto' });
  },

  generateVideoThumbnailUrl: (publicId, time = '00:00:01') => {
    return cloudinary.url(publicId, { resource_type: 'video', start_offset: time, width: 300, height: 200, crop: 'pad', format: 'jpg', quality: 'auto' });
  },

  getVideoDuration: async (publicId) => {
    try {
      const result = await cloudinary.api.resource(publicId, { resource_type: 'video', image_metadata: true });
      return result.duration || 0;
    } catch (error) {
      return 0;
    }
  }
};

const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large. Please upload a smaller file.' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, message: 'Too many files.' });
  }
  if (error.message.includes('Only image')) return res.status(400).json({ success: false, message: error.message });
  if (error.message.includes('Only PDF')) return res.status(400).json({ success: false, message: error.message });
  next(error);
};

module.exports = {
  uploadSyllabusFiles,
  studentAvatarStorage,
  schoolLogoStorage,
  uploadSchoolLogo,
  cloudinary,
  uploadPhoto,
  uploadProductImage,
  uploadVideo,
  uploadDocument: multerUploadDocument,
  uploadCoCurricularImages,
  uploadToCloudinary: {
    ...uploadToCloudinary,
    uploadDocument: uploadToCloudinary.uploadDocumentToCloudinary
  },
  uploadInventoryImages,
  handleUploadError,
  uploadStudentAvatar: uploadToCloudinary.uploadStudentAvatar
};
