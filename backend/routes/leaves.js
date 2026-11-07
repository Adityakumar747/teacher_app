const express = require('express');
const {
  getLeaves,
  applyLeave,
  getLeaveById,
  updateLeaveStatus,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All leave routes require authentication
router.use(protect);

// @route   GET /api/leaves
// @desc    Get leaves for authenticated teacher
// @access  Private (Teacher, School Admin)
router.get('/', authorize(['teacher', 'school_admin']), getLeaves);

// @route   POST /api/leaves
// @desc    Apply for leave
// @access  Private (Teacher)
router.post('/', authorize(['teacher', 'school_admin']), applyLeave);

// @route   GET /api/leaves/:id
// @desc    Get single leave
// @access  Private (Teacher, School Admin)
router.get('/:id', authorize(['teacher', 'school_admin']), getLeaveById);

// @route   PATCH /api/leaves/:id/status
// @desc    Approve / reject leave
// @access  Private (School Admin, Admin)
router.patch('/:id/status', authorize(['school_admin', 'admin']), updateLeaveStatus);

module.exports = router;
