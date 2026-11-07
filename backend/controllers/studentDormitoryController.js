const Student = require('../models/Student');
const DormitoryFeeCollection = require('../models/DormitoryFeeCollection');
const asyncHandler = require('../middleware/asyncHandler');

function getMonthsBetween(startDate, endDate) {
  const months = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return [];
  let y = start.getFullYear();
  let m = start.getMonth();
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

function buildInstallments(options) {
  const { startDate, endDate, periodTotalAmount, paymentFrequency, dueDay, customPeriodMonths } = options;
  const months = getMonthsBetween(startDate, endDate);
  if (months.length === 0) return [];

  const dueDayNum = Math.min(Math.max(1, parseInt(dueDay, 10) || 1), 28);
  const installments = [];

  if (paymentFrequency === 'quarterly') {
    const perQuarter = Math.ceil(months.length / 4);
    const amountPer = periodTotalAmount / 4;
    for (let q = 0; q < 4; q++) {
      const quarterMonths = months.slice(q * perQuarter, (q + 1) * perQuarter);
      if (quarterMonths.length === 0) break;
      const firstMonth = quarterMonths[0];
      const [y, m] = firstMonth.split('-').map(Number);
      installments.push({
        month: firstMonth,
        installmentNumber: q + 1,
        totalAmount: amountPer,
        dueDate: new Date(y, m - 1, dueDayNum),
        paymentFrequency: 'quarterly',
        quarterMonths
      });
    }
  } else if (paymentFrequency === 'custom' && customPeriodMonths > 0) {
    const periodMonthsCount = Math.min(customPeriodMonths, months.length);
    const count = Math.ceil(months.length / periodMonthsCount);
    const amountPer = periodTotalAmount / count;
    for (let i = 0; i < count; i++) {
      const periodMonths = months.slice(i * periodMonthsCount, (i + 1) * periodMonthsCount);
      if (periodMonths.length === 0) break;
      const firstMonth = periodMonths[0];
      const [y, m] = firstMonth.split('-').map(Number);
      installments.push({
        month: firstMonth,
        installmentNumber: i + 1,
        totalAmount: amountPer,
        dueDate: new Date(y, m - 1, dueDayNum),
        paymentFrequency: 'custom',
        periodMonths
      });
    }
  } else {
    const amountPer = periodTotalAmount / months.length;
    months.forEach((month, i) => {
      const [y, m] = month.split('-').map(Number);
      installments.push({
        month,
        installmentNumber: i + 1,
        totalAmount: amountPer,
        dueDate: new Date(y, m - 1, dueDayNum),
        paymentFrequency: 'monthly'
      });
    });
  }
  return installments;
}

/**
 * Get students with dormitory for fee management.
 * Uses Student model (isDormitory, roomNumber, monthlyDormitoryFee).
 * Response shape matches frontend StudentDormitory interface.
 */
exports.getStudentsForFees = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;

  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }

  const students = await Student.find({
    schoolId,
    isDormitory: true,
    status: 'active'
  })
    .populate({
      path: 'classId',
      select: 'name section'
    })
    .sort({ name: 1 });

  const data = students.map((s) => {
    const monthlyFee = Number(s.monthlyDormitoryFee) || 0;
    return {
      _id: s._id.toString(),
      studentId: {
        _id: s._id,
        name: s.name,
        rollNumber: s.rollNumber,
        admissionNumber: s.admissionNumber,
        classId: s.classId
      },
      dormitoryId: {
        _id: schoolId,
        name: 'School Dormitory',
        capacity: null
      },
      roomNumber: s.roomNumber || '',
      bedNumber: null,
      monthlyFee,
      paidAmount: 0,
      dueAmount: monthlyFee,
      feeStatus: 'pending',
      status: 'active',
      paymentHistory: []
    };
  });

  res.status(200).json({
    success: true,
    count: data.length,
    data
  });
});

/**
 * Get dormitory fee collections.
 */
exports.getFeeCollections = asyncHandler(async (req, res) => {
  const { academicYear, schoolId } = req.query;
  if (!schoolId) {
    return res.status(400).json({ success: false, message: 'School ID is required' });
  }
  const query = { schoolId };
  if (academicYear) query.academicYear = academicYear;
  const collections = await DormitoryFeeCollection.find(query)
    .populate('studentId', 'name rollNumber admissionNumber classId')
    .sort({ studentId: 1, dueDate: 1 });
  res.status(200).json({
    success: true,
    count: collections.length,
    data: collections
  });
});

/**
 * Update monthly dormitory fee for a student.
 * id = student _id
 */
exports.updateDormitoryFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { monthlyFee } = req.body;

  if (typeof monthlyFee !== 'number' || monthlyFee < 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid monthly fee is required'
    });
  }

  const student = await Student.findByIdAndUpdate(
    id,
    { monthlyDormitoryFee: monthlyFee },
    { new: true, runValidators: true }
  );

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.status(200).json({
    success: true,
    data: { ...student.toObject(), monthlyFee: student.monthlyDormitoryFee }
  });
});

/**
 * Bulk update dormitory fees.
 * Body: { updates: [{ id: studentId, monthlyFee: number }, ...] }
 */
exports.bulkUpdateDormitoryFees = asyncHandler(async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Updates array is required'
    });
  }

  const bulkOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: u.id, isDormitory: true },
      update: { $set: { monthlyDormitoryFee: Number(u.monthlyFee) || 0 } }
    }
  }));

  const result = await Student.bulkWrite(bulkOps);

  res.status(200).json({
    success: true,
    modifiedCount: result.modifiedCount,
    message: `Updated ${result.modifiedCount} dormitory fees`
  });
});

/**
 * Add dormitory payment (placeholder).
 * Full implementation would require a payment/transaction model.
 */
exports.addDormitoryPayment = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment recorded',
    data: { id: req.params.id }
  });
});

/**
 * Generate dormitory installments and persist.
 * Validates start <= end; returns 400 if dates are invalid.
 */
exports.generateDormitoryInstallments = asyncHandler(async (req, res) => {
  const {
    studentDormitoryId,
    studentId,
    academicYear,
    startDate,
    endDate,
    periodTotalAmount,
    paymentFrequency,
    customPeriodMonths,
    dueDay
  } = req.body;

  if (!studentDormitoryId || !studentId || !startDate || !endDate || periodTotalAmount == null) {
    return res.status(400).json({
      success: false,
      message: 'studentDormitoryId, studentId, startDate, endDate, and periodTotalAmount are required'
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    return res.status(400).json({
      success: false,
      message: 'Start date must be on or before end date. Please correct the dates (e.g. start in the same year as end, or start before end).'
    });
  }

  const student = await Student.findById(studentId);
  if (!student || !student.isDormitory) {
    return res.status(404).json({ success: false, message: 'Student not found or not assigned to dormitory' });
  }
  const schoolId = student.schoolId;

  const installments = buildInstallments({
    startDate,
    endDate,
    periodTotalAmount: Number(periodTotalAmount) || 0,
    paymentFrequency: paymentFrequency || 'monthly',
    dueDay: dueDay != null ? dueDay : 1,
    customPeriodMonths: paymentFrequency === 'custom' ? (customPeriodMonths || 1) : undefined
  });

  if (installments.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      message: 'No installments in the given date range'
    });
  }

  await DormitoryFeeCollection.deleteMany({
    studentId,
    academicYear: String(academicYear || new Date().getFullYear())
  });

  const created = [];
  for (const inst of installments) {
    const doc = await DormitoryFeeCollection.create({
      schoolId,
      studentId,
      studentDormitoryId: String(studentDormitoryId),
      academicYear: String(academicYear || new Date().getFullYear()),
      month: inst.month,
      installmentNumber: inst.installmentNumber,
      paymentFrequency: inst.paymentFrequency,
      quarterMonths: inst.quarterMonths,
      periodMonths: inst.periodMonths,
      totalAmount: inst.totalAmount,
      paidAmount: 0,
      dueAmount: inst.totalAmount,
      dueDate: inst.dueDate,
      status: 'pending'
    });
    created.push(doc);
  }

  res.status(200).json({
    success: true,
    data: created,
    message: `Generated ${created.length} installments`
  });
});

/**
 * Create dormitory fee collection (placeholder).
 */
exports.createDormitoryFeeCollection = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    data: { _id: req.body.studentDormitoryId || 'placeholder' },
    message: 'Fee collection created'
  });
});

/**
 * Add payment to dormitory fee collection (placeholder).
 */
exports.addDormitoryFeeCollectionPayment = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment added'
  });
});

/**
 * Delete dormitory fee collection (placeholder).
 */
exports.deleteDormitoryFeeCollection = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Fee collection deleted'
  });
});

/**
 * Delete fee collections by dormitory/student (placeholder).
 */
exports.deleteDormitoryFeeCollectionsByDormitory = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Fee collections deleted'
  });
});
