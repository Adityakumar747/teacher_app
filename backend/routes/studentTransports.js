const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getStudentTransports,
  getStudentTransport,
  createStudentTransport,
  updateStudentTransport,
  deleteStudentTransport,
  getStudentsByRoute,
  getActiveTransports,
  addAttendance,
  bulkAssignStudents,
  getUnassignedStudents,
  getTransportFeeCollections,
  generateTransportInstallments,
  updateTransportFee,
  bulkUpdateTransportFees
} = require('../controllers/studentTransportController');

// Apply authentication middleware to all routes
router.use(protect);

// Routes
router.route('/')
  .get(getStudentTransports)
  .post(createStudentTransport);

router.route('/active')
  .get(getActiveTransports);

router.route('/unassigned')
  .get(getUnassignedStudents);

router.route('/bulk-assign')
  .post(bulkAssignStudents);

router.route('/route/:routeId')
  .get(getStudentsByRoute);

// For-fees: student transports for fee management (same as list, before :id to avoid capturing)
router.route('/for-fees')
  .get(getStudentTransports);

router.route('/fee-collections')
  .get(getTransportFeeCollections);

router.route('/generate-installments')
  .get((req, res) => res.json({ message: 'Use POST with body to generate transport fee installments' }))
  .post(generateTransportInstallments);

// Restrict :id to MongoDB ObjectId to avoid capturing "for-fees", "fee-collections", etc.
router.route('/:id([a-fA-F0-9]{24})')
  .get(getStudentTransport)
  .put(updateStudentTransport)
  .delete(deleteStudentTransport);

router.route('/:id([a-fA-F0-9]{24})/attendance')
  .post(addAttendance);

router.route('/:id([a-fA-F0-9]{24})/fee')
  .put(updateTransportFee);

router.route('/bulk-update-fees')
  .put(bulkUpdateTransportFees);

module.exports = router;

