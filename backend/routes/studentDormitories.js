const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getStudentsForFees,
  getFeeCollections,
  updateDormitoryFee,
  bulkUpdateDormitoryFees,
  addDormitoryPayment,
  generateDormitoryInstallments,
  createDormitoryFeeCollection,
  addDormitoryFeeCollectionPayment,
  deleteDormitoryFeeCollection,
  deleteDormitoryFeeCollectionsByDormitory
} = require('../controllers/studentDormitoryController');

router.use(protect);

// Specific routes before :id
router.route('/for-fees').get(getStudentsForFees);
router.route('/bulk-update-fees').put(bulkUpdateDormitoryFees);
router.route('/generate-installments').post(generateDormitoryInstallments);
router.route('/fee-collections').get(getFeeCollections).post(createDormitoryFeeCollection);
router.route('/fee-collections/by-dormitory/:studentDormitoryId').delete(deleteDormitoryFeeCollectionsByDormitory);

// :id routes (ObjectId only)
router.route('/:id([a-fA-F0-9]{24})/fee').put(updateDormitoryFee);
router.route('/:id([a-fA-F0-9]{24})/payment').post(addDormitoryPayment);

router.route('/fee-collections/:id([a-fA-F0-9]{24})').delete(deleteDormitoryFeeCollection);
router.route('/fee-collections/:id([a-fA-F0-9]{24})/payment').post(addDormitoryFeeCollectionPayment);

module.exports = router;
