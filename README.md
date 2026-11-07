# Spark ERP — Teacher App

Mobile application built with React Native (Expo) for teachers.

## Tech Stack

- **Mobile:** React Native + Expo
- **Backend:** Node.js + Express.js
- **Database:** MongoDB
- **Auth:** Firebase Authentication
- **Storage:** Cloudinary

## Project Structure

```
Intern4_TeacherApp/
├── spark_teacher/      # React Native app
└── backend/            # Node.js backend
```

## Getting Started

### 1. Backend

```bash
cd backend
```

Open `config.env` and fill in your credentials:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=any_random_secret_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

Open `config/firebase-admin.js` and replace the `serviceAccount` object with your Firebase service account JSON.  
Download it from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

```bash
npm install
node index.js
```

Server runs on `http://localhost:5000`

---

### 2. Teacher App

```bash
cd spark_teacher/spark_teacher
```

Open `config/firebase.js` and add your Firebase config.

Find your API base URL in the `services/` folder and update it to your machine's local IP address.  
Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your IP.  
Example: `http://192.168.1.10:5000`

> **Note:** Do not use `localhost` — it won't work on a physical device or emulator.

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone, or press `a` for Android emulator.

---

## Free Accounts You'll Need

| Service | Link |
|---------|------|
| MongoDB Atlas | https://www.mongodb.com/atlas |
| Firebase | https://console.firebase.google.com |
| Cloudinary | https://cloudinary.com |
| Expo Go App | https://expo.dev/go |

## API Testing

Use [Postman](https://www.postman.com/downloads/) to test backend endpoints.  
Base URL: `http://localhost:5000/api`
