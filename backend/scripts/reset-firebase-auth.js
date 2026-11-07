const admin = require('../config/firebase-admin');
const readline = require('readline');

/**
 * ðŸ§¹ Firebase Auth Cleanup Script
 * This script deletes all users from the Firebase Authentication list.
 * Use this to clear test users before production deployment on VPS.
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function clearAuthUsers() {
  console.log('\nðŸ”¥ Firebase Auth Cleanup Tool');
  console.log('---------------------------');
  console.log(`ðŸ“¡ Project: ${admin.app().options.credential.projectId || 'your-firebase-project-id'}`);
  console.log('---------------------------\n');
  
  const answer = await new Promise((resolve) => {
    rl.question('âš ï¸  CAUTION: This will delete ALL users from Firebase Authentication. This cannot be undone.\n   Type "DELETE ALL" to confirm: ', resolve);
  });

  if (answer !== 'DELETE ALL') {
    console.log('âŒ Cleanup cancelled. No users deleted.');
    process.exit(0);
  }

  console.log('\nðŸ” Fetching users from Firebase...');
  
  let totalDeleted = 0;
  let nextPageToken;
  
  try {
    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      const uids = listUsersResult.users.map(user => user.uid);
      
      if (uids.length > 0) {
        console.log(`ðŸ“¤ Deleting batch of ${uids.length} users...`);
        const deleteResult = await admin.auth().deleteUsers(uids);
        
        totalDeleted += uids.length;
        console.log(`âœ… Batch complete. Subtotal deleted: ${totalDeleted}`);
        
        if (deleteResult.errors.length > 0) {
          console.error(`âš ï¸  Encountered ${deleteResult.errors.length} errors during batch deletion.`);
        }

        // Slight delay to avoid hitting rate limits for very large databases
        await delay(500);
      }
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`\nâœ¨ Success! Total users removed from Firebase: ${totalDeleted}`);
    console.log('---------------------------');
    console.log('ðŸš€ Next step: Run "node scripts/migrate-users.js" to repopulate from your VPS data.');
    console.log('---------------------------\n');
    process.exit(0);
  } catch (error) {
    console.error('\nâŒ Fatal Error during cleanup:', error.message);
    process.exit(1);
  }
}

clearAuthUsers();

