const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: [true, 'Session ID is required'],
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['P', 'A', 'L', 'present', 'absent', 'late'],
    required: [true, 'Status is required'],
    set: (v) => {
      if (!v) return 'A';
      const upper = v.toUpperCase();
      if (upper === 'PRESENT' || upper === 'P') return 'P';
      if (upper === 'ABSENT' || upper === 'A') return 'A';
      if (upper === 'LATE' || upper === 'L') return 'L';
      return upper;
    }
  },
  remark: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique index: only ONE record per student per session (Golden Rule 3: Idempotent)
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
