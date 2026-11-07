const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadStudentAvatar } = require('../utils/cloudinary');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Upload student avatar
router.post('/student-avatar',
    protect,
    authorize('school_admin', 'admin'),
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const studentId = req.body.studentId || Date.now();
            const result = await uploadStudentAvatar(req.file.buffer, studentId);

            res.status(200).json({
                success: true,
                data: {
                    url: result.secure_url,
                    public_id: result.public_id
                }
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Upload failed'
            });
        }
    }
);

// @desc    Generate Cloudinary signed upload parameters
// @route   POST /api/upload/sign or /api/uploads/sign
// @access  Private
router.post('/sign', protect, (req, res) => {
    try {
        const { folder = 'sparkology/homework', fileType } = req.body || {};
        const allowedFolders = ['sparkology/homework', 'sparkology/documents', 'sparkology/avatars', 'sparkology/notes'];
        const safeFolder = allowedFolders.includes(folder) ? folder : 'sparkology/homework';
        
        // Allowed file types: pdf, png, jpg, jpeg, doc, docx
        const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'webp'];
        if (fileType) {
            const cleanExt = fileType.toLowerCase().replace(/^\./, '');
            if (!allowedExtensions.includes(cleanExt)) {
                return res.status(400).json({
                    success: false,
                    error: `File type .${cleanExt} is not supported. Allowed formats: ${allowedExtensions.join(', ')}`
                });
            }
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        // Check whether actual Cloudinary credentials are configured
        const isConfigured = Boolean(
            cloudName &&
            apiKey &&
            apiSecret &&
            !apiKey.includes('placeholder') &&
            !apiSecret.includes('placeholder') &&
            apiSecret !== 'your_api_secret'
        );

        let signature = '';
        if (isConfigured) {
            const { cloudinary } = require('../utils/cloudinary');
            if (cloudinary && cloudinary.utils && typeof cloudinary.utils.api_sign_request === 'function') {
                const paramsToSign = {
                    folder: safeFolder,
                    timestamp
                };
                signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
            }
        }

        if (!signature) {
            const crypto = require('crypto');
            signature = crypto.createHash('sha1')
                .update(`folder=${safeFolder}&timestamp=${timestamp}sparkology_dev_secret`)
                .digest('hex');
        }

        return res.status(200).json({
            success: true,
            data: {
                timestamp,
                folder: safeFolder,
                signature,
                apiKey: apiKey || 'dev_api_key',
                cloudName: cloudName || 'sparkology_dev',
                uploadUrl: isConfigured ? `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload` : null,
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedExtensions,
                isConfigured
            }
        });
    } catch (error) {
        console.error('Sign upload error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate upload signature: ' + error.message
        });
    }
});

// Configure multer for local file fallback
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const path = require('path');
        const fs = require('fs');
        const uploadPath = path.join(__dirname, '../uploads/documents');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const path = require('path');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, 'doc-' + uniqueSuffix + '-' + baseName + ext.toLowerCase());
    }
});

const uploadDocumentMulter = multer({
    storage: diskStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'];
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        const path = require('path');
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext) && file.mimetype !== 'image/svg+xml') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PNG, JPG, WEBP.'));
        }
    }
});

// @desc    Direct fallback file upload (PDF/Images/Docs up to 10MB)
// @route   POST /api/upload/file or /api/uploads/file
// @access  Private
router.post('/file', protect, uploadDocumentMulter.single('file'), (req, res) => {
    try {
        if (!req.file || req.file.size === 0) {
            return res.status(400).json({
                success: false,
                error: 'No file or empty 0-byte file provided'
            });
        }

        const fileUrl = `/uploads/documents/${req.file.filename}`;
        const isImage = req.file.mimetype.startsWith('image/');
        
        return res.status(200).json({
            success: true,
            data: {
                name: req.file.originalname,
                url: fileUrl,
                type: isImage ? 'image' : 'pdf',
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('Direct file upload error:', error);
        return res.status(500).json({
            success: false,
            error: 'File upload failed: ' + error.message
        });
    }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }

    if (error.message === 'Only image files are allowed') {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }

    next(error);
});

module.exports = router;
