const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const { syncToFirebase } = require('../utils/firebaseUtils');

const migrateAll = async () => {
  try {
    console.log('🚀 Starting Universal Firebase Migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // 1. Migrate Users (Admins, Teachers, etc.)
    console.log('--- Migrating Users (Admins/Teachers) ---');
    const users = await User.find({}).select('+password');
    console.log(`Found ${users.length} users.`);
    for (const user of users) {
      if (user.email && user.password) {
        // Existing users are marked as verified: true
        await syncToFirebase(user.email, user.password, user.name, true);
      }
    }

    // 2. Migrate Students
    console.log('\n--- Migrating Students ---');
    const students = await Student.find({}).select('+password');
    console.log(`Found ${students.length} students.`);
    for (const student of students) {
      if (student.email && student.password) {
        const tempPassword = 'User@' + Math.random().toString(36).slice(-8);
        await syncToFirebase(student.email, tempPassword, student.name, true);
      }
    }

    // 3. Migrate Parents
    console.log('\n--- Migrating Parents ---');
    const parents = await Parent.find({}).select('+password');
    console.log(`Found ${parents.length} parents.`);
    for (const parent of parents) {
      if (parent.email && parent.password) {
        const tempPassword = 'User@' + Math.random().toString(36).slice(-8);
        await syncToFirebase(parent.email, tempPassword, parent.name, true);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateAll();
