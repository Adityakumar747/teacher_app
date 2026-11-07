const StudentTransport = require('../models/StudentTransport');
const Student = require('../models/Student');
const TransportFeeCollection = require('../models/TransportFeeCollection');
const asyncHandler = require('../middleware/asyncHandler');

/** Get list of YYYY-MM months between start and end (inclusive). */
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

/** Build installments: { month?, installmentNumber, totalAmount, dueDate, paymentFrequency, quarterMonths?, periodMonths? }[] */
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

// @desc    Get all student transports for a school
// @route   GET /api/student-transports
// @access  Private
exports.getStudentTransports = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const transports = await StudentTransport.find({ schoolId })
    .populate({
      path: 'studentId',
      select: 'name rollNumber email phone classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('routeId', 'name routeNumber startPoint endPoint distance')
    .populate('vehicleId', 'vehicleNumber vehicleType capacity')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: transports.length,
    data: transports
  });
});

// @desc    Get transport fee collections for fee management
// @route   GET /api/student-transports/fee-collections
// @access  Private
exports.getTransportFeeCollections = asyncHandler(async (req, res) => {
  const { academicYear, schoolId } = req.query;
  if (!schoolId) {
    return res.status(400).json({ success: false, message: 'School ID is required' });
  }
  const query = { schoolId };
  if (academicYear) query.academicYear = academicYear;
  const collections = await TransportFeeCollection.find(query)
    .populate('studentId', 'name rollNumber admissionNumber classId')
    .populate('studentTransportId', 'routeId')
    .sort({ studentId: 1, dueDate: 1 });
  res.status(200).json({
    success: true,
    count: collections.length,
    data: collections
  });
});

// @desc    Generate transport fee installments and persist
// @route   POST /api/student-transports/generate-installments
// @access  Private
exports.generateTransportInstallments = asyncHandler(async (req, res) => {
  const {
    studentTransportId,
    studentId,
    academicYear,
    startDate,
    endDate,
    periodTotalAmount,
    paymentFrequency,
    customPeriodMonths,
    dueDay
  } = req.body;

  if (!studentTransportId || !studentId || !startDate || !endDate || periodTotalAmount == null) {
    return res.status(400).json({
      success: false,
      message: 'studentTransportId, studentId, startDate, endDate, and periodTotalAmount are required'
    });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    return res.status(400).json({
      success: false,
      message: 'Start date must be on or before end date. Please correct the dates.'
    });
  }

  const transport = await StudentTransport.findById(studentTransportId);
  if (!transport) {
    return res.status(404).json({ success: false, message: 'Student transport not found' });
  }
  const schoolId = transport.schoolId;

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

  // Remove existing transport fee collections for this studentTransport + academicYear so we don't duplicate
  await TransportFeeCollection.deleteMany({
    studentTransportId,
    academicYear: String(academicYear || new Date().getFullYear())
  });

  const created = [];
  for (const inst of installments) {
    const doc = await TransportFeeCollection.create({
      schoolId,
      studentId,
      studentTransportId,
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

// @desc    Get single student transport
// @route   GET /api/student-transports/:id
// @access  Private
exports.getStudentTransport = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id)
    .populate({
      path: 'studentId',
      select: 'name rollNumber email phone classId',
      populate: {
        path: 'classId',
        select: 'name section'
      }
    })
    .populate('routeId', 'name routeNumber startPoint endPoint')
    .populate('vehicleId', 'vehicleNumber vehicleType');
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: transport
  });
});

// @desc    Create new student transport
// @route   POST /api/student-transports
// @access  Private
exports.createStudentTransport = asyncHandler(async (req, res) => {
  const { studentId, routeId, schoolId } = req.body;
  
  // Check if student already has an active transport assignment
  const existingTransport = await StudentTransport.findOne({
    studentId,
    status: 'active'
  });
  
  if (existingTransport) {
    return res.status(400).json({
      success: false,
      message: 'Student already has an active transport assignment'
    });
  }
  
  // Verify student exists and belongs to the school
  const student = await Student.findOne({ _id: studentId, schoolId });
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found or does not belong to this school'
    });
  }
  
  const transport = await StudentTransport.create(req.body);
  
  const populatedTransport = await StudentTransport.findById(transport._id)
    .populate('studentId', 'name rollNumber email')
    .populate('routeId', 'name routeNumber')
    .populate('vehicleId', 'vehicleNumber vehicleType');
  
  res.status(201).json({
    success: true,
    message: 'Student transport assigned successfully',
    data: populatedTransport
  });
});

// @desc    Update student transport
// @route   PUT /api/student-transports/:id
// @access  Private
exports.updateStudentTransport = asyncHandler(async (req, res) => {
  let transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  transport = await StudentTransport.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    {
      new: true,
      runValidators: true
    }
  ).populate('studentId', 'name rollNumber email')
   .populate('routeId', 'name routeNumber')
   .populate('vehicleId', 'vehicleNumber vehicleType');
  
  res.status(200).json({
    success: true,
    message: 'Student transport updated successfully',
    data: transport
  });
});

// @desc    Delete student transport
// @route   DELETE /api/student-transports/:id
// @access  Private
exports.deleteStudentTransport = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  await transport.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Student transport assignment deleted successfully',
    data: {}
  });
});

// @desc    Get students by route
// @route   GET /api/student-transports/route/:routeId
// @access  Private
exports.getStudentsByRoute = asyncHandler(async (req, res) => {
  const students = await StudentTransport.getStudentsByRoute(req.params.routeId);
  
  res.status(200).json({
    success: true,
    count: students.length,
    data: students
  });
});

// @desc    Get active student transports
// @route   GET /api/student-transports/active
// @access  Private
exports.getActiveTransports = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const transports = await StudentTransport.getActiveTransports(schoolId);
  
  res.status(200).json({
    success: true,
    count: transports.length,
    data: transports
  });
});

// @desc    Add attendance record
// @route   POST /api/student-transports/:id/attendance
// @access  Private
exports.addAttendance = asyncHandler(async (req, res) => {
  const transport = await StudentTransport.findById(req.params.id);
  
  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }
  
  const { date, status, pickupTime, dropTime, remarks } = req.body;
  
  await transport.addAttendance(date, status, pickupTime, dropTime, remarks);
  
  res.status(200).json({
    success: true,
    message: 'Attendance record added successfully',
    data: transport
  });
});

// @desc    Bulk assign students to transport
// @route   POST /api/student-transports/bulk-assign
// @access  Private
exports.bulkAssignStudents = asyncHandler(async (req, res) => {
  const { students, routeId, vehicleId, pickupPoint, pickupTime, schoolId } = req.body;
  
  // Validate required fields
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Students array is required'
    });
  }
  
  if (!routeId) {
    return res.status(400).json({
      success: false,
      message: 'Route ID is required'
    });
  }
  
  if (!pickupPoint || !pickupPoint.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Pickup point is required'
    });
  }
  
  if (!pickupTime || !pickupTime.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Pickup time is required'
    });
  }
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  const createdTransports = [];
  const errors = [];
  
  for (const studentId of students) {
    try {
      // Verify student exists and belongs to the school
      const student = await Student.findOne({ _id: studentId, schoolId });
      if (!student) {
        errors.push({
          studentId,
          message: 'Student not found or does not belong to this school'
        });
        continue;
      }
      
      // Check if student already has active transport
      const existingTransport = await StudentTransport.findOne({
        studentId,
        status: 'active'
      });
      
      if (existingTransport) {
        errors.push({
          studentId,
          message: 'Already has active transport'
        });
        continue;
      }
      
      const transport = await StudentTransport.create({
        studentId,
        routeId,
        vehicleId: vehicleId || null,
        pickupPoint: pickupPoint.trim(),
        pickupTime: pickupTime.trim(),
        schoolId,
        status: 'active'
      });
      
      createdTransports.push(transport);
    } catch (error) {
      errors.push({
        studentId,
        message: error.message || 'Failed to assign transport'
      });
    }
  }
  
  res.status(201).json({
    success: true,
    message: `${createdTransports.length} students assigned successfully`,
    data: {
      created: createdTransports.length,
      errors: errors.length,
      errorDetails: errors
    }
  });
});

// @desc    Get unassigned students (students without transport)
// @route   GET /api/student-transports/unassigned
// @access  Private
exports.getUnassignedStudents = asyncHandler(async (req, res) => {
  const { schoolId } = req.query;
  
  if (!schoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID is required'
    });
  }
  
  // Get all students from the school
  const allStudents = await Student.find({ 
    schoolId, 
    status: 'active' 
  }).select('name rollNumber email classId').populate('classId', 'name section');
  
  // Get all students with active transport
  const assignedTransports = await StudentTransport.find({
    schoolId,
    status: 'active'
  }).select('studentId');
  
  const assignedStudentIds = assignedTransports.map(t => t.studentId.toString());
  
  // Filter out assigned students
  const unassignedStudents = allStudents.filter(
    student => !assignedStudentIds.includes(student._id.toString())
  );
  
  res.status(200).json({
    success: true,
    count: unassignedStudents.length,
    data: unassignedStudents
  });
});

// @desc    Update transport fee for a single booking
// @route   PUT /api/student-transports/:id/fee
// @access  Private
exports.updateTransportFee = asyncHandler(async (req, res) => {
  const { monthlyFee } = req.body;
  
  const transport = await StudentTransport.findByIdAndUpdate(
    req.params.id,
    { monthlyFee },
    { new: true, runValidators: true }
  );

  if (!transport) {
    return res.status(404).json({
      success: false,
      message: 'Student transport record not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Transport fee updated successfully',
    data: transport
  });
});

// @desc    Bulk update transport fees by route and pickup point
// @route   PUT /api/student-transports/bulk-update-fees
// @access  Private
exports.bulkUpdateTransportFees = asyncHandler(async (req, res) => {
  const { schoolId, feeUpdates } = req.body;

  if (!schoolId || !feeUpdates || !Array.isArray(feeUpdates)) {
    return res.status(400).json({
      success: false,
      message: 'School ID and feeUpdates array are required'
    });
  }

  const results = [];
  for (const update of feeUpdates) {
    const { routeId, pickupPoint, monthlyFee } = update;
    
    const result = await StudentTransport.updateMany(
      { schoolId, routeId, pickupPoint },
      { monthlyFee }
    );
    
    results.push({
      routeId,
      pickupPoint,
      updated: result.modifiedCount
    });
  }

  res.status(200).json({
    success: true,
    message: 'Transport fees updated successfully',
    data: { results }
  });
});
