const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const http = require('http');

// Models
const User = require('../models/User');
const TeacherLeave = require('../models/TeacherLeave');

// Routes
const teacherRoutes = require('../routes/teachers');
const leaveRoutes = require('../routes/leaves');

const app = express();
app.use(express.json());

// Mount routes
app.use('/api/teachers', teacherRoutes);
app.use('/api/leaves', leaveRoutes);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ success: false, error: err.message });
});

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    console.log('[Test Setup] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Test Setup] Connected.');

    // 1. Fetch Demo Teacher & School Admin
    const teacher = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacher) throw new Error('Demo teacher not found. Run seed script first.');

    let admin = await User.findOne({ role: 'school_admin', schoolId: teacher.schoolId });
    if (!admin) {
      admin = await User.create({
        name: 'School Admin Test',
        email: 'schooladmin_test@spark.edu',
        password: 'Password123!',
        phone: '+919999900001',
        role: 'school_admin',
        schoolId: teacher.schoolId,
        isActive: true,
      });
    }

    // Create a temporary secondary teacher to test isolation
    let otherTeacher = await User.findOne({ email: 'other_teacher_test@spark.edu' });
    if (!otherTeacher) {
      otherTeacher = await User.create({
        name: 'Other Teacher Test',
        email: 'other_teacher_test@spark.edu',
        password: 'Password123!',
        phone: '+919999900002',
        role: 'teacher',
        schoolId: teacher.schoolId,
        isActive: true,
      });
    }

    const teacherToken = jwt.sign(
      { id: teacher._id, role: teacher.role, schoolId: teacher.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const otherTeacherToken = jwt.sign(
      { id: otherTeacher._id, role: otherTeacher.role, schoolId: otherTeacher.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminToken = jwt.sign(
      { id: admin._id, role: admin.role, schoolId: admin.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('\n======================================================');
    console.log(' SUITE 1: Teacher Profile & Weekly Timetable API');
    console.log('======================================================');

    // Test GET /api/teachers/me
    const meRes = await fetch(`${baseUrl}/api/teachers/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const meData = await meRes.json();

    assert(meRes.status === 200, 'GET /api/teachers/me returns 200 OK');
    assert(meData.success === true, 'Response indicates success: true');
    assert(meData.data && meData.data.teacher, 'Contains teacher personal details');
    assert(meData.data.teacher.email === 'teacher@spark.edu', 'Teacher email matches teacher@spark.edu');
    assert(Array.isArray(meData.data.classes), 'Contains array of assigned classes');
    assert(meData.data.classes.length > 0, `Teacher has ${meData.data.classes?.length} assigned classes`);
    assert(Array.isArray(meData.data.subjects), 'Contains array of assigned subjects');
    assert(meData.data.subjects.length > 0, `Teacher has ${meData.data.subjects?.length} assigned subjects`);
    assert(meData.data.timetableByDay && typeof meData.data.timetableByDay === 'object', 'Contains timetableByDay grouped dictionary');
    assert(Array.isArray(meData.data.timetableByDay['1']), 'timetableByDay has Monday slots (day 1)');
    assert(meData.data.stats && meData.data.stats.classesCount >= 1, 'Stats contains valid classesCount');
    assert(meData.data.stats.weeklySlotsCount >= 1, 'Stats contains valid weeklySlotsCount');

    // Test GET /api/teachers/profile alias
    const profileRes = await fetch(`${baseUrl}/api/teachers/profile`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const profileData = await profileRes.json();
    assert(profileRes.status === 200, 'GET /api/teachers/profile alias returns 200 OK');
    assert(profileData.data.teacher.id.toString() === teacher._id.toString(), 'Profile ID matches teacher ID');

    console.log('\n======================================================');
    console.log(' SUITE 2: Leave Listing & Status Filters');
    console.log('======================================================');

    const listRes = await fetch(`${baseUrl}/api/leaves`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const listData = await listRes.json();

    assert(listRes.status === 200, 'GET /api/leaves returns 200 OK');
    assert(listData.success === true, 'Response indicates success: true');
    assert(Array.isArray(listData.data), 'Returns leaves array');
    assert(listData.data.length >= 3, `Returns at least 3 seeded leaves (found ${listData.data.length})`);
    assert(listData.pagination && listData.pagination.total >= 3, 'Contains pagination metadata');

    // Filter by status: pending
    const pendingRes = await fetch(`${baseUrl}/api/leaves?status=pending`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const pendingData = await pendingRes.json();
    assert(pendingRes.status === 200, 'GET /api/leaves?status=pending returns 200 OK');
    const allPending = pendingData.data.every((l) => l.status === 'pending');
    assert(allPending && pendingData.data.length >= 1, 'All filtered leaves have status "pending"');

    // Filter by status: approved
    const approvedRes = await fetch(`${baseUrl}/api/leaves?status=approved`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const approvedData = await approvedRes.json();
    assert(approvedRes.status === 200, 'GET /api/leaves?status=approved returns 200 OK');
    const allApproved = approvedData.data.every((l) => l.status === 'approved');
    assert(allApproved && approvedData.data.length >= 1, 'All filtered leaves have status "approved"');

    console.log('\n======================================================');
    console.log(' SUITE 3: Leave Application & Validation Rules');
    console.log('======================================================');

    // Validation 1: Missing fields
    const missingRes = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ reason: 'Vacation' }),
    });
    assert(missingRes.status === 400, 'POST /api/leaves rejects missing dates with 400');

    // Validation 2: fromDate > toDate
    const invertedRes = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        fromDate: '2027-05-10',
        toDate: '2027-05-05',
        reason: 'Invalid inverted dates',
      }),
    });
    assert(invertedRes.status === 400, 'POST /api/leaves rejects fromDate > toDate with 400');

    // Validation 3: Leave completely in the past
    const pastRes = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        fromDate: '2020-01-01',
        toDate: '2020-01-05',
        reason: 'Applying for historical leave in past',
      }),
    });
    assert(pastRes.status === 400, 'POST /api/leaves rejects leave in the past with 400');

    // Successful leave application (in the future)
    const futureFrom = new Date();
    futureFrom.setDate(futureFrom.getDate() + 10);
    const futureTo = new Date();
    futureTo.setDate(futureTo.getDate() + 12);

    const applyRes = await fetch(`${baseUrl}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        fromDate: futureFrom.toISOString(),
        toDate: futureTo.toISOString(),
        leaveType: 'sick',
        reason: 'Medical recovery and dental checkup',
      }),
    });
    const applyData = await applyRes.json();

    assert(applyRes.status === 201, 'POST /api/leaves successfully creates leave with 201 Created');
    assert(applyData.data && applyData.data.status === 'pending', 'Created leave has initial status "pending"');
    assert(applyData.data.leaveType === 'sick', 'Created leave has correct leaveType "sick"');
    assert(applyData.data.teacherId.toString() === teacher._id.toString(), 'Leave is bound to teacherId');

    const createdLeaveId = applyData.data._id;

    console.log('\n======================================================');
    console.log(' SUITE 4: Single Leave Inspection & Isolation Rules');
    console.log('======================================================');

    // Own teacher can view
    const singleRes = await fetch(`${baseUrl}/api/leaves/${createdLeaveId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(singleRes.status === 200, 'Teacher can view own leave application with 200 OK');

    // Other teacher is blocked from viewing
    const otherRes = await fetch(`${baseUrl}/api/leaves/${createdLeaveId}`, {
      headers: { Authorization: `Bearer ${otherTeacherToken}` },
    });
    assert(otherRes.status === 403, 'Other teacher is blocked with 403 Forbidden (isolation check)');

    console.log('\n======================================================');
    console.log(' SUITE 5: Leave Approval & Rejection Workflow');
    console.log('======================================================');

    // Teacher cannot approve own leave
    const teacherApproveRes = await fetch(`${baseUrl}/api/leaves/${createdLeaveId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert(teacherApproveRes.status === 403, 'Teacher cannot approve leave (403 Forbidden)');

    // School admin can approve leave
    const adminApproveRes = await fetch(`${baseUrl}/api/leaves/${createdLeaveId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    const adminApproveData = await adminApproveRes.json();
    assert(adminApproveRes.status === 200, 'Admin can approve leave with 200 OK');
    assert(adminApproveData.data.status === 'approved', 'Leave status changed to approved');
    assert(adminApproveData.data.approvedBy.toString() === admin._id.toString(), 'approvedBy records admin ID');
    assert(Boolean(adminApproveData.data.approvedAt), 'approvedAt timestamp is recorded');

    // Clean up created test leave and test user
    await TeacherLeave.findByIdAndDelete(createdLeaveId);
    await User.findByIdAndDelete(otherTeacher._id);

    console.log('\n======================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run error:', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests();
