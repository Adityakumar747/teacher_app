const express = require('express');
const {
  getSalaries,
  getSalary,
  createSalary,
  updateSalary,
  deleteSalary,
  markSalaryAsPaid,
  getSalaryStats,
  getSalaryStructures,
  getTeacherStructures,
  getDeductionSettings,
  updateDeductionSettings,
  generatePayroll
} = require('../controllers/salaryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Routes - allow school_admin and accountant (specific paths must come before /:id)
router.get('/stats/overview', authorize('school_admin', 'accountant'), getSalaryStats);
router.get('/structures', authorize('school_admin', 'accountant'), getSalaryStructures);
router.get('/teacher-structures', authorize('school_admin', 'accountant'), getTeacherStructures);
router.get('/deduction-settings', authorize('school_admin', 'accountant'), getDeductionSettings);
router.put('/deduction-settings', authorize('school_admin', 'accountant'), updateDeductionSettings);
router.post('/generate-payroll', authorize('school_admin', 'accountant'), generatePayroll);
router.get('/', authorize('school_admin', 'accountant'), getSalaries);
// Restrict :id to 24-char hex (MongoDB ObjectId) so paths like teacher-structures, deduction-settings don't match
router.get('/:id([a-fA-F0-9]{24})', authorize('school_admin', 'accountant'), getSalary);
router.post('/', authorize('school_admin', 'accountant'), createSalary);
router.put('/:id([a-fA-F0-9]{24})', authorize('school_admin', 'accountant'), updateSalary);
router.put('/:id([a-fA-F0-9]{24})/pay', authorize('school_admin', 'accountant'), markSalaryAsPaid);
router.delete('/:id([a-fA-F0-9]{24})', authorize('school_admin', 'accountant'), deleteSalary);

module.exports = router;

