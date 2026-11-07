const TeacherLeave = require('../models/TeacherLeave');
const ImportantDate = require('../models/ImportantDate');
const Class = require('../models/Class');
const { validationResult } = require('express-validator');

// @desc    Create a new important date
// @route   POST /api/important-dates
// @access  Private (School Admin)
const createImportantDate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors for important date creation:', errors.array());
      console.log('❌ Request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      date,
      endDate,
      type,
      priority = 'normal',
      classes = [],
      applyToAllClasses = true,
      startTime,
      endTime,
      location,
      academicYear = '2024-2025'
    } = req.body;

    const schoolId = req.user.schoolId;
    const createdBy = req.user.id;

    console.log('📅 CREATE - schoolId:', schoolId);
    console.log('📅 CREATE - applyToAllClasses:', applyToAllClasses);
    console.log('📅 CREATE - classes:', classes);
    console.log('📅 CREATE - classes type:', typeof classes);
    console.log('📅 CREATE - classes is array:', Array.isArray(classes));

    // Validate classes if not applying to all
    if (!applyToAllClasses && classes && classes.length > 0) {
      console.log('📅 CREATE - Validating classes...');
      const validClasses = await Class.find({
        _id: { $in: classes },
        schoolId,
        status: 'active'
      });

      console.log('📅 CREATE - Valid classes found:', validClasses.length);
      console.log('📅 CREATE - Valid class IDs:', validClasses.map(c => c._id.toString()));
      console.log('📅 CREATE - Requested class IDs:', classes);

      if (validClasses.length !== classes.length) {
        console.log('❌ CREATE - Class validation failed!');
        console.log('❌ CREATE - Expected:', classes.length, 'Found:', validClasses.length);
        return res.status(400).json({
          success: false,
          error: 'One or more classes are invalid'
        });
      }
      console.log('✅ CREATE - Class validation passed!');
    } else if (applyToAllClasses) {
      // When applying to all classes, ensure classes array is empty
      console.log('📅 Applying to all classes, classes array will be empty');
    }

    const importantDate = await ImportantDate.create({
      title,
      description,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      type,
      priority,
      schoolId,
      classes: applyToAllClasses ? [] : classes,
      applyToAllClasses,
      createdBy,
      startTime,
      endTime,
      location,
      academicYear
    });

    await importantDate.populate([
      { path: 'classes', select: 'name section' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Emit WebSocket event for real-time updates
    if (global.io) {
      const schoolRoom = `school_${schoolId}`;
      global.io.to(schoolRoom).emit('important_date_created', {
        type: 'important_date_created',
        importantDate: importantDate,
        schoolId: schoolId
      });
      console.log(`📅 Emitted important date created event to school room: ${schoolRoom}`);
    }

    res.status(201).json({
      success: true,
      message: 'Important date created successfully',
      data: importantDate
    });
  } catch (error) {
    console.error('Error creating important date:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating important date'
    });
  }
};

// @desc    Get all important dates for a school
// @route   GET /api/important-dates
// @access  Private (School Admin, Teacher, Parent)
const getImportantDates = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { 
      startDate, 
      endDate, 
      type, 
      priority, 
      classId,
      page = 1, 
      limit = 50 
    } = req.query;

    // Build query
    const query = { schoolId, isActive: true };

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Class filter - for parents/teachers, only show events relevant to their classes
    if (classId) {
      query.$or = [
        { applyToAllClasses: true },
        { classes: classId }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const importantDates = await ImportantDate.find(query)
      .populate('classes', 'name section')
      .populate('createdBy', 'name email')
      .sort({ date: 1, priority: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ImportantDate.countDocuments(query);

    res.json({
      success: true,
      data: importantDates,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching important dates:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching important dates'
    });
  }
};

// @desc    Get important date by ID
// @route   GET /api/important-dates/:id
// @access  Private (School Admin, Teacher, Parent)
const getImportantDateById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const importantDate = await ImportantDate.findOne({
      _id: id,
      schoolId,
      isActive: true
    }).populate([
      { path: 'classes', select: 'name section' },
      { path: 'createdBy', select: 'name email' }
    ]);

    if (!importantDate) {
      return res.status(404).json({
        success: false,
        error: 'Important date not found'
      });
    }

    res.json({
      success: true,
      data: importantDate
    });
  } catch (error) {
    console.error('Error fetching important date:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching important date'
    });
  }
};

// @desc    Update important date
// @route   PUT /api/important-dates/:id
// @access  Private (School Admin)
const updateImportantDate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const {
      title,
      description,
      date,
      endDate,
      type,
      priority,
      classes,
      applyToAllClasses,
      startTime,
      endTime,
      location
    } = req.body;

    const importantDate = await ImportantDate.findOne({
      _id: id,
      schoolId,
      isActive: true
    });

    if (!importantDate) {
      return res.status(404).json({
        success: false,
        error: 'Important date not found'
      });
    }

    // Validate classes if not applying to all
    if (applyToAllClasses === false && classes && classes.length > 0) {
      const validClasses = await Class.find({
        _id: { $in: classes },
        schoolId,
        status: 'active'
      });

      if (validClasses.length !== classes.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more classes are invalid'
        });
      }
    } else if (applyToAllClasses === true) {
      // When applying to all classes, ensure classes array is empty
      console.log('📅 Applying to all classes for update, classes array will be empty');
    }

    // Update fields
    if (title) importantDate.title = title;
    if (description !== undefined) importantDate.description = description;
    if (date) importantDate.date = new Date(date);
    if (endDate !== undefined) importantDate.endDate = endDate ? new Date(endDate) : null;
    if (type) importantDate.type = type;
    if (priority) importantDate.priority = priority;
    if (classes !== undefined) importantDate.classes = applyToAllClasses ? [] : classes;
    if (applyToAllClasses !== undefined) importantDate.applyToAllClasses = applyToAllClasses;
    if (startTime !== undefined) importantDate.startTime = startTime;
    if (endTime !== undefined) importantDate.endTime = endTime;
    if (location !== undefined) importantDate.location = location;

    await importantDate.save();

    await importantDate.populate([
      { path: 'classes', select: 'name section' },
      { path: 'createdBy', select: 'name email' }
    ]);

    // Emit WebSocket event for real-time updates
    if (global.io) {
      const schoolRoom = `school_${schoolId}`;
      global.io.to(schoolRoom).emit('important_date_updated', {
        type: 'important_date_updated',
        importantDate: importantDate,
        schoolId: schoolId
      });
      console.log(`📅 Emitted important date updated event to school room: ${schoolRoom}`);
    }

    res.json({
      success: true,
      message: 'Important date updated successfully',
      data: importantDate
    });
  } catch (error) {
    console.error('Error updating important date:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating important date'
    });
  }
};

// @desc    Delete important date (soft delete)
// @route   DELETE /api/important-dates/:id
// @access  Private (School Admin)
const deleteImportantDate = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const importantDate = await ImportantDate.findOne({
      _id: id,
      schoolId,
      isActive: true
    });

    if (!importantDate) {
      return res.status(404).json({
        success: false,
        error: 'Important date not found'
      });
    }

    // Soft delete
    importantDate.isActive = false;
    await importantDate.save();

    // Emit WebSocket event for real-time updates
    if (global.io) {
      const schoolRoom = `school_${schoolId}`;
      global.io.to(schoolRoom).emit('important_date_deleted', {
        type: 'important_date_deleted',
        importantDateId: id,
        schoolId: schoolId
      });
      console.log(`📅 Emitted important date deleted event to school room: ${schoolRoom}`);
    }

    res.json({
      success: true,
      message: 'Important date deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting important date:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting important date'
    });
  }
};

// @desc    Get important dates for calendar view (monthly)
// @route   GET /api/important-dates/calendar
// @access  Private (School Admin, Teacher, Parent)
const getCalendarImportantDates = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    let { year, month, classId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' });
    }

    const now = new Date();
    year = parseInt(year, 10) || now.getFullYear();
    month = parseInt(month, 10) || (now.getMonth() + 1);

    // Calculate month boundary in UTC/IST
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const query = {
      schoolId,
      isActive: true,
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate }, date: { $lte: endDate } }
      ]
    };

    if (classId) {
      query.$and = [
        { $or: [{ applyToAllClasses: true }, { classes: classId }] }
      ];
    }

    const importantDates = await ImportantDate.find(query)
      .populate('classes', 'name section')
      .sort({ date: 1, startTime: 1 });

    // Fetch approved leaves if user is a teacher
    let teacherLeaves = [];
    if (req.user?.role === 'teacher') {
      try {
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        teacherLeaves = await TeacherLeave.find({
          teacherId: req.user._id,
          status: 'approved',
          fromDate: { $lte: endStr },
          toDate: { $gte: startStr }
        });
      } catch (leaveErr) {
        console.warn('TeacherLeave fetch warning:', leaveErr.message);
      }
    }

    // Helper: color code by event type
    const getColorForType = (type, title = '') => {
      const t = (type || '').toLowerCase();
      const tit = (title || '').toLowerCase();
      if (t === 'holiday' || tit.includes('holiday') || tit.includes('off')) return '#EF4444';
      if (t === 'exam' || tit.includes('exam')) return '#F59E0B';
      if (t === 'leave') return '#10B981';
      return '#2563EB'; // default event
    };

    // Format all events list
    const allEvents = [];

    importantDates.forEach(doc => {
      const isExam = doc.title.toLowerCase().includes('exam') || doc.type === 'deadline';
      const eventType = isExam ? 'exam' : doc.type;
      allEvents.push({
        _id: doc._id,
        title: doc.title,
        description: doc.description || '',
        type: eventType,
        color: getColorForType(eventType, doc.title),
        date: doc.date,
        endDate: doc.endDate || doc.date,
        startTime: doc.startTime,
        endTime: doc.endTime,
        location: doc.location,
        priority: doc.priority,
        isWeeklyOff: doc.title.toLowerCase().includes('weekly off') || doc.title.toLowerCase().includes('sunday')
      });
    });

    teacherLeaves.forEach(lv => {
      allEvents.push({
        _id: lv._id,
        title: `Approved Leave (${lv.leaveType || 'Personal'})`,
        description: lv.reason || 'Approved leave',
        type: 'leave',
        color: '#10B981',
        date: new Date(lv.fromDate),
        endDate: new Date(lv.toDate),
        startTime: '00:00',
        endTime: '23:59',
        priority: 'medium',
        isWeeklyOff: false
      });
    });

    // Build eventsByDate map for instant calendar cell markers
    const eventsByDate = {};
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cellDate = new Date(dateStr);

      const matching = allEvents.filter(ev => {
        const s = new Date(ev.date).toISOString().split('T')[0];
        const e = new Date(ev.endDate).toISOString().split('T')[0];
        return dateStr >= s && dateStr <= e;
      });

      if (matching.length > 0) {
        eventsByDate[dateStr] = matching;
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = eventsByDate[todayStr] || [];

    return res.status(200).json({
      success: true,
      data: {
        year,
        month,
        events: allEvents,
        eventsByDate,
        todayEvents,
        isTodayOff: todayEvents.some(e => e.type === 'holiday' || e.isWeeklyOff || e.type === 'leave')
      }
    });
  } catch (error) {
    console.error('❌ Error fetching calendar important dates:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching calendar dates: ' + error.message
    });
  }
};

module.exports = {
  createImportantDate,
  getImportantDates,
  getImportantDateById,
  updateImportantDate,
  deleteImportantDate,
  getCalendarImportantDates
};
