import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ⚠️ IMPORTANT: Create your own Firebase project at https://console.firebase.google.com
// Then go to Project Settings > Your Apps > Web App > Firebase SDK snippet > Config
// Replace the config below with your own Firebase project config

const firebaseConfig = {
  apiKey: "AIzaSyAybxrHjTDL6pv7fzshkfrcaKg9OuaFlos",
  authDomain: "sparkology-4a447.firebaseapp.com",
  projectId: "sparkology-4a447",
  storageBucket: "sparkology-4a447.firebasestorage.app",
  messagingSenderId: "33664505134",
  appId: "1:33664505134:web:eaf3189033fc96532116bf",
  measurementId: "G-MD3GFE214F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with proper persistence for Native or Web
const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web' 
    ? browserLocalPersistence 
    : getReactNativePersistence(AsyncStorage)
});

export { auth };
