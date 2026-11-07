const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkIndexes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const models = ['AttendanceSession', 'AttendanceRecord', 'Schedule', 'Class', 'Student', 'Assignment', 'AssignmentSubmission', 'TeacherLeave', 'ImportantDate'];
  for (const m of models) {
    try {
      const model = require(`../models/${m}`);
      const indexes = model.schema.indexes();
      console.log(`\nModel [${m}]: ${indexes.length} custom indexes`);
      for (const idx of indexes) {
        console.log(`  - Index:`, JSON.stringify(idx[0]), `Options:`, JSON.stringify(idx[1] || {}));
      }
    } catch (e) {
      console.log(`Model [${m}] error:`, e.message);
    }
  }
  process.exit(0);
}

checkIndexes().catch(console.error);

