const mongoose = require('mongoose');

const transportFeeCollectionSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentTransportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentTransport',
    required: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  month: {
    type: String,
    trim: true // YYYY-MM e.g. "2026-04"
  },
  installmentNumber: { type: Number },
  paymentFrequency: { type: String, enum: ['monthly', 'quarterly', 'custom'], default: 'monthly' },
  quarterMonths: [{ type: String }],
  periodMonths: [{ type: String }],
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  dueAmount: { type: Number, required: true, min: 0 },
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  payments: [{
    amount: { type: Number, required: true },
    paymentDate: { type: Date, required: true },
    paymentMethod: { type: String },
    transactionId: { type: String },
    remarks: { type: String }
  }]
}, { timestamps: true });

transportFeeCollectionSchema.index({ schoolId: 1, academicYear: 1 });
transportFeeCollectionSchema.index({ studentId: 1, academicYear: 1 });

module.exports = mongoose.model('TransportFeeCollection', transportFeeCollectionSchema);
