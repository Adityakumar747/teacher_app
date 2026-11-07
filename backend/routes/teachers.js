const express = require('express');
const { body } = require('express-validator');
const {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherProfile,
  getTeacherStats,
  getClassesToday,
  getMyClassStudents,
  getClassTeacherAnalytics,
  getClassStudentAttendanceBreakdown
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - Teachers can access their own profile and today's schedule
router.get('/me', authorize('teacher'), getTeacherProfile);
router.get('/profile', authorize('teacher'), getTeacherProfile);
router.get('/my-class/students', authorize('teacher'), getMyClassStudents);
router.get('/my-class/analytics', authorize('teacher'), getClassTeacherAnalytics);
router.get('/my-class/students/:studentId/attendance', authorize('teacher'), getClassStudentAttendanceBreakdown);
router.get('/:id/classes-today', authorize('teacher'), getClassesToday);

// Routes - School Admin only
router.get('/', authorize('school_admin'), getTeachers);
router.get('/stats', authorize('school_admin'), getTeacherStats);
router.get('/:id', authorize('school_admin'), getTeacherById);
router.post('/', authorize('school_admin'), createTeacher);
router.put('/:id', authorize('school_admin'), updateTeacher);
router.delete('/:id', authorize('school_admin'), deleteTeacher);

module.exports = router;
