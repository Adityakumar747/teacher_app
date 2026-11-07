/**
 * Seed Academic Calendar Events (Management Calendar for School)
 * Seed Academic Calendar (Exams, Holidays, School Events, Weekly Offs)
 */

const mongoose = require('mongoose');
require('dotenv').config();
const ImportantDate = require('../models/ImportantDate');
const User = require('../models/User');
const School = require('../models/School');

async function seedCalendar() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const teacher = await User.findOne({ email: 'teacher@spark.edu' });
  const admin = await User.findOne({ role: 'school_admin' }) || teacher;
  const schoolId = teacher.schoolId;

  // Clear existing calendar dates for this school to avoid duplicates
  await ImportantDate.deleteMany({ schoolId });
  console.log('Cleared existing ImportantDates for school');

  const events = [
    {
      title: 'Sunday (Weekly Off)',
      description: 'Weekly scheduled off',
      date: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-01T23:59:59.000Z'),
      type: 'holiday',
      priority: 'low',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Sunday (Weekly Off)',
      description: 'Weekly scheduled off',
      date: new Date('2026-11-08T00:00:00.000Z'),
      endDate: new Date('2026-11-08T23:59:59.000Z'),
      type: 'holiday',
      priority: 'low',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Diwali Break',
      description: 'Festival of Lights - School Closed',
      date: new Date('2026-11-12T00:00:00.000Z'),
      endDate: new Date('2026-11-13T23:59:59.000Z'),
      type: 'holiday',
      priority: 'high',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: "Children's Day Exhibition",
      description: 'Inter-house science exhibition and cultural performances',
      date: new Date('2026-11-14T09:00:00.000Z'),
      endDate: new Date('2026-11-14T15:00:00.000Z'),
      type: 'event',
      priority: 'medium',
      startTime: '09:00',
      endTime: '15:00',
      location: 'Main Auditorium',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Sunday (Weekly Off)',
      description: 'Weekly scheduled off',
      date: new Date('2026-11-15T00:00:00.000Z'),
      endDate: new Date('2026-11-15T23:59:59.000Z'),
      type: 'holiday',
      priority: 'low',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Mid-Term Examinations',
      description: 'Semester 1 comprehensive subject evaluations',
      date: new Date('2026-11-20T08:30:00.000Z'),
      endDate: new Date('2026-11-25T13:30:00.000Z'),
      type: 'event', // ImportantDate enum allows: 'holiday', 'event', 'meeting', 'deadline', 'other'
      priority: 'critical',
      startTime: '08:30',
      endTime: '13:30',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Sunday (Weekly Off)',
      description: 'Weekly scheduled off',
      date: new Date('2026-11-22T00:00:00.000Z'),
      endDate: new Date('2026-11-22T23:59:59.000Z'),
      type: 'holiday',
      priority: 'low',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Constitution Day Special Assembly',
      description: 'Preamble recitation and student mock parliament',
      date: new Date('2026-11-26T08:00:00.000Z'),
      endDate: new Date('2026-11-26T10:00:00.000Z'),
      type: 'event',
      priority: 'normal',
      startTime: '08:00',
      endTime: '10:00',
      location: 'School Assembly Ground',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    },
    {
      title: 'Sunday (Weekly Off)',
      description: 'Weekly scheduled off',
      date: new Date('2026-11-29T00:00:00.000Z'),
      endDate: new Date('2026-11-29T23:59:59.000Z'),
      type: 'holiday',
      priority: 'low',
      schoolId,
      applyToAllClasses: true,
      createdBy: admin._id
    }
  ];

  await ImportantDate.insertMany(events);
  console.log(`✅ Successfully seeded ${events.length} academic calendar events for November 2026!`);

  process.exit(0);
}

seedCalendar().catch(err => {
  console.error('Seed calendar error:', err);
  process.exit(1);
});

