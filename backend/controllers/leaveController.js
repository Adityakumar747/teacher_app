const mongoose = require('mongoose');
const TeacherLeave = require('../models/TeacherLeave');
const User = require('../models/User');

// @desc    Get leaves for the authenticated teacher
// @route   GET /api/leaves
// @access  Private (Teacher, School Admin)
const getLeaves = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const schoolId = req.user.schoolId;

    const query = { schoolId };
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
    }
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * pageSize;

    const total = await TeacherLeave.countDocuments(query);
    const leaves = await TeacherLeave.find(query)
      .populate('teacherId', 'name email phone avatar')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Calculate leave summary
    const allApprovedLeaves = await TeacherLeave.find({
      teacherId: req.user._id,
      schoolId,
      status: 'approved'
    });

    let casualUsed = 0;
    let sickUsed = 0;
    allApprovedLeaves.forEach(l => {
      const days = Math.max(1, Math.round((new Date(l.toDate) - new Date(l.fromDate)) / (1000 * 60 * 60 * 24)) + 1);
      if (l.leaveType === 'casual') casualUsed += days;
      if (l.leaveType === 'sick') sickUsed += days;
    });

    const pendingCount = await TeacherLeave.countDocuments({
      teacherId: req.user._id,
      schoolId,
      status: 'pending'
    });

    const summary = {
      casualTotal: 12,
      casualUsed,
      casualRemaining: Math.max(0, 12 - casualUsed),
      sickTotal: 8,
      sickUsed,
      sickRemaining: Math.max(0, 8 - sickUsed),
      pendingCount
    };

    res.status(200).json({
      success: true,
      count: leaves.length,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      summary,
      data: leaves,
    });
  } catch (error) {
    console.error('getLeaves error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching leaves: ' + error.message,
    });
  }
};

// @desc    Apply for teacher leave
// @route   POST /api/leaves
// @access  Private (Teacher)
const applyLeave = async (req, res) => {
  try {
    const { fromDate, toDate, reason, leaveType } = req.body;

    if (!fromDate || !toDate || !reason) {
      return res.status(400).json({
        success: false,
        error: 'fromDate, toDate, and reason are required',
      });
    }

    const normalizedLeaveType = (leaveType || 'casual').toLowerCase();
    if (!['casual', 'sick', 'other'].includes(normalizedLeaveType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid leaveType. Allowed values: 'casual', 'sick', 'other'",
      });
    }

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Please supply ISO date strings',
      });
    }

    if (fromDateObj > toDateObj) {
      return res.status(400).json({
        success: false,
        error: 'fromDate cannot be after toDate',
      });
    }

    // Ensure leave end date is not in the past
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const toDateStart = new Date(toDateObj);
    toDateStart.setHours(0, 0, 0, 0);

    if (toDateStart < todayStart) {
      return res.status(400).json({
        success: false,
        error: 'Cannot apply for leave in the past',
      });
    }

    // Check for overlapping leaves
    const overlappingLeave = await TeacherLeave.findOne({
      teacherId: req.user._id,
      status: { $in: ['pending', 'approved'] },
      fromDate: { $lte: toDateObj },
      toDate: { $gte: fromDateObj },
    });
    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending or approved leave application overlapping with this date range.',
      });
    }

    // Check leave quota
    const durationDays = Math.max(1, Math.round((toDateObj - fromDateObj) / (1000 * 60 * 60 * 24)) + 1);
    if (normalizedLeaveType === 'casual' || normalizedLeaveType === 'sick') {
      const approvedLeaves = await TeacherLeave.find({
        teacherId: req.user._id,
        schoolId: req.user.schoolId,
        status: 'approved',
        leaveType: normalizedLeaveType,
      });
      let usedDays = 0;
      approvedLeaves.forEach(l => {
        usedDays += Math.max(1, Math.round((new Date(l.toDate) - new Date(l.fromDate)) / (1000 * 60 * 60 * 24)) + 1);
      });
      const maxQuota = normalizedLeaveType === 'casual' ? 12 : 8;
      if (usedDays + durationDays > maxQuota) {
        return res.status(400).json({
          success: false,
          error: `Leave request of ${durationDays} days exceeds remaining ${normalizedLeaveType} leave quota (${Math.max(0, maxQuota - usedDays)} days remaining).`,
        });
      }
    }

    const newLeave = await TeacherLeave.create({
      teacherId: req.user._id,
      schoolId: req.user.schoolId,
      fromDate: fromDateObj,
      toDate: toDateObj,
      leaveType: normalizedLeaveType,
      reason: reason.trim(),
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: newLeave,
    });
  } catch (error) {
    console.error('applyLeave error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while applying for leave: ' + error.message,
    });
  }
};

// @desc    Get single leave by ID
// @route   GET /api/leaves/:id
// @access  Private (Teacher, School Admin)
const getLeaveById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid leave ID format',
      });
    }

    const leave = await TeacherLeave.findById(req.params.id)
      .populate('teacherId', 'name email phone avatar')
      .populate('approvedBy', 'name email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        error: 'Leave application not found',
      });
    }

    // Ownership restriction
    if (req.user.role === 'teacher' && leave.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only view your own leave applications',
      });
    }

    res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    console.error('getLeaveById error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching leave: ' + error.message,
    });
  }
};

// @desc    Update leave status (Approve / Reject)
// @route   PATCH /api/leaves/:id/status
// @access  Private (School Admin, Admin)
const updateLeaveStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid leave ID format',
      });
    }

    const { status, rejectionReason } = req.body;

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status must be 'approved', 'rejected', or 'pending'",
      });
    }

    const leave = await TeacherLeave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        error: 'Leave application not found',
      });
    }

    leave.status = status;
    if (status === 'rejected' && rejectionReason) {
      leave.rejectionReason = rejectionReason.trim();
    }
    if (status === 'approved') {
      leave.approvedBy = req.user._id;
      leave.approvedAt = new Date();
    }

    await leave.save();

    res.status(200).json({
      success: true,
      message: `Leave application status updated to ${status}`,
      data: leave,
    });
  } catch (error) {
    console.error('updateLeaveStatus error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating leave status: ' + error.message,
    });
  }
};

module.exports = {
  getLeaves,
  applyLeave,
  getLeaveById,
  updateLeaveStatus,
};
