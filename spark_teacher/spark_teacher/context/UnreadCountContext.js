import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import ApiService from '../services/api';
import SocketService from '../services/socketService';

// Create context for unread counts
const UnreadCountContext = createContext();

export const useUnreadCount = () => {
  const context = useContext(UnreadCountContext);
  if (!context) {
    throw new Error('useUnreadCount must be used within an UnreadCountProvider');
  }
  return context;
};

// UnreadCount Provider Component
export function UnreadCountProvider({ children }) {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const loadUnreadCounts = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      const response = await ApiService.getUnreadCounts();
      if (response.success && response.data) {
        const total = response.data.total || 0;
        setTotalUnreadCount(total);
      } else {
        setTotalUnreadCount(0);
      }
    } catch (error) {
      console.error('Error loading unread counts:', error);
      setTotalUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Load unread counts when user is authenticated (with delay for better startup performance)
  useEffect(() => {
    if (isAuthenticated && user) {
      // Delay unread count loading to improve startup performance
      const timeoutId = setTimeout(() => {
        loadUnreadCounts();
      }, 1000); // 1 second delay
      
      // Set up interval to refresh unread counts every 30 seconds
      const interval = setInterval(loadUnreadCounts, 30000);
      
      return () => {
        clearTimeout(timeoutId);
        clearInterval(interval);
      };
    } else {
      setTotalUnreadCount(0);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Listen for socket messages to update unread counts in real-time
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNewMessage = () => {
      // Refresh unread counts when a new message arrives
      loadUnreadCounts();
    };

    SocketService.on('direct_message', handleNewMessage);

    return () => {
      SocketService.off('direct_message', handleNewMessage);
    };
  }, [isAuthenticated]);

  const value = {
    totalUnreadCount,
    isLoading,
    refreshUnreadCounts: loadUnreadCounts
  };

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
}
