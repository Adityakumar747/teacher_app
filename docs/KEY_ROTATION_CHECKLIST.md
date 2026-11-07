# Secret & API Key Rotation Guide

This checklist outlines the procedures for rotating production keys and credentials. Never commit real keys or credentials to the repository.

---

### 1. JWT Secret (`JWT_SECRET`)
- **Location:** Environment variable on hosting provider (e.g. Render, Railway, AWS ECS).
- **Generation:**
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- **Rotation Steps:**
  1. Generate new 64-byte hex string.
  2. Update `JWT_SECRET` in production environment configuration.
  3. Restart backend service.
  4. Note: Existing user JWTs will become invalid; users will need to re-login once.

---

### 2. MongoDB Atlas Connection URI (`MONGODB_URI`)
- **Location:** Database access credentials on MongoDB Atlas dashboard.
- **Rotation Steps:**
  1. Navigate to **Atlas Console** -> **Database Access**.
  2. Create a new user with `readWrite` permissions on database `erp`.
  3. Copy the updated connection string with the new user credentials.
  4. Update `MONGODB_URI` in production environment variables.
  5. Redeploy backend and verify `/health` endpoint responds with 200.
  6. Delete the old database user from the Atlas console.

---

### 3. Firebase Admin SDK Service Account
- **Location:** `backend/config/firebase-service-account.json` (or `FIREBASE_SERVICE_ACCOUNT` env var).
- **Rotation Steps:**
  1. Open **Firebase Console** -> **Project Settings** -> **Service Accounts**.
  2. Click **Generate New Private Key**.
  3. Securely store the downloaded JSON key.
  4. Upload key to production secrets manager or update backend configuration.
  5. Delete the old key ID in the Google Cloud IAM console.

---

### 4. Cloudinary Media Credentials
- **Location:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- **Rotation Steps:**
  1. Open **Cloudinary Console** -> **Settings** -> **Access Keys**.
  2. Generate a new API Key & Secret.
  3. Update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in production environment variables.
  4. Verify signed upload endpoint: `POST /api/uploads/sign`.
  5. Disable the previous API key from Cloudinary console.

