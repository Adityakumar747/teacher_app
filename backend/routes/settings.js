const express = require('express');
const { body } = require('express-validator');
const {
  getSchoolInfo,
  updateSchoolInfo,
  uploadSchoolLogo
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');
const { uploadSchoolLogo: uploadSchoolLogoMulter, handleUploadError } = require('../utils/cloudinary');

const router = express.Router();

// Validation for school-info update – matches school portal Settings form (all optional for partial update)
// Use optional({ checkFalsy: true }) so empty strings skip validation (avoids "Invalid value" for blank fields)
const updateSchoolInfoValidation = [
  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('School name must be between 2 and 200 characters'),
  body('address')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Address must be between 1 and 500 characters'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone cannot exceed 20 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('website')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Website cannot exceed 500 characters'),
  body('logo').optional({ checkFalsy: true }).trim(),
  body('principal.name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('principal.email')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Principal email must be valid'),
  body('principal.phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 })
];

// All settings routes require auth and school_admin
router.use(protect);
router.use(authorize('school_admin'));

// GET /api/settings/school-info – get current school (matches settingsAPI.getSchoolInfo())
router.get('/school-info', getSchoolInfo);

// PUT /api/settings/school-info – update current school (matches settingsAPI.updateSchoolInfo())
router.put('/school-info', updateSchoolInfoValidation, updateSchoolInfo);

// POST /api/settings/school-info/logo – upload logo (matches Settings.tsx fetch to school-info/logo)
router.post(
  '/school-info/logo',
  uploadSchoolLogoMulter.single('logo'),
  handleUploadError,
  uploadSchoolLogo
);

module.exports = router;
