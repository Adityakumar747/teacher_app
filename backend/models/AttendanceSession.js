const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: [true, 'Slot ID is required'],
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required'],
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject ID is required'],
    index: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required'],
    index: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    index: true
  },
  date: {
    type: String, // Stored as YYYY-MM-DD string in IST
    required: [true, 'Date string YYYY-MM-DD is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    index: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  lateMarked: {
    type: Boolean,
    default: false
  },
  summary: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  audit: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedByName: {
      type: String,
      default: ''
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      default: 'created'
    },
    changes: {
      type: String,
      default: ''
    },
    details: [{
      studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
      },
      studentName: String,
      rollNumber: String,
      oldStatus: String,
      newStatus: String
    }]
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique index: only ONE session per slot per date (Golden Rule 3: Idempotent)
attendanceSessionSchema.index({ slotId: 1, date: 1 }, { unique: true });
attendanceSessionSchema.index({ teacherId: 1, date: 1 });
attendanceSessionSchema.index({ classId: 1, date: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
