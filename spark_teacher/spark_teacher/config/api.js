import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Default LAN IP of development machine (auto-detected fallback)
const DEV_LAN_IP = '192.168.1.11';
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEV_LAN_IP}:5000/api`;

const API_CONFIG = {
  web: 'http://localhost:5000/api',
  android_emulator: 'http://10.0.2.2:5000/api',
  device: DEFAULT_API_URL
};

// Helper to extract IP from string
const extractIp = (str) => {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  return match ? match[1] : null;
};

// Detect platform and environment dynamically
const getApiUrl = () => {
  // 1. Environment variable override (highest priority for production / custom deployments)
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;
  if (envApiUrl) {
    return envApiUrl;
  }

  // 2. Web platform
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:5000/api`;
    }
    return 'http://localhost:5000/api';
  }

  // 3. Attempt to resolve debugger host IP from Expo Constants / Linking URI
  const hostSources = [
    Constants.expoConfig?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.linkingUri,
    Constants.experienceUrl
  ];

  for (const source of hostSources) {
    const ip = extractIp(source);
    if (ip && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // 4. Android Emulator (only when running on emulator, not on physical device)
  if (Platform.OS === 'android' && Constants.isDevice === false) {
    return API_CONFIG.android_emulator;
  }

  // 5. Fallback for physical device in Expo Go
  return DEFAULT_API_URL;
};

export default getApiUrl();

