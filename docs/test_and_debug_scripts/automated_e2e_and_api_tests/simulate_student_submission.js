/**
 * Dev-Only Simulation Script: Student Submissions
 * Purpose: Simulates realistic student submissions (on-time, late, with attachments)
 * for testing the Teacher Homework Review & Grading lifecycle.
 * Strictly a dev script — not exposed as an HTTP endpoint.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Assignment = require('../models/Assignment');
const Student = require('../models/Student');
const User = require('../models/User');

async function simulateSubmissions() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const teacher = await User.findOne({ email: 'teacher@spark.edu' });
  if (!teacher) {
    console.error('Teacher not found');
    process.exit(1);
  }

  // Find all assignments for this teacher
  const assignments = await Assignment.find({ teacherId: teacher._id });
  if (assignments.length === 0) {
    console.log('No assignments found for teacher');
    process.exit(0);
  }

  for (const assignment of assignments) {
    const students = await Student.find({ classId: assignment.classId, status: 'active' }).sort({ rollNumber: 1 });
    console.log(`\nProcessing assignment: "${assignment.title}" for class with ${students.length} students`);

    const dueDate = new Date(assignment.dueDate);
    const simulatedSubmissions = [];

    // Let's create a realistic distribution:
    // Student 0-5: On-time 'submitted' (ready to be graded)
    // Student 6-8: 'late' (submitted after due date, ready to review)
    // Student 9-11: Already 'graded'
    // Student 12-14: 'pending' (no submission yet)

    students.forEach((student, idx) => {
      if (idx < 5) {
        // On-time submitted
        const submitDate = new Date(dueDate.getTime() - (idx + 1) * 3600 * 1000 * 4);
        simulatedSubmissions.push({
          studentId: student._id,
          submittedAt: submitDate,
          status: 'submitted',
          content: `Attached solutions for ${assignment.title}. Solved all problem sets.`,
          attachments: [
            {
              name: `${student.name.replace(/\s+/g, '_')}_solution.pdf`,
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              type: 'pdf',
              size: 145000
            }
          ],
          marks: null,
          feedback: '',
          needsResubmission: false
        });
      } else if (idx >= 5 && idx < 8) {
        // Late submission
        const submitDate = new Date(dueDate.getTime() + (idx - 4) * 3600 * 1000 * 12);
        simulatedSubmissions.push({
          studentId: student._id,
          submittedAt: submitDate,
          status: 'late',
          content: `Sir, submitted late due to technical issue. Please accept.`,
          attachments: [
            {
              name: `${student.name.replace(/\s+/g, '_')}_worksheet.jpg`,
              url: 'https://res.cloudinary.com/ejoblc6b/image/upload/v1793797384/sparkology/homework/sample_worksheet.jpg',
              type: 'image',
              size: 210000
            }
          ],
          marks: null,
          feedback: '',
          needsResubmission: false
        });
      } else if (idx >= 8 && idx < 11) {
        // Already graded
        const submitDate = new Date(dueDate.getTime() - 24 * 3600 * 1000);
        simulatedSubmissions.push({
          studentId: student._id,
          submittedAt: submitDate,
          status: 'graded',
          content: `Completed assignment on time.`,
          attachments: [
            {
              name: `${student.name.replace(/\s+/g, '_')}_final.pdf`,
              url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              type: 'pdf',
              size: 180000
            }
          ],
          marks: Math.max(35, assignment.totalMarks - (idx * 3)),
          feedback: 'Well reasoned proof steps. Keep up the thorough work.',
          gradedAt: new Date(Date.now() - 3600 * 1000 * 6),
          needsResubmission: false
        });
      }
      // Remaining students (11-14) have no submission (status 'pending')
    });

    assignment.submissions = simulatedSubmissions;
    await assignment.save();
    console.log(`✅ Saved ${simulatedSubmissions.length} simulated submissions for "${assignment.title}"`);
    console.log(`   - Submitted: 5 | Late: 3 | Graded: 3 | Pending: ${students.length - simulatedSubmissions.length}`);
  }

  console.log('\n🎉 Finished simulating student submissions.');
  process.exit(0);
}

simulateSubmissions().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});

