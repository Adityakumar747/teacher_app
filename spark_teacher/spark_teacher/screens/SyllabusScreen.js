import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';

export default function SyllabusScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [syllabus, setSyllabus] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSyllabus();
  }, []);

  const loadSyllabus = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${currentYear + 1}`;
      
      const response = await ApiService.getTeacherSyllabus({ academicYear });
      
      if (response.success) {
        setSyllabus(response.data || []);
      }
    } catch (error) {
      console.error('Error loading syllabus:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSyllabus();
    setRefreshing(false);
  };

  const handleSyllabusPress = (item) => {
    navigation.navigate('SyllabusDetail', { syllabus: item });
  };

  const renderSyllabusItem = ({ item }) => {
    const classDisplay = item.classId?.name && item.classId?.section
      ? `${item.classId.name} ${item.classId.section}`
      : item.classId?.name || 'Unknown Class';
    
    const subjectDisplay = item.subjectId?.name || 'Unknown Subject';
    const subjectCode = item.subjectId?.code || '';

    return (
      <TouchableOpacity
        style={styles.syllabusCard}
        onPress={() => handleSyllabusPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.syllabusCardHeader}>
          <View style={styles.syllabusIcon}>
            <Ionicons name="book-outline" size={24} color="#007AFF" />
          </View>
          <View style={styles.syllabusInfo}>
            <Text style={styles.subjectName}>{subjectDisplay}</Text>
            {subjectCode ? (
              <Text style={styles.subjectCode}>{subjectCode}</Text>
            ) : null}
            <Text style={styles.className}>{classDisplay}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </View>
        
        <View style={styles.syllabusMeta}>
          {item.academicYear && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
              <Text style={styles.metaText}>{item.academicYear}</Text>
            </View>
          )}
          {item.contentType && (
            <View style={styles.metaItem}>
              <Ionicons 
                name={
                  item.contentType === 'upload_content' 
                    ? 'cloud-upload-outline'
                    : item.contentType === 'assignment'
                    ? 'document-text-outline'
                    : item.contentType === 'lesson_plan'
                    ? 'calendar-outline'
                    : 'book-outline'
                } 
                size={14} 
                color="#8E8E93" 
              />
              <Text style={styles.metaText}>
                {item.contentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.topicsPreview}>
          {item.topics && item.topics.length > 0 && (
            <Text style={styles.topicsCount}>
              {item.topics.length} {item.topics.length === 1 ? 'topic' : 'topics'}
            </Text>
          )}
          {item.documents && item.documents.length > 0 && (
            <Text style={styles.topicsCount}>
              {item.documents.length > 0 && item.topics && item.topics.length > 0 ? ' • ' : ''}
              {item.documents.length} {item.documents.length === 1 ? 'file' : 'files'}
            </Text>
          )}
          {item.learningObjectives && item.learningObjectives.length > 0 && (
            <Text style={styles.topicsCount}>
              {(item.topics && item.topics.length > 0) || (item.documents && item.documents.length > 0) ? ' • ' : ''}
              {item.learningObjectives.length} {item.learningObjectives.length === 1 ? 'objective' : 'objectives'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading syllabus...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1f3a" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1a1f3a', '#2d3561']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Curriculum</Text>
          {user?.school?.name && (
            <Text style={styles.schoolNameSubtitle}>{user.school.name}</Text>
          )}
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      {syllabus.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="book-outline" size={80} color="#E5E5EA" />
          </View>
          <Text style={styles.emptyStateText}>No curriculum assigned yet.</Text>
        </View>
      ) : (
        <FlatList
          data={syllabus}
          renderItem={renderSyllabusItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>My Syllabus</Text>
              <Text style={styles.sectionSubtitle}>
                {syllabus.length} {syllabus.length === 1 ? 'syllabus' : 'syllabi'} assigned
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  headerGradient: {
    paddingTop: 0, // Will be set dynamically
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginLeft: -40, // Center title accounting for back button
  },
  schoolNameSubtitle: {
    position: 'absolute',
    bottom: 4,
    left: 60,
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  syllabusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  syllabusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syllabusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  syllabusInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  subjectCode: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  className: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  syllabusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  topicsPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  topicsCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F8F9FA',
  },
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
  },
});

