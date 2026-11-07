import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import ApiService from '../services/api';

export default function NoteDetailScreen({ route, navigation }) {
  const { noteId } = route.params;
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [updatingAttachments, setUpdatingAttachments] = useState(false);

  useEffect(() => {
    loadNoteDetails();
  }, [noteId]);

  const loadNoteDetails = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getNoteById(noteId);
      if (response.success) {
        setNote(response.data);
        setEditedTitle(response.data.title);
        setEditedContent(response.data.content);
      } else {
        Alert.alert('Error', 'Failed to load note details');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading note:', error);
      Alert.alert('Error', 'Failed to load note details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editedTitle.trim() || !editedContent.trim()) {
      Alert.alert('Error', 'Title and content cannot be empty');
      return;
    }

    try {
      setUpdating(true);
      
      // If there are selected files to upload, use the file upload method
      if (selectedFiles.length > 0) {
        const response = await ApiService.updateNoteWithFiles(noteId, {
          title: editedTitle.trim(),
          content: editedContent.trim(),
          classId: note.classId._id,
          subjectId: note.subjectId._id
        }, selectedFiles);

        if (response.success) {
          setNote(response.data);
          setSelectedFiles([]);
          setIsEditing(false);
          Alert.alert('Success', 'Note and attachments updated successfully!');
        } else {
          Alert.alert('Error', response.error || 'Failed to update note');
        }
      } else {
        // Update note without new files
        const response = await ApiService.updateNote(noteId, {
          title: editedTitle.trim(),
          content: editedContent.trim(),
        });

        if (response.success) {
          setNote(response.data);
          setIsEditing(false);
          Alert.alert('Success', 'Note updated successfully!');
        } else {
          Alert.alert('Error', response.error || 'Failed to update note');
        }
      }
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'Failed to update note');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await ApiService.deleteNote(noteId);

      if (response.success) {
        Alert.alert('Success', 'Note deleted successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Failed to delete note');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(note.title);
    setEditedContent(note.content);
    setIsEditing(false);
    setSelectedFiles([]);
    // Reset any attachment changes - reload note to get original state
    loadNoteDetails();
  };

  const handleSelectFiles = async () => {
    try {
      // Check if we already have 5 files total (existing + new)
      const totalFiles = (note.attachments?.length || 0) + selectedFiles.length;
      if (totalFiles >= 5) {
        Alert.alert('Limit Reached', 'You can only attach up to 5 files per note.');
        return;
      }

      console.log('Opening document picker for note attachments...');

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });

      console.log('Note DocumentPicker result:', JSON.stringify(result, null, 2));

      // Check result type
      if (result.type === 'cancel') {
        console.log('File selection was canceled');
        return;
      }

      if (result.canceled === true) {
        console.log('File selection was canceled (canceled flag)');
        return;
      }

      // Handle different result structures
      if (result.assets && result.assets.length > 0) {
        // New API structure
        const file = result.assets[0];
        const newFile = {
          name: file.name || 'Unknown File',
          uri: file.uri,
          size: file.size || 0,
          type: file.mimeType || 'application/pdf'
        };
        
        console.log('📎 Adding file to note:', newFile);
        setSelectedFiles(prev => [...prev, newFile]);
      } else if (result.uri) {
        // Legacy API structure
        const newFile = {
          name: result.name || 'Unknown File',
          uri: result.uri,
          size: result.size || 0,
          type: result.type || 'application/pdf'
        };
        
        console.log('📎 Adding file to note (legacy):', newFile);
        setSelectedFiles(prev => [...prev, newFile]);
      } else {
        console.log('📎 No valid file data found in result');
        Alert.alert('Error', 'No file selected');
      }
    } catch (error) {
      console.error('Error selecting files for note:', error);
      Alert.alert('Error', 'Failed to select file: ' + error.message);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (attachmentIndex) => {
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingAttachments(true);
              const updatedAttachments = note.attachments.filter((_, index) => index !== attachmentIndex);
              
              const response = await ApiService.updateNoteAttachments(noteId, updatedAttachments);
              
              if (response.success) {
                setNote(prev => ({
                  ...prev,
                  attachments: updatedAttachments
                }));
                Alert.alert('Success', 'Attachment removed successfully!');
              } else {
                Alert.alert('Error', response.error || 'Failed to remove attachment');
              }
            } catch (error) {
              console.error('Error removing attachment:', error);
              Alert.alert('Error', 'Failed to remove attachment');
            } finally {
              setUpdatingAttachments(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateAttachments = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert('No Changes', 'No new files selected to upload.');
      return;
    }

    try {
      setUpdatingAttachments(true);
      
      const response = await ApiService.updateNoteWithFiles(noteId, {
        title: note.title,
        content: note.content,
        classId: note.classId._id,
        subjectId: note.subjectId._id
      }, selectedFiles);

      if (response.success) {
        setNote(response.data);
        setSelectedFiles([]);
        Alert.alert('Success', 'Attachments updated successfully!');
      } else {
        Alert.alert('Error', response.error || 'Failed to update attachments');
      }
    } catch (error) {
      console.error('Error updating attachments:', error);
      Alert.alert('Error', 'Failed to update attachments');
    } finally {
      setUpdatingAttachments(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading note...</Text>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#8E8E93" />
        <Text style={styles.errorText}>Note not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Note Details</Text>
        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="create-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowDeleteModal(true)}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCancelEdit}
                disabled={updating}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#34C759" />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Note Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="book-outline" size={20} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Subject</Text>
                <Text style={styles.infoValue}>{note.subjectId?.name || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people-outline" size={20} color="#34C759" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Class</Text>
                <Text style={styles.infoValue}>
                  {note.classId?.name} {note.classId?.section}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={20} color="#FF9500" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValueSmall}>{formatDate(note.createdAt)}</Text>
              </View>
            </View>
          </View>

          {note.updatedAt && note.updatedAt !== note.createdAt && (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={20} color="#AF52DE" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Last Updated</Text>
                  <Text style={styles.infoValueSmall}>{formatDate(note.updatedAt)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Title Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title</Text>
          {isEditing ? (
            <TextInput
              style={styles.titleInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Enter note title"
              editable={!updating}
            />
          ) : (
            <Text style={styles.titleText}>{note.title}</Text>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Content</Text>
          {isEditing ? (
            <TextInput
              style={styles.contentInput}
              value={editedContent}
              onChangeText={setEditedContent}
              placeholder="Enter note content"
              multiline
              textAlignVertical="top"
              editable={!updating}
            />
          ) : (
            <View style={styles.contentContainer}>
              <Text style={styles.contentText}>{note.content}</Text>
            </View>
          )}
        </View>

        {/* Attachments Section */}
        <View style={styles.section}>
          <View style={styles.attachmentsHeader}>
            <Text style={styles.sectionLabel}>Attachments</Text>
            <TouchableOpacity 
              style={styles.addAttachmentButton}
              onPress={handleSelectFiles}
              disabled={updatingAttachments || ((note.attachments?.length || 0) + selectedFiles.length >= 5)}
            >
              <Ionicons name="add" size={16} color="#007AFF" />
              <Text style={styles.addAttachmentText}>Add File</Text>
            </TouchableOpacity>
          </View>

          {/* Existing Attachments */}
          {note.attachments && note.attachments.length > 0 ? (
            <View style={styles.attachmentsList}>
              {note.attachments.map((attachment, index) => (
                <View key={index} style={styles.attachmentItem}>
                  <View style={styles.attachmentInfo}>
                    <Ionicons name="document-text" size={20} color="#007AFF" />
                    <View style={styles.attachmentDetails}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.fileName}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(attachment.fileSize)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeAttachmentButton}
                    onPress={() => removeExistingAttachment(index)}
                    disabled={updatingAttachments}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAttachmentsText}>No attachments</Text>
          )}

          {/* Selected Files (New) - Only show during edit mode */}
          {isEditing && selectedFiles.length > 0 && (
            <View style={styles.selectedFilesSection}>
              <Text style={styles.selectedFilesTitle}>New Files to Add:</Text>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.selectedFileItem}>
                  <View style={styles.attachmentInfo}>
                    <Ionicons name="document-text" size={20} color="#34C759" />
                    <View style={styles.attachmentDetails}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(file.size)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeSelectedFileButton}
                    onPress={() => removeSelectedFile(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.editHintText}>
                Files will be uploaded when you save the note
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="warning-outline" size={48} color="#FF3B30" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Note?</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete this note? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.cancelDeleteButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 0, // Will be set dynamically
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  infoValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 28,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    minHeight: 200,
  },
  contentText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  contentInput: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    backgroundColor: '#F8F9FA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  deleteIconContainer: {
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalActions: {
    flexDirection: 'row',
    width: '100%',
  },
  cancelDeleteButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingVertical: 14,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 14,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  attachmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addAttachmentText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  attachmentsList: {
    marginBottom: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#8E8E93',
  },
  removeAttachmentButton: {
    padding: 4,
  },
  noAttachmentsText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  selectedFilesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  selectedFilesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 8,
  },
  selectedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  removeSelectedFileButton: {
    padding: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  editHintText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
});

