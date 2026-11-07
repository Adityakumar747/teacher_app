const firebaseAdmin = require('../config/firebase-admin');

/**
 * Synchronizes a user account from MongoDB to Firebase Authentication.
 * If the user already exists in Firebase, it does nothing.
 * Otherwise, it creates a new Firebase account with the provided email and password.
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's plain text password
 * @param {string} name - User's display name
 * @param {boolean} emailVerified - Whether the user should be marked as verified (default: false)
 * @returns {Promise<object|null>} - The Firebase user record or null if skipped/failed
 */
const syncToFirebase = async (email, password, name, emailVerified = false) => {
  try {
    if (!email || !password) {
      console.warn('⚠️ Missing email or password for Firebase sync.');
      return null;
    }

    // Check if user already exists in Firebase
    try {
      const userRecord = await firebaseAdmin.auth().getUserByEmail(email.toLowerCase());
      console.log(`ℹ️ User ${email} already exists in Firebase (UID: ${userRecord.uid}).`);
      return userRecord;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user in Firebase
    const firebaseUser = await firebaseAdmin.auth().createUser({
      email: email.toLowerCase(),
      password: password,
      displayName: name || email.split('@')[0],
      emailVerified: emailVerified,
    });

    console.log(`🔥 Successfully created Firebase user for: ${email} (UID: ${firebaseUser.uid}, Verified: ${emailVerified})`);
    return firebaseUser;
  } catch (error) {
    console.error(`❌ Firebase sync error for ${email}:`, error.message);
    return null;
  }
};

module.exports = {
  syncToFirebase
};
