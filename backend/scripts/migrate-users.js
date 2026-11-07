const mongoose = require('mongoose');
const admin = require('../config/firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../config.env') });

// Import Models
const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function migrate() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp';
    const projectId = process.env.FIREBASE_PROJECT_ID || "your-firebase-project-id";

    console.log('\nðŸš€ Starting Migration Script');
    console.log('---------------------------');
    console.log(`ðŸ“‚ MongoDB URI: ${mongoURI}`);
    console.log(`ðŸ”¥ Firebase Project: ${projectId}`);
    console.log('---------------------------\n');

    const answer = await new Promise((resolve) => {
      rl.question('âš ï¸  Are you sure you want to migrate users from this MongoDB to this Firebase Project? (yes/no): ', resolve);
    });

    if (answer.toLowerCase() !== 'yes') {
      console.log('âŒ Migration cancelled.');
      process.exit(0);
    }

    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('âœ… Connected to MongoDB');

    // Fetch all users with passwords
    console.log('ðŸ” Fetching users from MongoDB...');
    const users = await User.find({}).select('+password');
    const students = await Student.find({}).select('+password');
    const parents = await Parent.find({}).select('+password');

    const allUsers = [...users, ...students, ...parents];
    console.log(`ðŸ“Š Found ${allUsers.length} total users to migrate.`);

    if (allUsers.length === 0) {
      console.log('â„¹ï¸  No users found to migrate.');
      process.exit(0);
    }

    // Format for Firebase Import
    const userImportRecords = allUsers.map(user => {
      return {
        uid: user._id.toString(),
        email: user.email.toLowerCase(),
        passwordHash: Buffer.from(user.password), // Bcrypt hash string
        displayName: user.name,
        emailVerified: true, // Mark migrated users as verified
      };
    });

    // Import in batches of 1000 (Firebase limit)
    const batchSize = 1000;
    for (let i = 0; i < userImportRecords.length; i += batchSize) {
      const batch = userImportRecords.slice(i, i + batchSize);
      console.log(`ðŸ“¤ Importing batch ${Math.floor(i / batchSize) + 1}...`);
      
      const results = await admin.auth().importUsers(batch, {
        hash: {
          algorithm: 'BCRYPT'
        }
      });

      console.log(`âœ… Batch complete: ${results.successCount} succeeded, ${results.failureCount} failed.`);
      
      if (results.failureCount > 0) {
        results.errors.forEach((err) => {
          console.error(`  - Failed to import ${batch[err.index].email}: ${err.error.message}`);
        });
      }
    }

    console.log('\nðŸŽ‰ Migration process finished!');
    process.exit(0);

  } catch (error) {
    console.error('âŒ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

