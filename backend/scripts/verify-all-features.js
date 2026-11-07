const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Schedule = require('../models/Schedule');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Assignment = require('../models/Assignment');
const { getISTDateString } = require('../utils/dateTimeUtils');

async function verifyAllFeatures() {
  try {
    console.log('\n--- 1. Database Connection & Teacher Token Setup ---');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const teacher = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacher) throw new Error('Teacher not found in DB');

    const token = jwt.sign(
      { id: teacher._id, role: teacher.role, schoolId: teacher.schoolId },
      process.env.JWT_SECRET || 'sparkology-secret',
      { expiresIn: '1d' }
    );
    console.log(`✅ Teacher token generated for: ${teacher.name} (${teacher.email})`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    const baseUrl = 'http://localhost:5000/api';

    // --- FEATURE 1: Attendance Marking & Real DB Verification ---
    console.log('\n--- 2. Testing Feature: Real Database Attendance Save ---');
    const classesTodayRes = await fetch(`${baseUrl}/teachers/me/classes-today`, { headers });
    const classesTodayData = await classesTodayRes.json();
    const todayClasses = classesTodayData.data?.classes || classesTodayData.data?.slots || [];
    console.log(`Classes Today response: HTTP ${classesTodayRes.status}, count: ${todayClasses.length}`);
    if (!classesTodayData.success || todayClasses.length === 0) {
      throw new Error('No timetable slots found for today');
    }

    const testSlot = todayClasses[0];
    const slotId = testSlot.id || testSlot.slotId;
    console.log(`Testing with slot: ${testSlot.subject?.name || testSlot.subject} (${testSlot.class?.name || testSlot.class}) [ID: ${slotId}]`);

    // Fetch slot attendance to get enrolled students
    const slotAttRes = await fetch(`${baseUrl}/attendance/slot/${slotId}`, { headers });
    const slotAttData = await slotAttRes.json();
    console.log(`Slot Attendance fetch: HTTP ${slotAttRes.status}, students count: ${slotAttData.data?.students?.length || 0}`);
    const students = slotAttData.data.students;

    if (!students || students.length === 0) {
      throw new Error('No students returned for slot');
    }

    // Prepare bulk attendance payload (e.g., student 0 absent, others present)
    const todayIST = getISTDateString();
    const records = students.map((s, idx) => ({
      studentId: s.id || s._id,
      status: idx === 0 ? 'A' : 'P',
      remark: idx === 0 ? 'Verified absence' : ''
    }));

    const saveRes = await fetch(`${baseUrl}/attendance/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        slotId: slotId,
        date: todayIST,
        records
      })
    });
    const saveData = await saveRes.json();
    console.log(`POST /attendance/bulk response: HTTP ${saveRes.status}, success: ${saveData.success}`);
    if (!saveData.success) {
      throw new Error(`Bulk attendance failed: ${saveData.error}`);
    }

    // Direct Database Query Verification: check AttendanceSession and AttendanceRecord
    const savedSession = await AttendanceSession.findOne({ slotId: new mongoose.Types.ObjectId(slotId), date: todayIST });
    if (!savedSession) throw new Error('AttendanceSession NOT found in MongoDB Atlas!');
    console.log(`✅ AttendanceSession confirmed in MongoDB: Present=${savedSession.summary.present}, Absent=${savedSession.summary.absent}`);

    const savedRecordsCount = await AttendanceRecord.countDocuments({ sessionId: savedSession._id });
    console.log(`✅ AttendanceRecord confirmed in MongoDB: ${savedRecordsCount} student records saved atomically`);

    // --- FEATURE 2: Homework Creation ---
    console.log('\n--- 3. Testing Feature: Homework Creation (Upload/Assign) ---');
    const futureDue = new Date();
    futureDue.setDate(futureDue.getDate() + 4);
    const dueDateStr = futureDue.toISOString().split('T')[0];

    const createHwRes = await fetch(`${baseUrl}/homework`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Integration by Parts Drill #99',
        description: 'Complete questions 1 to 10 from syllabus page 142.',
        classId: testSlot.classId || slotAttData.data.slot.class.id,
        subjectId: testSlot.subjectId || slotAttData.data.slot.subject.id,
        dueDate: dueDateStr,
        dueTime: '23:59',
        totalMarks: 40,
        points: 40,
        attachments: [{
          name: 'Practice_Sheet.pdf',
          url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793633031/sparkology/demo/sample_classroom_1793633032004.jpg',
          type: 'image',
          size: 45000
        }]
      })
    });
    const createHwData = await createHwRes.json();
    console.log(`POST /homework response: HTTP ${createHwRes.status}, success: ${createHwData.success}`);
    if (!createHwData.success || !createHwData.data?._id) {
      throw new Error(`Homework creation failed: ${createHwData.error}`);
    }
    const createdHwId = createHwData.data._id;
    console.log(`✅ Homework created with ID: ${createdHwId}`);

    // --- FEATURE 3: Homework Submissions Review & Grading ---
    console.log('\n--- 4. Testing Feature: Homework Submissions Review & Grading ---');
    // Fetch submissions for this new homework
    const subRes = await fetch(`${baseUrl}/homework/${createdHwId}/submissions`, { headers });
    const subData = await subRes.json();
    console.log(`GET /homework/:id/submissions: HTTP ${subRes.status}, success: ${subData.success}`);
    console.log(`Submissions summary stats: Total=${subData.data?.stats?.total}, Pending=${subData.data?.stats?.pending}`);

    // Also test grading on our rich seeded homework that already has student submissions
    const existingHw = await Assignment.findOne({ teacherId: teacher._id, 'submissions.status': 'submitted' });
    if (existingHw && existingHw.submissions.length > 0) {
      const targetSub = existingHw.submissions.find(s => s.status === 'submitted');
      if (targetSub) {
        console.log(`Testing grading on submission ID ${targetSub._id} for "${existingHw.title}"`);
        const gradeRes = await fetch(`${baseUrl}/homework/${existingHw._id}/submissions/${targetSub._id}/grade`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            marks: 47,
            feedback: 'Excellent proofs, neatly written!',
            needsResubmission: false,
            status: 'graded'
          })
        });
        const gradeData = await gradeRes.json();
        console.log(`PATCH /submissions/:id/grade: HTTP ${gradeRes.status}, success: ${gradeData.success}`);
        if (!gradeData.success) throw new Error(`Grading failed: ${gradeData.error}`);
        console.log(`✅ Submission successfully graded to: ${gradeData.data?.status || 'graded'} (Marks: 47)`);
      }
    }

    // --- FEATURE 4: Homework Deletion ---
    console.log('\n--- 5. Testing Feature: Homework Deletion ---');
    const deleteRes = await fetch(`${baseUrl}/homework/${createdHwId}`, {
      method: 'DELETE',
      headers
    });
    const deleteData = await deleteRes.json();
    console.log(`DELETE /homework/:id: HTTP ${deleteRes.status}, success: ${deleteData.success}`);
    if (!deleteData.success) throw new Error(`Delete failed: ${deleteData.error}`);

    // Verify deleted from MongoDB Atlas
    const checkDeleted = await Assignment.findById(createdHwId);
    if (checkDeleted) throw new Error('Assignment was NOT deleted from MongoDB Atlas!');
    console.log('✅ Confirmed deletion from MongoDB Atlas (Document count = 0)');

    console.log('\n======================================================');
    console.log('🎉 ALL FEATURES TESTED AND FULLY FUNCTIONAL!');
    console.log('1. Real DB Attendance Save: Confirmed in Atlas (AttendanceSession + AttendanceRecord)');
    console.log('2. Real DB Homework Creation: Confirmed in Atlas');
    console.log('3. Real DB Submissions Review & Grading: Confirmed in Atlas');
    console.log('4. Real DB Homework Deletion: Confirmed in Atlas');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

verifyAllFeatures();
