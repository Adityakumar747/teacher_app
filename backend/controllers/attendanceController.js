const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { getISTDateString, getDaysDifference, getISTDayOfWeek } = require('../utils/dateTimeUtils');

// Configurable attendance edit window (default 7 days)
const EDIT_WINDOW_DAYS = parseInt(process.env.ATTENDANCE_EDIT_WINDOW_DAYS || '7', 10);

// @desc    Mark attendance for students
// @route   POST /api/attendance
// @access  Private (Teacher)
const markAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId, classId, subjectId, date, status: rawStatus, remarks } = req.body;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId) ||
        !classId || !mongoose.Types.ObjectId.isValid(classId) ||
        !subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid studentId, classId, and subjectId are required'
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Valid date in YYYY-MM-DD format is required'
      });
    }

    let status = null;
    const st = (rawStatus || '').toUpperCase();
    if (st === 'P' || st === 'PRESENT') status = 'present';
    else if (st === 'A' || st === 'ABSENT') status = 'absent';
    else if (st === 'L' || st === 'LATE') status = 'late';
    else {
      return res.status(400).json({
        success: false,
        error: `Invalid attendance status "${rawStatus}". Allowed values: P, A, L (present, absent, late).`
      });
    }

    const schoolId = req.user.schoolId;
    const teacherId = req.user._id || req.user.id;

    // Verify the teacher is authorized to mark attendance for this class
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Verify the subject exists and teacher is assigned to it
    const subject = await Subject.findOne({ _id: subjectId, schoolId });
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    // S-09 Teacher Authorization: ensure teacher is assigned to this subject
    if (req.user.role === 'teacher' && subject.teacherId && subject.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not assigned to teach this subject'
      });
    }

    // Verify the student is in the class
    const student = await Student.findOne({ _id: studentId, classId, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found in this class'
      });
    }

    // Check if attendance already exists for this student on this date
    const existingAttendance = await Attendance.findOne({
      schoolId,
      studentId,
      classId,
      subjectId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      },
      isActive: true
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.remarks = remarks;
      existingAttendance.markedAt = new Date();
      await existingAttendance.save();

      return res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data: existingAttendance
      });
    } else {
      // Create new attendance record
      const attendance = await Attendance.create({
        schoolId,
        studentId,
        classId,
        subjectId,
        teacherId,
        date: new Date(date),
        status,
        remarks,
        markedBy: teacherId,
        academicYear: '2024-2025'
      });

      return res.status(201).json({
        success: true,
        message: 'Attendance marked successfully',
        data: attendance
      });
    }
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking attendance'
    });
  }
};

// @desc    Get attendance for a specific slot and date
// @route   GET /api/attendance/slot/:slotId?date=YYYY-MM-DD
// @access  Private (Teacher, School Admin)
const getSlotAttendance = async (req, res) => {
  try {
    const { slotId } = req.params;

    if (!slotId || !mongoose.Types.ObjectId.isValid(slotId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid slotId format'
      });
    }

    if (req.query.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD.'
      });
    }

    const targetDateStr = req.query.date ? String(req.query.date).trim() : getISTDateString();

    // 1. Fetch timetable slot
    const slot = await Schedule.findById(slotId)
      .populate('classId', 'name section room capacity')
      .populate('subjectId', 'name code');

    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Timetable slot not found'
      });
    }

    // 2. Authorization check: teacher may only access own assigned slots
    if (req.user.role === 'teacher' && slot.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view attendance for your own assigned slots.'
      });
    }

    // 3. Fetch active students of the slot's class
    const students = await Student.find({
      classId: slot.classId._id,
      status: 'active'
    }).sort({ rollNumber: 1, name: 1 }).select('name rollNumber admissionNumber avatar');

    // 4. Compute Date Rules & Edit Window Status
    const todayIST = getISTDateString();
    const daysInPast = getDaysDifference(targetDateStr, todayIST);
    const isFuture = targetDateStr > todayIST;
    const isLocked = daysInPast > EDIT_WINDOW_DAYS;
    const canEdit = !isLocked && !isFuture;

    let lockReason = null;
    if (isLocked) {
      lockReason = `This session is older than ${EDIT_WINDOW_DAYS} days and locked for modifications (read-only).`;
    } else if (isFuture) {
      lockReason = 'Future dates cannot be marked.';
    }

    // 5. Check for existing AttendanceSession
    const session = await AttendanceSession.findOne({
      slotId: slot._id,
      date: targetDateStr
    }).populate('audit.modifiedBy', 'name email');

    const marksMap = new Map();

    if (session) {
      const records = await AttendanceRecord.find({ sessionId: session._id });
      records.forEach(r => {
        marksMap.set(r.studentId.toString(), r.status);
      });
    } else {
      // Check legacy collection for backward compatibility
      const startOfDay = new Date(`${targetDateStr}T00:00:00+05:30`);
      const endOfDay = new Date(`${targetDateStr}T23:59:59+05:30`);
      const legacyRecords = await Attendance.find({
        classId: slot.classId._id,
        subjectId: slot.subjectId._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        isActive: true
      });
      legacyRecords.forEach(r => {
        marksMap.set(r.studentId.toString(), r.status === 'present' ? 'P' : r.status === 'late' ? 'L' : 'A');
      });
    }

    const className = slot.classId?.name && slot.classId?.section
      ? `${slot.classId.name} - ${slot.classId.section}`
      : slot.classId?.name || 'Class';

    res.status(200).json({
      success: true,
      data: {
        slot: {
          id: slot._id,
          slotId: slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          time: `${slot.startTime} - ${slot.endTime}`,
          room: slot.room || slot.classId?.room || 'TBD',
          dayOfWeek: slot.dayOfWeek,
          class: {
            id: slot.classId._id,
            name: className,
            room: slot.room || slot.classId?.room || 'TBD'
          },
          subject: {
            id: slot.subjectId._id,
            name: slot.subjectId.name,
            code: slot.subjectId.code
          }
        },
        date: targetDateStr,
        isSubmitted: !!session,
        isLocked,
        canEdit,
        lockReason,
        editWindowDays: EDIT_WINDOW_DAYS,
        session: session ? {
          id: session._id,
          submittedAt: session.submittedAt,
          lateMarked: session.lateMarked,
          summary: session.summary,
          audit: session.audit || []
        } : null,
        students: students.map(s => ({
          id: s._id,
          name: s.name,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          avatar: s.avatar,
          status: marksMap.get(s._id.toString()) || null
        }))
      }
    });
  } catch (error) {
    console.error('getSlotAttendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching slot attendance'
    });
  }
};

// @desc    Mark bulk attendance for multiple students
// @route   POST /api/attendance/bulk
// @access  Private (Teacher)
const markBulkAttendance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { slotId, date, records, attendanceRecords } = req.body;
    const teacherId = req.user.id || req.user._id;
    const schoolId = req.user.schoolId;

    // ============================================================
    // CONTRACT A: Modern Slot-based Bulk Attendance
    // ============================================================
    if (slotId) {
      if (!mongoose.Types.ObjectId.isValid(slotId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid slotId format'
        });
      }

      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Expected YYYY-MM-DD.'
        });
      }

      const targetDateStr = date ? String(date).trim() : getISTDateString();
      const todayIST = getISTDateString();

      // Rule 1: Future dates blocked
      if (targetDateStr > todayIST) {
        return res.status(400).json({
          success: false,
          error: 'Cannot mark attendance for future dates.'
        });
      }

      // Rule 2: 7-Day Edit Window
      const daysInPast = getDaysDifference(targetDateStr, todayIST);
      if (isNaN(daysInPast) || daysInPast > EDIT_WINDOW_DAYS) {
        return res.status(403).json({
          success: false,
          error: `Edit window closed or invalid date. Attendance for sessions older than ${EDIT_WINDOW_DAYS} days is locked and cannot be modified.`
        });
      }

      // 1. Verify Slot exists and belongs to this teacher
      const slot = await Schedule.findById(slotId);
      if (!slot) {
        return res.status(404).json({
          success: false,
          error: 'Timetable slot not found'
        });
      }

      if (req.user.role === 'teacher' && slot.teacherId.toString() !== teacherId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only mark attendance for your own assigned slots.'
        });
      }

      // Weekday check: Slot dayOfWeek must match the target date's day of week
      const targetDayOfWeek = getISTDayOfWeek(new Date(`${targetDateStr}T00:00:00+05:30`));
      if (slot.dayOfWeek && slot.dayOfWeek !== targetDayOfWeek) {
        return res.status(400).json({
          success: false,
          error: `Timetable slot is scheduled for ${slot.dayOfWeek}, but ${targetDateStr} is a ${targetDayOfWeek}.`
        });
      }

      // 2. Validate students belong to the slot's class and no duplicates
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Records array cannot be empty'
        });
      }

      const seenStudentIds = new Set();
      for (const r of records) {
        if (!r.studentId || !mongoose.Types.ObjectId.isValid(r.studentId)) {
          return res.status(400).json({
            success: false,
            error: `Invalid or missing studentId: ${r.studentId}`
          });
        }
        if (seenStudentIds.has(r.studentId.toString())) {
          return res.status(400).json({
            success: false,
            error: `Duplicate student ID found in submission: ${r.studentId}`
          });
        }
        seenStudentIds.add(r.studentId.toString());
      }

      const enrolledStudents = await Student.find({
        _id: { $in: Array.from(seenStudentIds) },
        classId: slot.classId
      }).select('name rollNumber');

      if (enrolledStudents.length !== records.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more students do not belong to this class'
        });
      }

      const studentMap = new Map();
      enrolledStudents.forEach(s => studentMap.set(s._id.toString(), s));

      // 3. Compute Summary Counts & Validate Status strictly
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      const normalizedRecords = [];
      for (const r of records) {
        const st = (r.status || '').toUpperCase();
        let normalizedStatus;
        if (st === 'P' || st === 'PRESENT') {
          normalizedStatus = 'P';
          presentCount++;
        } else if (st === 'L' || st === 'LATE') {
          normalizedStatus = 'L';
          lateCount++;
        } else if (st === 'A' || st === 'ABSENT') {
          normalizedStatus = 'A';
          absentCount++;
        } else {
          return res.status(400).json({
            success: false,
            error: `Invalid attendance status "${r.status}" for student ${r.studentId}. Allowed values: P, A, L.`
          });
        }

        normalizedRecords.push({
          studentId: r.studentId,
          status: normalizedStatus,
          remark: r.remark || ''
        });
      }

      const summary = {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        total: records.length
      };

      // 4. Audit & History Diff Tracking
      const existingSession = await AttendanceSession.findOne({
        slotId: slot._id,
        date: targetDateStr
      });

      const existingRecords = existingSession
        ? await AttendanceRecord.find({ sessionId: existingSession._id })
        : [];
      const existingMarksMap = new Map();
      existingRecords.forEach(r => existingMarksMap.set(r.studentId.toString(), r.status));

      const changeDetails = [];
      for (const r of normalizedRecords) {
        const prevStatus = existingMarksMap.get(r.studentId.toString());
        if (prevStatus && prevStatus !== r.status) {
          const s = studentMap.get(r.studentId.toString());
          changeDetails.push({
            studentId: r.studentId,
            studentName: s?.name || 'Student',
            rollNumber: s?.rollNumber || '',
            oldStatus: prevStatus,
            newStatus: r.status
          });
        }
      }

      const isLateMarked = existingSession
        ? existingSession.lateMarked
        : (targetDateStr < todayIST);

      let action = 'create';
      let changesText = '';

      if (existingSession) {
        if (changeDetails.length > 0) {
          action = 'edit';
          const sample = changeDetails.slice(0, 3).map(c =>
            `${c.studentName} (Roll ${c.rollNumber || 'N/A'}: ${c.oldStatus}->${c.newStatus})`
          ).join(', ');
          const extra = changeDetails.length > 3 ? ` and ${changeDetails.length - 3} more` : '';
          changesText = `Updated ${changeDetails.length} student(s): ${sample}${extra}`;
        } else {
          action = 'update';
          changesText = `Re-submitted attendance: ${presentCount}P / ${absentCount}A / ${lateCount}L (no status changes)`;
        }
      } else {
        action = 'create';
        changesText = `Initial submission: ${presentCount}P / ${absentCount}A / ${lateCount}L${isLateMarked ? ' (Late Marked)' : ''}`;
      }

      const auditEntry = {
        modifiedBy: req.user._id,
        modifiedByName: req.user.name || 'Teacher',
        modifiedAt: new Date(),
        action,
        changes: changesText,
        details: changeDetails
      };

      // 5. Atomic Upsert of AttendanceSession (Unique index: slotId + date)
      const updateDoc = {
        $set: {
          classId: slot.classId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          schoolId: slot.schoolId || schoolId,
          submittedAt: existingSession?.submittedAt || new Date(),
          lateMarked: isLateMarked,
          summary: summary
        }
      };

      // D-07: Only push audit entry if initial creation or if actual status changes occurred
      if (!existingSession || changeDetails.length > 0) {
        updateDoc.$push = { audit: auditEntry };
      }

      const session = await AttendanceSession.findOneAndUpdate(
        { slotId: slot._id, date: targetDateStr },
        updateDoc,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 6. Atomic bulkWrite on AttendanceRecord (Unique: sessionId + studentId)
      const bulkOps = normalizedRecords.map(r => ({
        updateOne: {
          filter: { sessionId: session._id, studentId: r.studentId },
          update: {
            $set: {
              status: r.status,
              remark: r.remark
            }
          },
          upsert: true
        }
      }));

      await AttendanceRecord.bulkWrite(bulkOps);

      // D-02: Recalculate summary strictly from all records in AttendanceRecord for this session
      const allSessionRecords = await AttendanceRecord.find({ sessionId: session._id });
      const actualSummary = {
        present: allSessionRecords.filter(r => r.status === 'P').length,
        absent: allSessionRecords.filter(r => r.status === 'A').length,
        late: allSessionRecords.filter(r => r.status === 'L').length,
        total: allSessionRecords.length
      };
      session.summary = actualSummary;
      await session.save();

      // 7. Sync to legacy Attendance collection for backward compatibility
      const legacyDate = new Date(`${targetDateStr}T09:00:00+05:30`);
      const legacyBulkOps = normalizedRecords.map(r => ({
        updateOne: {
          filter: {
            studentId: r.studentId,
            classId: slot.classId,
            subjectId: slot.subjectId,
            date: {
              $gte: new Date(`${targetDateStr}T00:00:00+05:30`),
              $lte: new Date(`${targetDateStr}T23:59:59+05:30`)
            }
          },
          update: {
            $set: {
              schoolId: slot.schoolId || schoolId,
              teacherId: slot.teacherId,
              date: legacyDate,
              status: r.status === 'P' ? 'present' : r.status === 'L' ? 'late' : 'absent',
              remarks: r.remark,
              markedBy: req.user._id,
              markedAt: new Date(),
              isActive: true,
              academicYear: '2024-2025'
            }
          },
          upsert: true
        }
      }));

      await Attendance.bulkWrite(legacyBulkOps);

      return res.status(200).json({
        success: true,
        message: existingSession ? 'Attendance updated successfully' : 'Attendance submitted successfully',
        data: {
          sessionId: session._id,
          slotId: slot._id,
          date: targetDateStr,
          isEdit: !!existingSession,
          changesCount: changeDetails.length,
          lateMarked: isLateMarked,
          summary: actualSummary,
          audit: session.audit || [auditEntry]
        }
      });
    }

    // ============================================================
    // CONTRACT B: Legacy flat array fallback
    // ============================================================
    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Attendance records array is required'
      });
    }

    const results = [];
    const failedRecords = [];

    for (const record of attendanceRecords) {
      try {
        const { studentId, classId, subjectId, date: rDate, status, remarks } = record;

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId) ||
            !classId || !mongoose.Types.ObjectId.isValid(classId) ||
            !subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
          failedRecords.push({ studentId, error: 'Invalid studentId, classId, or subjectId' });
          continue;
        }

        const classData = await Class.findOne({ _id: classId, schoolId });
        if (!classData) {
          failedRecords.push({ studentId, error: 'Class not found' });
          continue;
        }

        const subject = await Subject.findOne({ _id: subjectId, schoolId });
        if (!subject) {
          failedRecords.push({ studentId, error: 'Subject not found' });
          continue;
        }

        if (req.user.role === 'teacher' && subject.teacherId && subject.teacherId.toString() !== teacherId.toString()) {
          failedRecords.push({ studentId, error: 'Access denied: You are not assigned to teach this subject' });
          continue;
        }

        let normalizedStatus;
        const st = (status || '').toUpperCase();
        if (st === 'P' || st === 'PRESENT') normalizedStatus = 'present';
        else if (st === 'A' || st === 'ABSENT') normalizedStatus = 'absent';
        else if (st === 'L' || st === 'LATE') normalizedStatus = 'late';
        else {
          failedRecords.push({ studentId, error: `Invalid status "${status}". Allowed values: P, A, L.` });
          continue;
        }

        const student = await Student.findOne({ _id: studentId, classId, schoolId });
        if (!student) {
          failedRecords.push({ studentId, error: 'Student not found in this class' });
          continue;
        }

        const existingAttendance = await Attendance.findOne({
          schoolId,
          studentId,
          classId,
          subjectId,
          date: {
            $gte: new Date(rDate).setHours(0, 0, 0, 0),
            $lte: new Date(rDate).setHours(23, 59, 59, 999)
          },
          isActive: true
        });

        if (existingAttendance) {
          existingAttendance.status = normalizedStatus;
          existingAttendance.remarks = remarks;
          existingAttendance.markedAt = new Date();
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          const attendance = await Attendance.create({
            schoolId,
            studentId,
            classId,
            subjectId,
            teacherId,
            date: new Date(rDate),
            status: normalizedStatus,
            remarks,
            markedBy: teacherId,
            academicYear: '2024-2025'
          });
          results.push(attendance);
        }
      } catch (recordError) {
        failedRecords.push({ 
          studentId: record.studentId, 
          error: recordError.message 
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${results.length} students`,
      data: {
        successful: results,
        failed: failedRecords
      }
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking bulk attendance'
    });
  }
};

// @desc    Get attendance for a specific class and date (all subjects)
// @route   GET /api/attendance/class-date
// @access  Private (Teacher, School Admin)
const getClassDateAttendance = async (req, res) => {
  try {
    const { classId, date, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Class ID and Date are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid classId format'
      });
    }

    // S-09 Teacher Authorization
    if (req.user.role === 'teacher') {
      const isClassTeacher = await Class.exists({ _id: classId, teacherId: req.user._id, schoolId });
      const teachesSubjectInClass = await Subject.exists({ classId, teacherId: req.user._id, schoolId });
      if (!isClassTeacher && !teachesSubjectInClass) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not assigned to this class'
        });
      }
    }

    // Get all attendance records for the class and date
    const attendance = await Attendance.find({
      schoolId,
      classId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999)
      },
      academicYear,
      isActive: true
    })
    .populate('studentId', 'name rollNumber email')
    .populate('classId', 'name section')
    .populate('subjectId', 'name code')
    .populate('teacherId', 'name email')
    .populate('markedBy', 'name email')
    .sort({ 'studentId.rollNumber': 1, 'subjectId.name': 1 });

    // Filter out any attendance records with invalid student data
    const validAttendance = attendance.filter(record => {
      try {
        // Try to serialize the record to check for any JSON issues
        JSON.stringify(record);
        return true;
      } catch (err) {
        console.error('Invalid attendance record:', record._id, err.message);
        return false;
      }
    });

    res.status(200).json({
      success: true,
      count: validAttendance.length,
      data: validAttendance
    });
  } catch (error) {
    console.error('Get class date attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class attendance'
    });
  }
};

// @desc    Get attendance for a specific class and date
// @route   GET /api/attendance
// @access  Private (Teacher, School Admin)
const getAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Class ID, Subject ID, and Date are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid classId or subjectId format'
      });
    }

    // S-09 Teacher Authorization
    if (req.user.role === 'teacher') {
      const isSubjectTeacher = await Subject.exists({ _id: subjectId, teacherId: req.user._id, schoolId });
      const isClassTeacher = await Class.exists({ _id: classId, teacherId: req.user._id, schoolId });
      if (!isSubjectTeacher && !isClassTeacher) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not assigned to this subject or class'
        });
      }
    }

    const attendance = await Attendance.getAttendanceByClassAndDate(
      classId, 
      subjectId, 
      new Date(date), 
      academicYear
    );

    // Filter out any attendance records with invalid student data
    const validAttendance = attendance.filter(record => {
      try {
        // Try to serialize the record to check for any JSON issues
        JSON.stringify(record);
        return true;
      } catch (err) {
        console.error('Invalid attendance record:', record._id, err.message);
        return false;
      }
    });

    res.status(200).json({
      success: true,
      count: validAttendance.length,
      data: validAttendance
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching attendance'
    });
  }
};

// @desc    Get attendance statistics for a student
// @route   GET /api/attendance/student/:studentId
// @access  Private (Teacher, School Admin, Parent)
const getStudentAttendanceStats = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid studentId format'
      });
    }

    // Verify student exists and user has access
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // S-09 Teacher Authorization: ensure teacher teaches this student's class
    if (req.user.role === 'teacher') {
      const teacherClassIds = await Subject.distinct('classId', { teacherId: req.user._id, schoolId });
      const classTeacherClassIds = await Class.find({ teacherId: req.user._id, schoolId }).distinct('_id');
      const allowedClassIds = [...teacherClassIds, ...classTeacherClassIds].map(id => id.toString());
      if (!student.classId || !allowedClassIds.includes(student.classId.toString())) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not teach this student'
        });
      }
    }

    const stats = await Attendance.getStudentAttendanceStats(studentId, academicYear);
    
    // Calculate totals and percentages
    const totalClasses = stats.reduce((sum, stat) => sum + stat.count, 0);
    const presentCount = stats.find(s => s._id === 'present')?.count || 0;
    const absentCount = stats.find(s => s._id === 'absent')?.count || 0;
    const lateCount = stats.find(s => s._id === 'late')?.count || 0;
    const excusedCount = stats.find(s => s._id === 'excused')?.count || 0;
    
    const attendancePercentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.classId
        },
        statistics: {
          totalClasses,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100
        },
        breakdown: stats
      }
    });
  } catch (error) {
    console.error('Get student attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching student attendance statistics'
    });
  }
};

// @desc    Get attendance statistics for a class
// @route   GET /api/attendance/class/:classId
// @access  Private (Teacher, School Admin)
const getClassAttendanceStats = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear = '2024-2025' } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid classId format'
      });
    }

    // Verify class exists and user has access
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // S-09 Teacher Authorization: ensure teacher teaches this class
    if (req.user.role === 'teacher') {
      const isClassTeacher = await Class.exists({ _id: classId, teacherId: req.user._id, schoolId });
      const teachesSubjectInClass = await Subject.exists({ classId, teacherId: req.user._id, schoolId });
      if (!isClassTeacher && !teachesSubjectInClass) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not assigned to this class'
        });
      }
    }

    const stats = await Attendance.getClassAttendanceStats(classId, academicYear);

    res.status(200).json({
      success: true,
      data: {
        class: {
          id: classData._id,
          name: classData.name,
          section: classData.section
        },
        statistics: stats,
        summary: {
          totalStudents: stats.length,
          averageAttendance: stats.length > 0 
            ? Math.round((stats.reduce((sum, s) => sum + s.attendancePercentage, 0) / stats.length) * 100) / 100 
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Get class attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching class attendance statistics'
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Private (Teacher, School Admin)
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const schoolId = req.user.schoolId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid attendance ID format'
      });
    }

    const attendance = await Attendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }

    // S-09 Teacher ownership check
    if (req.user.role === 'teacher' && attendance.teacherId && attendance.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only update your own attendance records'
      });
    }

    let normalizedStatus;
    const st = (status || '').toUpperCase();
    if (st === 'P' || st === 'PRESENT') normalizedStatus = 'present';
    else if (st === 'A' || st === 'ABSENT') normalizedStatus = 'absent';
    else if (st === 'L' || st === 'LATE') normalizedStatus = 'late';
    else {
      return res.status(400).json({
        success: false,
        error: `Invalid status "${status}". Allowed values: P, A, L.`
      });
    }

    attendance.status = normalizedStatus;
    attendance.remarks = remarks;
    attendance.markedAt = new Date();
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating attendance'
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (School Admin)
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid attendance ID format'
      });
    }

    const attendance = await Attendance.findOne({ _id: id, schoolId, isActive: true });
    if (!attendance) {
      return res.status(404).json({
        success: false,
        error: 'Attendance record not found'
      });
    }

    attendance.isActive = false;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting attendance'
    });
  }
};

// @desc    Get attendance history (past sessions for teacher's own classes/subjects)
// @route   GET /api/attendance/history
// @access  Private (Teacher, School Admin)
const getAttendanceHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    // Authorization: Teachers can ONLY view their own attendance history
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
    } else if (req.query.teacherId) {
      query.teacherId = req.query.teacherId;
    }

    if (req.user.schoolId) {
      query.schoolId = req.user.schoolId;
    }

    if (req.query.classId) {
      query.classId = req.query.classId;
    }

    if (req.query.subjectId) {
      query.subjectId = req.query.subjectId;
    }

    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = req.query.startDate;
      if (req.query.endDate) query.date.$lte = req.query.endDate;
    }

    const todayIST = getISTDateString();

    const [total, sessions] = await Promise.all([
      AttendanceSession.countDocuments(query),
      AttendanceSession.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('classId', 'name section room grade')
        .populate('subjectId', 'name code')
        .populate('slotId', 'startTime endTime room dayOfWeek')
        .populate('audit.modifiedBy', 'name email')
        .lean()
    ]);

    const formattedSessions = sessions.map(s => {
      const daysInPast = getDaysDifference(s.date, todayIST);
      const isLocked = daysInPast > EDIT_WINDOW_DAYS;
      return {
        id: s._id,
        slotId: s.slotId?._id || s.slotId,
        date: s.date,
        class: {
          id: s.classId?._id,
          name: s.classId?.name && s.classId?.section ? `${s.classId.name} - ${s.classId.section}` : s.classId?.name || 'Class',
          section: s.classId?.section,
          grade: s.classId?.grade,
          room: s.classId?.room
        },
        subject: {
          id: s.subjectId?._id,
          name: s.subjectId?.name || 'Subject',
          code: s.subjectId?.code || ''
        },
        slot: s.slotId ? {
          startTime: s.slotId.startTime,
          endTime: s.slotId.endTime,
          room: s.slotId.room,
          time: `${s.slotId.startTime} - ${s.slotId.endTime}`
        } : null,
        summary: s.summary || { present: 0, absent: 0, late: 0, total: 0 },
        lateMarked: Boolean(s.lateMarked),
        submittedAt: s.submittedAt,
        isLocked,
        canEdit: !isLocked,
        editWindowDays: EDIT_WINDOW_DAYS,
        auditCount: Array.isArray(s.audit) ? s.audit.length : 0,
        audit: s.audit || []
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('getAttendanceHistory error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching attendance history'
    });
  }
};

module.exports = {
  markAttendance,
  markBulkAttendance,
  getSlotAttendance,
  getAttendanceHistory,
  getAttendance,
  getClassDateAttendance,
  getStudentAttendanceStats,
  getClassAttendanceStats,
  updateAttendance,
  deleteAttendance
};

