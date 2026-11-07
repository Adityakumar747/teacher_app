const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Schedule = require('../models/Schedule');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const { uploadDocument, uploadToCloudinary, handleUploadError } = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');

// WebSocket instance (will be injected)
let io = null;

// Function to set WebSocket instance
const setSocketIO = (socketIO) => {
  io = socketIO;
  console.log('🔌 Assignment Controller: SocketIO instance set:', !!io);
};

// @desc    Get all assignments for a teacher
// @route   GET /api/assignments
// @access  Private (Teacher, School Admin)
const getAssignments = async (req, res) => {
  try {
    const { status, startDate, endDate, classId, subjectId, page, limit } = req.query;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;

    // Build query
    const query = { schoolId };
    
    // If teacher, strictly show their assignments
    if (userRole === 'teacher') {
      query.teacherId = req.user._id;
    }
    
    if (status && status !== 'all') {
      if (status === 'past') {
        query.dueDate = { $lt: new Date() };
      } else if (status === 'active') {
        query.status = 'active';
        query.dueDate = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
      } else {
        query.status = status;
      }
    }
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    
    if (startDate || endDate) {
      query.dueDate = query.dueDate || {};
      if (startDate) query.dueDate.$gte = new Date(startDate);
      if (endDate) query.dueDate.$lte = new Date(endDate);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * pageSize;

    const total = await Assignment.countDocuments(query);

    const assignments = await Assignment.find(query)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Compute student counts in ONE aggregate query to eliminate N+1 queries
    const classIds = [...new Set(assignments.map(a => a.classId?._id || a.classId).filter(Boolean))];
    const studentCountAgg = await Student.aggregate([
      { $match: { classId: { $in: classIds }, status: 'active' } },
      { $group: { _id: '$classId', count: { $sum: 1 } } }
    ]);
    const studentCountMap = new Map();
    studentCountAgg.forEach(item => {
      studentCountMap.set(item._id.toString(), item.count);
    });

    // Compute granular submission stats synchronously without extra queries
    const assignmentsWithStats = assignments.map((assignment) => {
      const clsId = (assignment.classId?._id || assignment.classId || '').toString();
      const totalStudents = studentCountMap.get(clsId) || 0;
      
      const submissions = assignment.submissions || [];
      const submittedCount = submissions.filter(s => s.status === 'submitted').length;
      const lateCount = submissions.filter(s => s.status === 'late').length;
      const gradedCount = submissions.filter(s => s.status === 'graded').length;
      const resubmitCount = submissions.filter(s => s.status === 'resubmit_requested').length;
      const totalSubmitted = submittedCount + lateCount + gradedCount + resubmitCount;
      const pendingCount = Math.max(0, totalStudents - totalSubmitted);

      return {
        ...assignment.toObject(),
        totalStudents,
        submissionCount: totalSubmitted,
        submittedCount,
        lateCount,
        gradedCount,
        resubmitCount,
        pendingCount
      };
    });

    res.status(200).json({
      success: true,
      count: assignmentsWithStats.length,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      },
      data: assignmentsWithStats
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching assignments'
    });
  }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private (Teacher, School Admin, Student, Parent)
const getAssignment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignment ID format'
      });
    }

    const assignment = await Assignment.findById(req.params.id)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .populate('submissions.studentId', 'name rollNumber');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access based on role
    if (req.user.role === 'teacher' && assignment.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // For students, verify they are in the assignment's class
    if (req.user.role === 'student') {
      // req.user is already the Student document
      if (!req.user.classId || req.user.classId.toString() !== assignment.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not in assignment class'
        });
      }
    }

    // For parents, verify their child is in the assignment's class
    if (req.user.role === 'parent') {
      // req.user is already the Parent document with studentId
      if (!req.user.studentId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - parent has no associated student'
        });
      }
      
      // Get the parent's child to check their class
      const child = await Student.findById(req.user.studentId);
      if (!child || child.classId.toString() !== assignment.classId._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - child not in assignment class'
        });
      }
    }

    const totalStudents = await Student.countDocuments({ 
      classId: assignment.classId._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      data: {
        ...assignment.toObject(),
        totalStudents
      }
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching assignment'
    });
  }
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Teacher, School Admin)
const createAssignment = async (req, res) => {
  try {
    // Skip express-validator for multipart form data
    // We'll do manual validation instead

    const {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      points
    } = req.body;

    console.log('📥 Backend: Received assignment data:', {
      title,
      description,
      classId,
      subjectId,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      points,
      files: req.files?.length || 0
    });
    
    console.log('📥 Backend: req.files details:', JSON.stringify(req.files, null, 2));

    // Manual validation
    if (!title || !description || !classId || !subjectId || !dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, classId, subjectId, and dueDate are required'
      });
    }

    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dueDate format. Please provide a valid date string'
      });
    }

    // Ensure due date is not in the past
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dueDateStart = new Date(dueDateObj);
    dueDateStart.setHours(0, 0, 0, 0);

    if (dueDateStart < todayStart) {
      return res.status(400).json({
        success: false,
        error: 'Due date cannot be in the past'
      });
    }

    const schoolId = req.user.schoolId;
    const teacherId = req.user._id;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid classId or subjectId format'
      });
    }

    // Verify class exists in school
    const classData = await Class.findOne({ _id: classId, schoolId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Verify subject belongs to school and teacher
    const subjectQuery = { _id: subjectId, schoolId };
    if (req.user.role === 'teacher') {
      subjectQuery.teacherId = teacherId;
    }
    const subject = await Subject.findOne(subjectQuery);
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found or you do not teach this subject'
      });
    }

    // D-16: Verify subject belongs to the specified class and teacher teaches it
    if (subject.classId && subject.classId.toString() !== classId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'The selected subject does not belong to the selected class'
      });
    }

    if (req.user.role === 'teacher') {
      const teachesClass = await Schedule.exists({
        schoolId,
        teacherId,
        classId,
        status: 'active'
      });
      const directSubjectMatch = subject.classId && subject.classId.toString() === classId.toString();

      if (!teachesClass && !directSubjectMatch) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not teach this class'
        });
      }
    }

    // Prepare attachments from uploaded files (Local Storage)
    const fileAttachments = [];
    if (req.files && req.files.length > 0) {
      console.log('📎 Backend: Processing', req.files.length, 'files');
      
      req.files.forEach((file, index) => {
        const fileUrl = `/uploads/documents/${file.filename}`;
        const isImage = file.mimetype && file.mimetype.startsWith('image/');
        fileAttachments.push({
          name: file.originalname,
          url: fileUrl,
          type: isImage ? 'image' : 'pdf',
          size: file.size,
          localPath: file.path
        });
      });
    }

    // Also support attachments passed as JSON array (from Cloudinary or direct upload)
    let directAttachments = [];
    if (attachments) {
      try {
        const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
        directAttachments = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        console.warn('Failed to parse attachments JSON in createAssignment:', err.message);
      }
    }

    const combinedAttachments = [...fileAttachments, ...directAttachments];

    // Create assignment - Build data object carefully
    const assignmentData = {
      title: title.trim(),
      description: description.trim(),
      classId,
      subjectId,
      teacherId,
      schoolId,
      dueDate: dueDateObj,
      dueTime: dueTime || '23:59',
      totalMarks: parseInt(totalMarks, 10) || 0,
      points: parseInt(points, 10) || 0,
      attachments: combinedAttachments,
      createdBy: teacherId
    };

    console.log('💾 Backend: Assignment data type check:', {
      attachmentsIsArray: Array.isArray(assignmentData.attachments),
      attachmentsLength: assignmentData.attachments?.length,
      attachmentsType: typeof assignmentData.attachments,
      firstAttachment: assignmentData.attachments[0]
    });
    
    // Use new Assignment() instead of create() to avoid casting issues
    const assignment = new Assignment(assignmentData);
    await assignment.save();
    
    console.log('✅ Backend: Assignment created successfully with ID:', assignment._id);

    // Populate the created assignment
    await assignment.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    // Get all students in the class to create notifications
    const students = await Student.find({ 
      classId: assignment.classId._id,
      schoolId: assignment.schoolId,
      status: 'active'
    });

    // Create notifications for all students in the class
    let createdNotifications = [];
    if (students.length > 0) {
      try {
        createdNotifications = await Notification.createAssignmentNotification(assignment, students);
        console.log(`📢 Created assignment notifications for ${students.length} students`);
        
        // Send push notifications to students
        try {
          const { sendPushNotificationsToUsers } = require('../utils/pushNotifications');
          const studentIds = students.map(s => s._id.toString());
          await sendPushNotificationsToUsers(
            studentIds,
            'Student',
            'New Assignment',
            `${assignment.title} - Due ${new Date(assignment.dueDate).toLocaleDateString()}`,
            {
              type: 'assignment',
              assignmentId: assignment._id.toString(),
              relatedId: assignment._id.toString(),
              relatedType: 'assignment'
            }
          );
          console.log(`📱 Sent push notifications to ${students.length} students`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail if push notifications fail
        }
      } catch (notificationError) {
        console.error('Error creating assignment notifications:', notificationError);
        // Don't fail the assignment creation if notifications fail
      }
    }

    // Emit WebSocket event to notify students and parents about new assignment
    if (io && students.length > 0) {
      console.log(`📤 Backend: Emitting new_assignment event to ${students.length} students and their parents`);
      console.log(`📤 Backend: Io instance available:`, !!io);
      console.log(`📤 Backend: Students to notify:`, students.map(s => ({ id: s._id, name: s.name })));
      
      // Get all parents for these students
      const studentIds = students.map(s => s._id);
      const Parent = require('../models/Parent');
      const parents = await Parent.find({ studentId: { $in: studentIds } });
      console.log(`📤 Backend: Found ${parents.length} parents to notify`);
      
      // Emit to each student in the class
      students.forEach(student => {
        const roomName = `user_${student._id}`;
        console.log(`📤 Backend: Emitting to student room: ${roomName} for student: ${student.name}`);
        
        const assignmentData = assignment.toObject();
        console.log('📤 Backend: Assignment data being emitted:', {
          title: assignmentData.title,
          classId: assignmentData.classId,
          classIdType: typeof assignmentData.classId,
          classIdValue: assignmentData.classId
        });
        
        io.to(roomName).emit('new_assignment', {
          success: true,
          assignment: assignmentData, // Convert to plain object
          message: `New assignment: ${assignment.title}`
        });
        
        // Emit notification event for each student
        const studentNotification = createdNotifications.find(n => n.recipient.toString() === student._id.toString());
        if (studentNotification) {
          console.log(`📢 Backend: Emitting new_notification event to student room: ${roomName}`);
          io.to(roomName).emit('new_notification', {
            success: true,
            notification: studentNotification,
            message: `New notification: ${studentNotification.title}`
          });
        }
      });
      
      // Emit to each parent of students in the class
      parents.forEach(parent => {
        const parentRoomName = `user_${parent._id}`;
        console.log(`📤 Backend: Emitting to parent room: ${parentRoomName} for parent: ${parent.name}`);
        
        const assignmentData = assignment.toObject();
        
        io.to(parentRoomName).emit('new_assignment', {
          success: true,
          assignment: assignmentData,
          message: `New assignment for your child: ${assignment.title}`
        });
        
        // Also emit notification to parent
        const parentNotification = createdNotifications.find(n => n.recipient.toString() === parent.studentId.toString());
        if (parentNotification) {
          console.log(`📢 Backend: Emitting new_notification event to parent room: ${parentRoomName}`);
          io.to(parentRoomName).emit('new_notification', {
            success: true,
            notification: parentNotification,
            message: `New notification for your child: ${parentNotification.title}`
          });
        }
      });
    } else {
      console.log(`❌ Backend: Cannot emit assignment event - io:`, !!io, 'students:', students.length);
    }

    const totalStudents = students.length;

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: {
        ...assignment.toObject(),
        submissionCount: 0,
        totalStudents,
        notificationsCreated: students.length
      }
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating assignment'
    });
  }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Teacher, School Admin)
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && assignment.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const {
      title,
      description,
      dueDate,
      dueTime,
      attachments,
      totalMarks,
      status
    } = req.body;

    // Update fields
    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = dueDate;
    if (dueTime !== undefined) assignment.dueTime = dueTime;
    if (attachments) assignment.attachments = attachments;
    if (totalMarks !== undefined) assignment.totalMarks = totalMarks;
    if (status) assignment.status = status;
    assignment.updatedBy = req.user._id;

    await assignment.save();

    // Populate the updated assignment
    await assignment.populate([
      { path: 'classId', select: 'name section room' },
      { path: 'subjectId', select: 'name code' },
      { path: 'teacherId', select: 'name email' }
    ]);

    const totalStudents = await Student.countDocuments({ 
      classId: assignment.classId._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: {
        ...assignment.toObject(),
        totalStudents
      }
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating assignment'
    });
  }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Teacher, School Admin)
const deleteAssignment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignment ID format'
      });
    }

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check access
    if (req.user.role === 'teacher' && assignment.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Clean up remote Cloudinary assets
    const { deleteFromCloudinary } = require('../utils/cloudinary');
    if (assignment.attachments && Array.isArray(assignment.attachments)) {
      for (const att of assignment.attachments) {
        if (att.public_id) {
          try {
            await deleteFromCloudinary(att.public_id);
          } catch (cloudErr) {
            console.warn('Error deleting Cloudinary asset on assignment delete:', cloudErr.message);
          }
        }
      }
    }

    // Clean up local files
    const filesToDelete = [];
    
    // Collect all local file paths
    if (assignment.attachments) {
      assignment.attachments.forEach(attachment => {
        if (attachment.localPath) {
          filesToDelete.push(attachment.localPath);
        }
      });
    }
    
    if (assignment.submissions) {
      assignment.submissions.forEach(submission => {
        if (submission.attachments) {
          submission.attachments.forEach(attachment => {
            if (attachment.localPath) {
              filesToDelete.push(attachment.localPath);
            }
          });
        }
      });
    }
    
    // If student submissions exist, soft delete to preserve submission grading records
    const hasSubmissions = assignment.submissions && assignment.submissions.length > 0;
    if (hasSubmissions) {
      assignment.status = 'cancelled';
      assignment.isDeleted = true;
      await assignment.save();
    } else {
      await Assignment.findByIdAndDelete(req.params.id);
    }

    // Clean up local files (strictly within uploads/documents)
    const allowedUploadsDir = path.resolve(__dirname, '../uploads');
    if (filesToDelete.length > 0) {
      filesToDelete.forEach(filePath => {
        try {
          if (!filePath || typeof filePath !== 'string') return;
          const resolvedPath = path.resolve(filePath);
          if (resolvedPath.startsWith(allowedUploadsDir) && fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath);
            console.log(`✅ Deleted local file: ${resolvedPath}`);
          } else {
            console.warn(`[Security] Skipped deleting file outside uploads directory: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`Error deleting file ${filePath}:`, fileError);
          // Don't fail the deletion if file cleanup fails
        }
      });
      console.log(`✅ Cleaned up local files for assignment ${req.params.id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting assignment'
    });
  }
};

// @desc    Get teacher's classes with subjects
// @route   GET /api/assignments/teacher/classes
// @access  Private (Teacher)
const getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    // 1. Get all subjects that the teacher teaches
    const subjects = await Subject.find({ 
      teacherId, 
      schoolId,
      status: 'active'
    })
    .populate('classId', 'name section room')
    .sort({ classId: 1 });

    // 2. Also get classes from Schedule to guarantee full coverage
    const schedules = await Schedule.find({
      teacherId,
      schoolId,
      status: 'active'
    })
    .populate('classId', 'name section room')
    .populate('subjectId', 'name code');

    // Group subjects by class
    const classesBySubject = {};

    const addSubjectToClass = (cls, subj) => {
      if (!cls || !cls._id) return;
      const classKey = cls._id.toString();
      if (!classesBySubject[classKey]) {
        classesBySubject[classKey] = {
          _id: cls._id,
          name: cls.name,
          section: cls.section,
          room: cls.room,
          studentCount: 0,
          subjects: []
        };
      }
      if (subj && subj._id) {
        const existingSubj = classesBySubject[classKey].subjects.find(
          s => s._id.toString() === subj._id.toString()
        );
        if (!existingSubj) {
          classesBySubject[classKey].subjects.push({
            _id: subj._id,
            name: subj.name,
            code: subj.code
          });
        }
      }
    };

    subjects.forEach(s => addSubjectToClass(s.classId, s));
    schedules.forEach(sc => addSubjectToClass(sc.classId, sc.subjectId));

    const classes = Object.values(classesBySubject);

    // 3. Aggregate enrolled student counts in ONE query across all teacher classes
    const classIds = classes.map(c => new mongoose.Types.ObjectId(c._id));
    if (classIds.length > 0) {
      const studentCounts = await Student.aggregate([
        { $match: { classId: { $in: classIds }, status: 'active' } },
        { $group: { _id: '$classId', count: { $sum: 1 } } }
      ]);
      const countMap = {};
      studentCounts.forEach(item => {
        countMap[item._id.toString()] = item.count;
      });
      classes.forEach(c => {
        c.studentCount = countMap[c._id.toString()] || 0;
      });
    }

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes
    });
  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching classes'
    });
  }
};

// @desc    Submit assignment (Student)
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
const submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.user._id;

    // Find the assignment
    const assignment = await Assignment.findById(assignmentId)
      .populate('subjectId', 'name')
      .populate('classId', 'name');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Check if student is in the same class
    const student = await Student.findById(studentId);
    if (!student || student.classId.toString() !== assignment.classId._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to submit this assignment'
      });
    }

    // Check if student has already submitted
    const existingSubmission = assignment.submissions.find(
      sub => sub.studentId.toString() === studentId.toString()
    );
    
    console.log(`📝 Backend: Checking submission for student ${studentId}, assignment ${assignmentId}`);
    console.log(`📝 Backend: Existing submission:`, existingSubmission ? {
      status: existingSubmission.status,
      submittedAt: existingSubmission.submittedAt
    } : 'none');
    
    if (existingSubmission && existingSubmission.status !== 'pending') {
      console.log(`📝 Backend: Student has already submitted this assignment with status: ${existingSubmission.status}`);
      return res.status(400).json({
        success: false,
        error: 'Assignment already submitted. You cannot submit this assignment again.',
        alreadySubmitted: true,
        submission: {
          submittedAt: existingSubmission.submittedAt,
          status: existingSubmission.status,
          marks: existingSubmission.marks,
          feedback: existingSubmission.feedback
        }
      });
    }

    // Prepare attachments from uploaded files (Local Storage)
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const fileUrl = `/uploads/documents/${file.filename}`;
        attachments.push({
          name: file.originalname,
          url: fileUrl, // Local file URL
          type: 'pdf',
          size: file.size,
          localPath: file.path // Store full local path for deletion
        });
      });
    }

    // Add submission to assignment
    await assignment.addSubmission(studentId, attachments);

    // Award points to student
    // Compare dates at day level (not including time) to check if same day
    const dueDateOnly = new Date(assignment.dueDate);
    dueDateOnly.setHours(0, 0, 0, 0);
    const nowDateOnly = new Date();
    nowDateOnly.setHours(0, 0, 0, 0);
    
    // Only mark as late if submitted AFTER the due date (not on the due date)
    const isLate = nowDateOnly > dueDateOnly;
    
    await student.addPoints(
      assignmentId,
      isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
      assignment.title,
      assignment.subjectId.name,
      isLate
    );

    // Create notification for teacher
    await Notification.create({
      title: 'New Assignment Submission',
      message: `${student.name} submitted assignment: ${assignment.title}`,
      type: 'assignment_submission',
      recipient: assignment.teacherId,
      recipientModel: 'User',
      sender: studentId,
      schoolId: assignment.schoolId,
      relatedId: assignmentId,
      relatedType: 'assignment',
      isRead: false,
      priority: 'high',
      icon: 'checkmark-circle',
      color: '#10B981'
    });

    // Emit real-time notification and submission update
    if (io) {
      const teacherRoom = `user_${assignment.teacherId.toString()}`;
      
      console.log(`📢 Backend: Preparing to emit to teacher room: ${teacherRoom}`);
      console.log(`📢 Backend: Teacher ID: ${assignment.teacherId.toString()}`);
      console.log(`📢 Backend: Student: ${student.name}`);
      console.log(`📢 Backend: Assignment: ${assignment.title}`);
      
      // Check if the room exists and has clients
      const roomClients = io.sockets.adapter.rooms.get(teacherRoom);
      console.log(`📢 Backend: Room "${teacherRoom}" has ${roomClients ? roomClients.size : 0} clients`);
      if (roomClients) {
        console.log(`📢 Backend: Clients in room:`, Array.from(roomClients));
      }
      
      // Emit notification
      io.to(teacherRoom).emit('new_notification', {
        success: true,
        notification: {
          title: 'New Assignment Submission',
          message: `${student.name} submitted assignment: ${assignment.title}`,
          type: 'assignment_submission'
        }
      });
      
      // Get updated assignment with submission count
      const updatedAssignment = await Assignment.findById(assignmentId)
        .populate('classId', 'name section room')
        .populate('subjectId', 'name code')
        .populate('teacherId', 'name email');
      
      const totalStudents = await Student.countDocuments({ 
        classId: updatedAssignment.classId._id,
        status: 'active'
      });
      
      const submittedCount = updatedAssignment.submissions.filter(
        s => s.status !== 'pending'
      ).length;
      
      // Emit assignment submission event with full updated data
      io.to(teacherRoom).emit('assignment_submitted', {
        success: true,
        assignmentId: assignmentId,
        studentId: studentId,
        studentName: student.name,
        submittedAt: new Date(),
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
        isLate: isLate,
        assignment: {
          ...updatedAssignment.toObject(),
          submissionCount: submittedCount,
          totalStudents: totalStudents
        }
      });
      
      console.log(`📢 Backend: ✅ ✅ ✅ Emitted assignment_submitted event to teacher room: ${teacherRoom}`);
      console.log(`📢 Backend: Event data:`, {
        assignmentId,
        studentName: student.name,
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points
      });
      
    } else {
      console.log(`❌ Backend: io is not available, cannot emit events`);
    }

    res.status(200).json({
      success: true,
      message: 'Assignment submitted successfully',
      data: {
        pointsEarned: isLate ? Math.floor(assignment.points * 0.5) : assignment.points,
        isLate: isLate,
        submissionTime: new Date()
      }
    });

  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while submitting assignment'
    });
  }
};

// @desc    Get student's assignment submissions
// @route   GET /api/assignments/my-submissions
// @access  Private (Student)
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user._id;

    const assignments = await Assignment.find({
      'submissions.studentId': studentId
    })
      .populate('classId', 'name section')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ dueDate: -1 });

    // Return flat structure with assignmentId for easier frontend checking
    const submissions = [];
    
    assignments.forEach(assignment => {
      const submission = assignment.submissions.find(
        s => s.studentId.toString() === studentId.toString()
      );

      // Only include non-pending submissions (actually submitted)
      if (submission && submission.status !== 'pending') {
        submissions.push({
          _id: submission._id,
          assignmentId: assignment._id, // This is what frontend checks
          submittedAt: submission.submittedAt,
          files: submission.attachments || [],
          attachments: submission.attachments || [],
          pointsEarned: submission.pointsEarned,
          marks: submission.marks,
          feedback: submission.feedback,
          status: submission.status
        });
      }
    });

    console.log(`📝 Backend: Returning ${submissions.length} submissions for student ${studentId}`);
    console.log(`📝 Backend: Submissions:`, submissions.map(s => ({
      id: s._id,
      assignmentId: s.assignmentId,
      status: s.status
    })));

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions
    });

  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching submissions'
    });
  }
};

// @desc    Get assignments for a specific child (Parent access)
// @route   GET /api/assignments/child/:childId
// @access  Private (Parent)
const getChildAssignments = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify the child belongs to this parent
    const Parent = require('../models/Parent');
    const Student = require('../models/Student');
    
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s assignments.'
      });
    }

    const child = await Student.findById(childId);
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    // Get assignments for the child's class
    const assignments = await Assignment.find({
      classId: child.classId,
      schoolId: schoolId,
      status: 'active'
    })
    .populate('subjectId', 'name')
    .populate('classId', 'name')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching child assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child assignments'
    });
  }
};

// @desc    Get assignment submissions for a specific child (Parent access)
// @route   GET /api/assignments/child/:childId/submissions
// @access  Private (Parent)
const getChildAssignmentSubmissions = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify the child belongs to this parent
    const Parent = require('../models/Parent');
    const Student = require('../models/Student');
    
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    // Get all student IDs (support both old and new schema)
    let studentIds = [];
    if (parent.studentIds && parent.studentIds.length > 0) {
      studentIds = parent.studentIds.map(id => id.toString());
    } else if (parent.studentId) {
      studentIds = [parent.studentId.toString()];
    }

    // Check if the requested child ID is one of the parent's children
    if (!studentIds.includes(childId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own child\'s submissions.'
      });
    }

    const child = await Student.findById(childId);
    if (!child || !child.classId) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not assigned to any class'
      });
    }

    // Get assignments for the child's class and filter submissions
    const assignments = await Assignment.find({
      classId: child.classId,
      schoolId: schoolId,
      'submissions.studentId': childId // Only assignments where this student has submitted
    })
    .populate('subjectId', 'name')
    .populate('classId', 'name')
    .sort({ 'submissions.submittedAt': -1 });

    // Extract only the student's submissions from each assignment
    const submissions = [];
    assignments.forEach(assignment => {
      const studentSubmission = assignment.submissions.find(
        sub => sub.studentId.toString() === childId
      );
      
      if (studentSubmission && studentSubmission.status !== 'pending') {
        submissions.push({
          _id: studentSubmission._id,
          assignmentId: assignment._id,
          assignmentTitle: assignment.title,
          assignmentDescription: assignment.description,
          assignmentDueDate: assignment.dueDate,
          assignmentTotalMarks: assignment.totalMarks,
          assignmentPoints: assignment.points,
          subjectId: assignment.subjectId,
          classId: assignment.classId,
          submittedAt: studentSubmission.submittedAt,
          attachments: studentSubmission.attachments,
          marks: studentSubmission.marks,
          pointsEarned: studentSubmission.pointsEarned,
          feedback: studentSubmission.feedback,
          status: studentSubmission.status
        });
      }
    });

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Error fetching child assignment submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching child assignment submissions'
    });
  }
};

// @desc    Get all submissions for an assignment grouped by status
// @route   GET /api/homework/:id/submissions or /api/assignments/:id/submissions
// @access  Private (Teacher, School Admin)
const getAssignmentSubmissions = async (req, res) => {
  try {
    const assignmentId = req.params.id;

    const assignment = await Assignment.findById(assignmentId)
      .populate('classId', 'name section room')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    // Teacher isolation check
    if (req.user.role === 'teacher' && assignment.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only view submissions for your own assignments'
      });
    }

    // Get all active students enrolled in this class
    const students = await Student.find({
      classId: assignment.classId._id,
      status: 'active'
    }).sort({ rollNumber: 1, name: 1 });

    const submitted = [];
    const pending = [];
    const late = [];
    const graded = [];
    const resubmitRequested = [];
    const all = [];

    students.forEach((student) => {
      const existingSub = assignment.submissions.find(
        (s) => s.studentId && s.studentId.toString() === student._id.toString()
      );

      if (existingSub && existingSub.status !== 'pending') {
        const item = {
          _id: existingSub._id,
          studentId: student._id,
          studentName: student.name,
          rollNumber: student.rollNumber != null ? String(student.rollNumber) : '',
          admissionNumber: student.admissionNumber || '',
          avatar: student.photoUrl || null,
          submittedAt: existingSub.submittedAt,
          attachments: existingSub.attachments || [],
          marks: existingSub.marks != null ? existingSub.marks : null,
          pointsEarned: existingSub.pointsEarned || 0,
          feedback: existingSub.feedback || '',
          status: existingSub.status,
          needsResubmission: Boolean(existingSub.needsResubmission),
          gradedAt: existingSub.gradedAt || null
        };

        all.push(item);

        if (existingSub.status === 'graded') {
          graded.push(item);
        } else if (existingSub.status === 'resubmit_requested') {
          resubmitRequested.push(item);
        } else if (existingSub.status === 'late') {
          late.push(item);
        } else {
          // 'submitted'
          submitted.push(item);
        }
      } else {
        const pendingItem = {
          _id: existingSub ? existingSub._id : null,
          studentId: student._id,
          studentName: student.name,
          rollNumber: student.rollNumber != null ? String(student.rollNumber) : '',
          admissionNumber: student.admissionNumber || '',
          avatar: student.photoUrl || null,
          submittedAt: null,
          attachments: [],
          marks: null,
          pointsEarned: 0,
          feedback: '',
          status: 'pending',
          needsResubmission: false,
          gradedAt: null
        };

        all.push(pendingItem);
        pending.push(pendingItem);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        assignment: {
          _id: assignment._id,
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate,
          dueTime: assignment.dueTime,
          totalMarks: assignment.totalMarks || 0,
          points: assignment.points || 0,
          class: assignment.classId,
          subject: assignment.subjectId,
          attachments: assignment.attachments || []
        },
        stats: {
          total: students.length,
          submitted: submitted.length,
          pending: pending.length,
          late: late.length,
          graded: graded.length,
          resubmitRequested: resubmitRequested.length
        },
        groups: {
          submitted,
          pending,
          late,
          graded,
          resubmitRequested
        },
        all
      }
    });
  } catch (error) {
    console.error('Get assignment submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching assignment submissions'
    });
  }
};

// @desc    Grade a student submission + feedback + optional resubmission request
// @route   PATCH /api/homework/submissions/:submissionId/grade
//          or PATCH /api/homework/:id/submissions/:submissionId/grade
//          or PATCH /api/assignments/:id/submissions/:submissionId/grade
// @access  Private (Teacher, School Admin)
const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { marks, feedback, status, needsResubmission } = req.body;

    if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submission ID format'
      });
    }

    if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignment ID format'
      });
    }

    let assignment;
    if (req.params.id) {
      assignment = await Assignment.findById(req.params.id);
    } else {
      assignment = await Assignment.findOne({ 'submissions._id': submissionId });
    }

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment or submission not found'
      });
    }

    // Teacher isolation check
    if (req.user.role === 'teacher' && assignment.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only grade submissions for your own assignments'
      });
    }

    const submission = assignment.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found in assignment'
      });
    }

    // Validate marks if provided
    if (marks !== undefined && marks !== null && marks !== '') {
      const numMarks = Number(marks);
      if (isNaN(numMarks) || numMarks < 0) {
        return res.status(400).json({
          success: false,
          error: 'Marks must be a non-negative number'
        });
      }
      if (assignment.totalMarks > 0 && numMarks > assignment.totalMarks) {
        return res.status(400).json({
          success: false,
          error: `Marks (${numMarks}) cannot exceed total marks (${assignment.totalMarks})`
        });
      }
      submission.marks = numMarks;
    }

    if (feedback !== undefined) {
      const trimmed = typeof feedback === 'string' ? feedback.trim() : '';
      if (trimmed.length > 2000) {
        return res.status(400).json({
          success: false,
          error: 'Feedback cannot exceed 2000 characters'
        });
      }
      submission.feedback = trimmed;
    }

    // Validate status strictly: cannot be 'pending' or arbitrary string
    if (status && !['graded', 'resubmit_requested'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid grading status. Allowed values: 'graded', 'resubmit_requested'"
      });
    }

    if (needsResubmission === true || status === 'resubmit_requested') {
      submission.needsResubmission = true;
      submission.status = 'resubmit_requested';
    } else {
      submission.needsResubmission = false;
      submission.status = 'graded';
    }

    submission.gradedAt = new Date();
    submission.gradedBy = req.user._id;

    await assignment.save();

    // Create notification for student
    try {
      const student = await Student.findById(submission.studentId);
      if (student) {
        await Notification.create({
          title: submission.needsResubmission ? 'Homework Resubmission Requested' : 'Homework Graded',
          message: submission.needsResubmission
            ? `Teacher requested resubmission for: ${assignment.title}. Feedback: ${submission.feedback || 'Please review teacher comments.'}`
            : `Your submission for ${assignment.title} was graded: ${submission.marks != null ? `${submission.marks}/${assignment.totalMarks}` : 'Graded'}`,
          type: 'grade',
          recipient: student._id,
          recipientModel: 'Student',
          sender: req.user._id,
          schoolId: assignment.schoolId,
          relatedId: assignment._id,
          relatedType: 'assignment',
          isRead: false,
          priority: 'medium',
          icon: 'school-outline',
          color: '#007AFF'
        });
      }
    } catch (notifErr) {
      console.warn('Could not create notification for graded homework:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: submission.needsResubmission ? 'Resubmission requested successfully' : 'Submission graded successfully',
      data: submission
    });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while grading submission: ' + error.message
    });
  }
};

module.exports = {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getTeacherClasses,
  submitAssignment,
  getMySubmissions,
  getChildAssignments,
  getChildAssignmentSubmissions,
  getAssignmentSubmissions,
  gradeSubmission,
  uploadDocument,
  handleUploadError,
  setSocketIO
};

