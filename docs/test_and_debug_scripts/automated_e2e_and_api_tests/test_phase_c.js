const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Student = require('../models/Student');
const { generateToken } = require('../middleware/auth');

async function testPhaseC() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const teacher = await User.findOne({ email: 'teacher@spark.edu' });
  const token = generateToken(teacher);

  console.log('\n--- TEST C2.1: GET /api/teachers/my-class/analytics ---');
  const analyticsRes = await fetch('http://localhost:5000/api/teachers/my-class/analytics', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Analytics status:', analyticsRes.status);
  const analyticsJson = await analyticsRes.json();
  console.log('Class info:', analyticsJson.data?.classInfo);
  console.log('Students analyzed:', analyticsJson.data?.students?.length);
  if (analyticsJson.data?.students?.length) {
    const s0 = analyticsJson.data.students[0];
    console.log('Sample student performance:', {
      name: s0.name,
      rollNumber: s0.rollNumber,
      overallAttendance: s0.overallAttendance + '%',
      isLowAttendance: s0.isLowAttendance,
      homeworkSubmissionRate: s0.homeworkSubmissionRate + '%',
      subjectsCount: s0.subjects?.length
    });
  }

  console.log('\n--- TEST C2.2: GET /api/teachers/my-class/students/:id/attendance ---');
  const firstStudentId = analyticsJson.data?.students?.[0]?._id;
  if (firstStudentId) {
    const breakdownRes = await fetch(`http://localhost:5000/api/teachers/my-class/students/${firstStudentId}/attendance`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Student breakdown status:', breakdownRes.status);
    const breakdownJson = await breakdownRes.json();
    console.log('Student summary:', breakdownJson.data?.student);
    console.log('Subject breakdown:', breakdownJson.data?.subjects);
    console.log('Recent sessions timeline count:', breakdownJson.data?.timeline?.length);
    if (breakdownJson.data?.timeline?.length) {
      console.log('Latest session in timeline:', breakdownJson.data.timeline[0]);
    }
  }

  console.log('\n--- TEST C3: GET /api/calendar/calendar?year=2026&month=11 ---');
  const calendarRes = await fetch('http://localhost:5000/api/calendar/calendar?year=2026&month=11', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Calendar status:', calendarRes.status);
  const calendarJson = await calendarRes.json();
  console.log('Total calendar events in month:', calendarJson.data?.events?.length);
  console.log('Dates with event dots:', Object.keys(calendarJson.data?.eventsByDate || {}));
  console.log('Diwali date (2026-11-12):', calendarJson.data?.eventsByDate?.['2026-11-12']);
  console.log('Exam date (2026-11-20):', calendarJson.data?.eventsByDate?.['2026-11-20']);

  console.log('\n--- TEST SECURITY: 401 without token ---');
  const noTokenRes = await fetch('http://localhost:5000/api/teachers/my-class/analytics');
  console.log('No token analytics status:', noTokenRes.status);

  process.exit(0);
}

testPhaseC().catch(err => {
  console.error('Test Phase C error:', err);
  process.exit(1);
});

