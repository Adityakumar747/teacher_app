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
  if (!admin.apps.length) {
    // 1. Check if FIREBASE_SERVICE_ACCOUNT environment variable is set (Raw JSON or Base64)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(jsonStr);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('[Firebase Admin] SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT environment variable');
      } catch (envErr) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', envErr.message);
      }
    }

    // 2. Check if local serviceAccountKey.json file exists on disk
    if (!admin.apps.length && fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase Admin] SDK initialized successfully from serviceAccountKey.json');
    }

    // 3. Fallback: Initialize with Project ID for Google token verification
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'sparkology-4a447';
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`[Firebase Admin] SDK initialized with projectId "${projectId}" (public token verification mode)`);
    }
  }
} catch (error) {
  console.error('[Firebase Admin] Init error:', error.message);
}

module.exports = admin;
