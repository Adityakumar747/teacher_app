import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  sendPasswordResetEmail,
  signOut,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const inFlightExchangeRef = React.useRef(null);

  // Deduplicated backend token exchange
  const performBackendExchange = async (idToken) => {
    if (inFlightExchangeRef.current) {
      return inFlightExchangeRef.current;
    }
    inFlightExchangeRef.current = ApiService.firebaseLogin(idToken)
      .finally(() => {
        inFlightExchangeRef.current = null;
      });
    return inFlightExchangeRef.current;
  };

  useEffect(() => {
    // Register 401 handler to clear state on unauthorized API calls
    ApiService.setUnauthorizedHandler(() => {
      console.log('🔒 Logged out due to 401 Unauthorized');
      setUser(null);
      setIsAuthenticated(false);
    });

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('🔥 Firebase Auth: User is signed in:', firebaseUser.email);
        
        // Fetch custom ID Token to send to our backend
        try {
          const idToken = await firebaseUser.getIdToken();
          
          // Authenticate with our backend using deduplicated token exchange
          const response = await performBackendExchange(idToken);
          
          if (response.success) {
            setUser(response.data.user);
            await AsyncStorage.setItem('authToken', response.data.token);
            setIsAuthenticated(true);
          } else {
            console.error('❌ Backend auth failed after Firebase login:', response.error);
            await signOut(auth);
          }
        } catch (error) {
          console.error('❌ Error during Firebase background auth:', error);
        }
      } else {
        console.log('🔥 Firebase Auth: User is signed out');
        setIsAuthenticated(false);
        setUser(null);
        await AsyncStorage.removeItem('authToken');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async () => {
    try {
      // Try to get teacher profile first, fallback to getMe if needed
      try {
        const response = await ApiService.getTeacherProfile();
        if (response.success) {
          setUser(response.data.teacher);
        } else {
          await AsyncStorage.removeItem('authToken');
          setIsAuthenticated(false);
        }
      } catch (profileError) {
        // Fallback to generic user endpoint
        const response = await ApiService.getMe();
        if (response.success) {
          setUser(response.data.user);
        } else {
          await AsyncStorage.removeItem('authToken');
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('User profile load error:', error);
      await AsyncStorage.removeItem('authToken');
      setIsAuthenticated(false);
    }
  };

  const login = async (email, password) => {
    try {
      // 1. Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;
      
      // 2. Get ID Token
      const idToken = await firebaseUser.getIdToken();
      
      // 3. Authenticate with our backend (deduplicated)
      const response = await performBackendExchange(idToken);
      
      if (response.success) {
        const userData = response.data.user;
        const token = response.data.token;
        
        await AsyncStorage.setItem('authToken', token);
        setUser(userData);
        setIsAuthenticated(true);
        
        return { 
          success: true, 
          user: userData,
          emailVerified: firebaseUser.emailVerified 
        };
      } else {
        // If backend fails, sign out from Firebase
        await signOut(auth);
        return { 
          success: false, 
          error: response.error || 'Server rejected login. Please contact school administration.',
          isUnverified: response.error === 'email_not_verified'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Incorrect email or password. Please try again.';
      
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        errorMessage = 'Incorrect email or password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please wait a moment and try again.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message) {
        errorMessage = error.message.replace(/^Firebase:\s*/i, '');
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, error: error.message };
    }
  };

  const resendVerificationEmail = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        return { success: true };
      }
      return { success: false, error: 'No user signed in' };
    } catch (error) {
      console.error('Resend verification error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // 1. Notify backend logout endpoint while token is still active
      try {
        await ApiService.logout();
      } catch (backendErr) {
        console.warn('Backend logout call note:', backendErr?.message || backendErr);
      }
      // 2. Sign out of Firebase Auth
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 3. Clear all cached tokens and user data
      try {
        await AsyncStorage.multiRemove(['authToken', 'userData', 'teacherProfile', 'lastUser']);
      } catch (storageErr) {
        console.error('Storage clear error:', storageErr);
      }
      // 4. Reset React state & navigation
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    if (userData) {
      AsyncStorage.setItem('userData', JSON.stringify(userData));
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    forgotPassword,
    resendVerificationEmail,
    firebaseUser: auth.currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
