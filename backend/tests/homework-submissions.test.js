const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const http = require('http');

// Models
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');

// Routes
const assignmentRoutes = require('../routes/assignments');
const uploadRoutes = require('../routes/upload');

const app = express();
app.use(express.json());

// Mount routes with aliases per API contract
app.use('/api/homework', assignmentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/upload', uploadRoutes);

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

    const teacher = await User.findOne({ email: 'teacher@spark.edu' });
    if (!teacher) throw new Error('Demo teacher not found. Run seed script first.');

    const teacherToken = jwt.sign(
      { id: teacher._id, role: teacher.role, schoolId: teacher.schoolId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1h' }
    );

    let otherTeacher = await User.findOne({ email: 'other.teacher@spark.edu' });
    if (!otherTeacher) {
      otherTeacher = await User.create({
        name: 'Other Teacher',
        email: 'other.teacher@spark.edu',
        phone: '+919876543298',
        role: 'teacher',
        schoolId: teacher.schoolId,
        password: 'password123'
      });
    }

    const otherTeacherToken = jwt.sign(
      { id: otherTeacher._id, role: otherTeacher.role, schoolId: otherTeacher.schoolId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1h' }
    );

    const demoClass = await Class.findOne({ schoolId: teacher.schoolId });
    const demoSubject = await Subject.findOne({ teacherId: teacher._id, schoolId: teacher.schoolId });
    let demoAssignment = await Assignment.findOne({ teacherId: teacher._id, title: 'Calculus & Algebra Practice' });
    const demoStudents = await Student.find({ classId: demoClass._id, status: 'active' });

    // Ensure idempotent test state
    if (demoAssignment && demoStudents.length >= 3) {
      demoAssignment.submissions = [
        {
          studentId: demoStudents[0]._id,
          submittedAt: new Date(Date.now() - 3 * 3600 * 1000),
          attachments: [{ name: 'Math_Calculus_Rahul.pdf', url: 'https://example.com/math.pdf', type: 'pdf', size: 120000 }],
          marks: null,
          pointsEarned: 50,
          feedback: '',
          status: 'submitted',
          needsResubmission: false
        },
        {
          studentId: demoStudents[1]._id,
          submittedAt: new Date(Date.now() - 1 * 3600 * 1000),
          attachments: [{ name: 'Algebra_Priya.pdf', url: 'https://example.com/algebra.pdf', type: 'pdf', size: 80000 }],
          marks: null,
          pointsEarned: 25,
          feedback: '',
          status: 'late',
          needsResubmission: false
        },
        {
          studentId: demoStudents[2]._id,
          submittedAt: new Date(Date.now() - 24 * 3600 * 1000),
          attachments: [{ name: 'Homework_Amit.pdf', url: 'https://example.com/amit.pdf', type: 'pdf', size: 95000 }],
          marks: 46,
          pointsEarned: 50,
          feedback: 'Great calculus notation.',
          status: 'graded',
          needsResubmission: false,
          gradedAt: new Date(Date.now() - 10 * 3600 * 1000),
          gradedBy: teacher._id
        }
      ];
      demoAssignment.totalMarks = 50;
      demoAssignment.points = 50;
      await demoAssignment.save();
    }

    console.log('\n--- Test Suite 1: Cloudinary Signed Upload Endpoint (/api/uploads/sign) ---');
    {
      // 1. Generate signature
      const res = await fetch(`${baseUrl}/api/uploads/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({ folder: 'sparkology/homework', fileType: 'pdf' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.success === true, 'Upload signature endpoint returns 200 with success: true');
      assert(data.data && data.data.signature && data.data.timestamp, 'Upload signature includes signature and timestamp');
      assert(data.data.maxFileSize === 10485760, 'Upload parameters enforce 10MB maxFileSize');
      assert(Array.isArray(data.data.allowedExtensions) && data.data.allowedExtensions.includes('pdf'), 'Allowed extensions include pdf');

      // 2. Reject unsupported file type
      const badRes = await fetch(`${baseUrl}/api/uploads/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({ fileType: 'exe' })
      });
      const badData = await badRes.json();
      assert(badRes.status === 400 && badData.success === false, 'Rejects unsupported file type (.exe) with 400');
    }

    console.log('\n--- Test Suite 2: Homework Creation & Validation (/api/homework) ---');
    {
      // 1. Due date in the past should be blocked
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const pastDueRes = await fetch(`${baseUrl}/api/homework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          title: 'Past Homework Test',
          description: 'This should fail validation',
          classId: demoClass._id,
          subjectId: demoSubject._id,
          dueDate: pastDate.toISOString()
        })
      });
      const pastDueData = await pastDueRes.json();
      assert(pastDueRes.status === 400 && pastDueData.error.includes('past'), 'Blocks homework creation with past dueDate (400)');

      // 2. Create valid homework via /api/homework
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const createRes = await fetch(`${baseUrl}/api/homework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        },
        body: JSON.stringify({
          title: 'Automated Test Homework',
          description: 'Created during test execution',
          classId: demoClass._id,
          subjectId: demoSubject._id,
          dueDate: futureDate.toISOString(),
          dueTime: '20:00',
          totalMarks: 25,
          points: 25,
          attachments: [
            {
              name: 'instructions.pdf',
              url: 'https://example.com/instructions.pdf',
              type: 'pdf',
              size: 45000
            }
          ]
        })
      });
      const createData = await createRes.json();
      assert(createRes.status === 200 || createRes.status === 201, 'Creates homework successfully (200/201)');
      assert(createData.data && createData.data.title === 'Automated Test Homework', 'Created homework has correct title');
      assert(createData.data.attachments.length === 1, 'Created homework includes uploaded attachment');

      // Cleanup test assignment
      if (createData.data && createData.data._id) {
        await Assignment.findByIdAndDelete(createData.data._id);
      }
    }

    console.log('\n--- Test Suite 3: Homework Listing & Stats (/api/homework) ---');
    {
      const listRes = await fetch(`${baseUrl}/api/homework?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      const listData = await listRes.json();
      assert(listRes.status === 200 && listData.success === true, 'List homework returns 200 with success: true');
      assert(Array.isArray(listData.data), 'Returns data array of homework');
      assert(listData.pagination && listData.pagination.total >= 1, 'Includes pagination object with total count');

      const seededItem = listData.data.find((a) => a.title === 'Calculus & Algebra Practice');
      assert(seededItem != null, 'Finds seeded Calculus & Algebra Practice homework');
      if (seededItem) {
        assert(seededItem.totalStudents >= 4, 'Calculates totalStudents for homework');
        assert(seededItem.submittedCount >= 1, 'Calculates submittedCount for homework');
        assert(seededItem.lateCount >= 1, 'Calculates lateCount for homework');
        assert(seededItem.gradedCount >= 1, 'Calculates gradedCount for homework');
        assert(seededItem.pendingCount >= 1, 'Calculates pendingCount for unsubmitted students');
      }
    }

    console.log('\n--- Test Suite 4: Submissions View Grouped by Status (/api/homework/:id/submissions) ---');
    {
      const subRes = await fetch(`${baseUrl}/api/homework/${demoAssignment._id}/submissions`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      const subData = await subRes.json();
      assert(subRes.status === 200 && subData.success === true, 'Submissions endpoint returns 200 with success: true');
      assert(subData.data && subData.data.stats, 'Response includes submission statistics');
      assert(subData.data.stats.total >= 4, 'Total includes all active enrolled class students');
      assert(subData.data.stats.submitted >= 1, 'Stats include at least 1 submitted');
      assert(subData.data.stats.late >= 1, 'Stats include at least 1 late');
      assert(subData.data.stats.graded >= 1, 'Stats include at least 1 graded');
      assert(subData.data.stats.pending >= 1, 'Stats include pending unsubmitted students');

      assert(Array.isArray(subData.data.groups.submitted), 'Groups contain submitted array');
      assert(Array.isArray(subData.data.groups.pending), 'Groups contain pending array');
      assert(Array.isArray(subData.data.groups.late), 'Groups contain late array');
      assert(Array.isArray(subData.data.groups.graded), 'Groups contain graded array');

      // Verify pending student has null submittedAt and pending status
      const pendingStudent = subData.data.groups.pending[0];
      assert(pendingStudent && pendingStudent.status === 'pending' && pendingStudent.submittedAt === null, 'Pending student has null submittedAt and pending status');
    }

    console.log('\n--- Test Suite 5: Submission Grading & Feedback (/api/homework/submissions/:id/grade) ---');
    {
      // Find the submitted item to grade
      const subRes = await fetch(`${baseUrl}/api/homework/${demoAssignment._id}/submissions`, {
        headers: { Authorization: `Bearer ${teacherToken}` }
      });
      const subData = await subRes.json();
      const targetSubmission = subData.data.groups.submitted[0];
      assert(targetSubmission != null, 'Found target un-graded submission');

      if (targetSubmission) {
        // 1. Reject marks greater than totalMarks (totalMarks is 50)
        const overMarksRes = await fetch(`${baseUrl}/api/homework/submissions/${targetSubmission._id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacherToken}`
          },
          body: JSON.stringify({
            marks: 60,
            feedback: 'Exceeds total'
          })
        });
        const overMarksData = await overMarksRes.json();
        assert(overMarksRes.status === 400 && overMarksData.error.includes('cannot exceed'), 'Rejects marks exceeding total marks with 400');

        // 2. Grade valid marks & feedback
        const gradeRes = await fetch(`${baseUrl}/api/homework/submissions/${targetSubmission._id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacherToken}`
          },
          body: JSON.stringify({
            marks: 48,
            feedback: 'Brilliant step-by-step calculus derivation.'
          })
        });
        const gradeData = await gradeRes.json();
        assert(gradeRes.status === 200 && gradeData.success === true, 'Grades submission successfully with 200');
        assert(gradeData.data.marks === 48, 'Recorded marks match updated value');
        assert(gradeData.data.status === 'graded', 'Submission status transitions to graded');
        assert(gradeData.data.feedback.includes('Brilliant'), 'Feedback recorded accurately');

        // 3. Test "Ask to Resubmit"
        const resubmitRes = await fetch(`${baseUrl}/api/homework/submissions/${targetSubmission._id}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacherToken}`
          },
          body: JSON.stringify({
            feedback: 'Please redo question 12 with full working.',
            needsResubmission: true
          })
        });
        const resubmitData = await resubmitRes.json();
        assert(resubmitRes.status === 200 && resubmitData.success === true, 'Resubmission request succeeds with 200');
        assert(resubmitData.data.status === 'resubmit_requested', 'Submission status set to resubmit_requested');
        assert(resubmitData.data.needsResubmission === true, 'needsResubmission flag set to true');
      }
    }

    console.log('\n--- Test Suite 6: Teacher Isolation & Authorization Security ---');
    {
      // Other teacher should NOT be able to view first teacher's assignment submissions
      const unauthorizedSubRes = await fetch(`${baseUrl}/api/homework/${demoAssignment._id}/submissions`, {
        headers: { Authorization: `Bearer ${otherTeacherToken}` }
      });
      assert(unauthorizedSubRes.status === 403, 'Other teacher is blocked from viewing submissions (403 Forbidden)');

      // Other teacher should NOT be able to grade first teacher's assignment submissions
      const sub = demoAssignment.submissions[0];
      const unauthorizedGradeRes = await fetch(`${baseUrl}/api/homework/submissions/${sub._id}/grade`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherTeacherToken}`
        },
        body: JSON.stringify({ marks: 20 })
      });
      assert(unauthorizedGradeRes.status === 403, 'Other teacher is blocked from grading submissions (403 Forbidden)');
    }

    console.log(`\n=========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=========================================\n`);

    server.close();
    await mongoose.disconnect();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[Test Error]:', err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
