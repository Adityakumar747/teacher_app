import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return;
      }

      const WS_BASE_URL = API_BASE_URL.replace('/api', '');

      this.socket = io(WS_BASE_URL, {
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 3,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.emit('connection_status', { connected: true });
        this.joinGroups();
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emit('connection_status', { connected: false });
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        this.emit('connection_error', error);
      });

      this.socket.on('group_joined', (data) => {
        this.emit('group_joined', data);
      });

      this.socket.on('groups_joined', (data) => {
        this.emit('groups_joined', data);
      });

      this.socket.on('new_assignment', (data) => {
        this.emit('new_assignment', data);
      });

      this.socket.on('assignment_submitted', (data) => {
        this.emit('assignment_submitted', data);
      });

      this.socket.on('new_notification', (data) => {
        this.emit('new_notification', data);
      });

      this.socket.on('new_message', (data) => {
        this.emit('new_message', data);
      });

      this.socket.on('direct_message', (data) => {
        this.emit('direct_message', data);
      });

      this.socket.on('messages_read', (data) => {
        this.emit('messages_read', data);
      });

      this.socket.on('user_typing', (data) => {
        this.emit('user_typing', data);
      });

      this.socket.on('user_stopped_typing', (data) => {
        this.emit('user_stopped_typing', data);
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
      });

    } catch (error) {
      this.isConnected = false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  joinGroups() {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_groups');
    }
  }

  joinGroup(groupId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_group', { groupId });
    }
  }

  leaveGroup(groupId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_group', { groupId });
    }
  }

  sendMessage(content, groupId, messageType = 'text', replyTo = null) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', { content, groupId, messageType, replyTo });
    }
  }

  sendDirectMessage(content, recipientId, recipientType, messageType = 'text', replyTo = null) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_direct_message', {
        content,
        recipientId,
        recipientType,
        messageType,
        replyTo,
      });
    }
  }

  markMessagesAsRead(groupId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_messages_read', { groupId });
    }
  }

  startTyping(groupId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { groupId });
    }
  }

  stopTyping(groupId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { groupId });
    }
  }

  isSocketConnected() {
    return !!(this.socket && this.isConnected && this.socket.connected);
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

export default new SocketService();
