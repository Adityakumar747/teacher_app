import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';
import SocketService from '../services/socketService';

export default function DirectChatScreen({ route, navigation }) {
  const { contact } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  console.log('📱 Teacher DirectChatScreen - Full user object:', JSON.stringify(user, null, 2));
  console.log('📱 Teacher DirectChatScreen - Contact object:', JSON.stringify(contact, null, 2));
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (contact) {
      loadMessages();
      setupSocketListeners();
    }
    
    return () => {
      // Cleanup socket listeners
      SocketService.off('direct_message');
    };
  }, [contact]);

  const setupSocketListeners = () => {
    // Listen for direct messages only
    const handleDirectMessage = (data) => {
      if (data.success && data.message) {
        // Check if message is for this chat
        const isFromContact = data.message.sender._id === contact.id;
        const isToContact = data.message.recipient === contact.id;
        const isFromMe = data.message.sender._id === user.id;
        
        // Only allow teacher and student messages - parent messaging removed
        const isCorrectSenderRole = (contact.type === 'student' && (data.message.senderDisplayType === 'student' || data.message.senderDisplayType === 'teacher'));
        
        // Show message if it's from contact, to contact, or from me (teacher)
        console.log('📱 Teacher: Message check:', {
          isFromContact,
          isToContact,
          isFromMe,
          isCorrectSenderRole,
          contactId: contact.id,
          senderId: data.message.sender._id,
          recipientId: data.message.recipient,
          userId: user.id,
          senderRole: data.message.senderRole,
          senderModel: data.message.senderModel,
          senderDisplayType: data.message.senderDisplayType,
          contactType: contact.type
        });
        
        if ((isFromContact || isToContact || isFromMe) && isCorrectSenderRole) {
          setMessages(prev => {
            const messageExists = prev.some(msg => msg._id === data.message._id);
            if (messageExists) {
              console.log('⚠️ Teacher: Direct message already exists, skipping duplicate:', data.message._id);
              return prev;
            }
            const newMessages = [...prev, data.message];
            
            // Auto-scroll to bottom when new message arrives
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
            
            return newMessages;
          });
        }
      }
    };

    SocketService.on('direct_message', handleDirectMessage);
  };

  const loadMessages = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      console.log('📥 Teacher: Loading direct messages with contact:', contact.id);
      
      // Load messages for the conversation - we need both teacher and contact messages
      // Don't filter by senderRole to include both teacher and contact messages
      const queryParams = {
        page: pageNum,
        limit: 50
      };
      
      // Note: We don't set senderRole filter here because we want both teacher and contact messages
      
      const response = await ApiService.getDirectMessages(contact.id, queryParams);
      
      if (response.success) {
        console.log('✅ Teacher: Direct messages loaded successfully:', response.data);
        
        // Only show student and teacher messages - parent messaging removed
        let filteredMessages = response.data;
        if (contact.type === 'student') {
          // For student chats, only show student and teacher messages
          filteredMessages = response.data.filter(msg => 
            msg.senderDisplayType === 'student' || 
            msg.senderDisplayType === 'teacher'
          );
          console.log('📱 Teacher: Filtered student chat messages:', filteredMessages.length);
        }
        
        if (pageNum === 1) {
          setMessages(filteredMessages);
          
          // Auto-scroll to bottom after messages load
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          setMessages(prev => [...filteredMessages, ...prev]);
        }
        setHasMore(filteredMessages.length === 50);
      } else {
        console.error('❌ Teacher: Failed to load direct messages:', response);
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Teacher: Error loading direct messages:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsSending(true);
      const messageContent = newMessage.trim();
      console.log('📤 Teacher: Sending direct message:', messageContent, 'to contact:', contact.id);
      console.log('📤 Teacher: Current user:', user);
      console.log('📤 Teacher: User role:', user.role);
      console.log('📤 Teacher: User ID:', user.id);
      console.log('📤 Teacher: User _id:', user._id);
      
      // Clear input immediately for better UX
      setNewMessage('');
      
      // Try WebSocket first, fallback to API
      if (SocketService.isSocketConnected()) {
        console.log('📤 Teacher: Sending via WebSocket');
        SocketService.sendDirectMessage(
          messageContent,
          contact.id,
          contact.type,
          'text'
        );
      } else {
        console.log('📤 Teacher: WebSocket not connected, using API');
        const messageData = {
          content: messageContent,
          recipientId: contact.id,
          recipientType: contact.type,
          messageType: 'text'
        };
        
        const response = await ApiService.sendDirectMessage(messageData);
        console.log('✅ Teacher: Direct message sent successfully via API:', response);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      console.error('❌ Teacher: Error sending direct message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Restore message if sending failed
      setNewMessage(newMessage);
    } finally {
      setIsSending(false);
    }
  };

  const loadMoreMessages = () => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMessages(nextPage);
    }
  };

  const formatTime = (date) => {
    const messageDate = new Date(date);
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const renderMessage = (message, index) => {
    console.log('📱 Teacher: ===== MESSAGE DEBUG =====');
    console.log('📱 Teacher: Message senderModel:', message.senderModel);
    console.log('📱 Teacher: Message senderRole:', message.senderRole);
    console.log('📱 Teacher: Message sender._id:', message.sender._id);
    console.log('📱 Teacher: Message sender.id:', message.sender?.id);
    console.log('📱 Teacher: Message sender.name:', message.sender?.name);
    console.log('📱 Teacher: Current user.id:', user.id);
    console.log('📱 Teacher: Current user._id:', user._id);
    console.log('📱 Teacher: Current user.role:', user.role);
    
    // Use senderRole to identify if message is from teacher
    // Teacher messages have senderRole: "teacher", student/parent messages have senderRole: "student" or "parent"
    const isMe = message.senderRole === "teacher" && message.sender._id === user.id;
    console.log('📱 Teacher: Final isMe:', isMe);
    console.log('📱 Teacher: ========================');
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDate = !prevMessage || 
      formatDate(message.createdAt) !== formatDate(prevMessage.createdAt);

    return (
      <View key={message._id}>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(message.createdAt)}</Text>
          </View>
        )}
        <View style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.otherMessage
        ]}>
          {!isMe && (
            <View style={styles.senderAvatar}>
              <Text style={styles.avatarText}>
                {(message.sender.name || contact.name).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.otherBubble
          ]}>
            {!isMe && (
              <Text style={styles.senderName}>
                {message.sender.name || contact.name}
              </Text>
            )}
            <Text style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.otherMessageText
            ]}>
              {message.content}
            </Text>
            <Text style={[
              styles.messageTime,
              isMe ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatTime(message.createdAt)}
              {message.isEdited && ' (edited)'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Don't show loading screen - always show the chat interface
  // Loading will be handled within the FlatList

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.contactName}>{contact?.name || 'Unknown'}</Text>
          <Text style={styles.contactSubtitle}>
            {contact?.type === 'student' ? `Roll: ${contact?.rollNumber || 'N/A'}` : 'Student'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item, index }) => renderMessage(item, index)}
          keyExtractor={(item) => item._id}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && styles.emptyContent
          ]}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.1}
          showsVerticalScrollIndicator={false}
          inverted={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No messages yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Start a conversation with {contact?.name}
                </Text>
              </View>
            )
          }
        />

        {/* Message Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              style={styles.messageInput}
              placeholderTextColor="#999"
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendMessage}
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="send" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    minHeight: 60,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
    lineHeight: 22,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#8E8E93',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  messageInput: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  sendButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
});
