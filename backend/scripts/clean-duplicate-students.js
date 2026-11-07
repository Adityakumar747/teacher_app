const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function cleanDuplicates() {
  await mongoose.connect(process.env.MONGODB_URI);
  const legacyEmails = ['aarav@spark.edu', 'diya@spark.edu', 'rohan@spark.edu', 'ananya@spark.edu'];
  const res = await mongoose.connection.collection('students').deleteMany({ email: { $in: legacyEmails } });
  console.log('Deleted legacy duplicate students:', res.deletedCount);

  const c = await mongoose.connection.collection('classes').findOne({ name: 'Grade 10', section: 'A' });
  const remaining = await mongoose.connection.collection('students').find({ classId: c._id }).sort({ rollNumber: 1 }).toArray();
  console.log(`Remaining unique students in Class 10-A: ${remaining.length}`);
  console.log(remaining.map(s => `Roll ${s.rollNumber}: ${s.name}`).join('\n'));
  process.exit(0);
}

cleanDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});

