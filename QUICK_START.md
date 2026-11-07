# Sparkology - Plug & Play Quick Start Guide

This package is completely pre-configured with live MongoDB Atlas and Cloudinary media storage.
**No manual configuration, keys, or database setup are needed.**

---

### Step 1: Start the Backend Server

Open Terminal 1:
```bash
cd backend
npm install
npm start
```
*The server will start on `http://localhost:5000` with live MongoDB Atlas connected.*

> **To verify backend and Postman tests (optional):**
> ```bash
> npm test            # Runs full regression suite (26/26 PASS)
> npm run test:postman # Runs all 53 Postman automated assertions (53/53 PASS)
> ```

---

### Step 2: Start the Mobile App

Open Terminal 2:
```bash
cd spark_teacher/spark_teacher
npm install
npx expo start
```

Once Metro bundler starts:
- Press **`w`** on your keyboard to launch in your browser instantly.
- Press **`a`** to launch in an Android Emulator.
- Or scan the terminal QR code with the **Expo Go** app on your physical device (ensure phone and PC are connected to the same Wi-Fi network).

---

### Step 3: Demo Teacher Login Credentials

- **Email:** `teacher@spark.edu`
- **Password:** `teacher123`

*(All schedules, classes, students, assignments, and attendance records are already seeded and live in Atlas).*

