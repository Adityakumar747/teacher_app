const admin = require('firebase-admin');

/**
 * Firebase Admin SDK Setup
 *
 * Steps:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use existing)
 * 3. Project Settings > Service Accounts > Generate New Private Key
 * 4. Download the JSON file
 * 5. Paste the contents of that JSON file into the serviceAccount object below
 */

const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');

try {
  if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized successfully');
    }
  } else {
    console.warn('[Firebase Admin] config/serviceAccountKey.json not found.');
    console.warn('Firebase auth verification will be disabled until you download your Firebase private key and place it in backend/config/serviceAccountKey.json');
  }
} catch (error) {
  console.error('Firebase Admin init error:', error.message);
}

module.exports = admin;
