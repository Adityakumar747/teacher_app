import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

        <Text style={styles.intro}>
          Spark ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
          explains how we collect, use, and safeguard your information when you use the Spark
          Teacher mobile application.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.body}>
          We collect the following types of information:{'\n\n'}
          â€¢ Account Information: Name, email address, employee ID, and role.{'\n'}
          â€¢ Profile Data: Profile photos and subject/class assignments.{'\n'}
          â€¢ Usage Data: App interactions, feature usage, and session information.{'\n'}
          â€¢ Device Information: Device type, operating system, and push notification tokens.{'\n'}
          â€¢ Files & Media: Documents and images you upload for notes and assignments.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use your information to:{'\n\n'}
          â€¢ Provide and maintain the Spark Teacher platform.{'\n'}
          â€¢ Enable real-time communication with students and parents.{'\n'}
          â€¢ Manage attendance, assignments, and class notes.{'\n'}
          â€¢ Improve app performance and user experience.
        </Text>

        <Text style={styles.sectionTitle}>3. Data Sharing</Text>
        <Text style={styles.body}>
          We do not sell your personal data. We share data only with:{'\n\n'}
          â€¢ Your school administration (as part of the platform's purpose).{'\n'}
          â€¢ Firebase (Google) for authentication and cloud services.{'\n'}
          â€¢ Service providers who assist in operating our platform, under strict confidentiality agreements.
        </Text>

        <Text style={styles.sectionTitle}>4. Firebase & Third-Party Services</Text>
        <Text style={styles.body}>
          We use Firebase Authentication and Firebase Cloud Messaging. Your data is processed
          according to Google's Privacy Policy (policies.google.com/privacy).
        </Text>

        <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.body}>
          We implement industry-standard security measures including HTTPS encryption, secure
          token-based authentication, and regular security reviews to protect your data.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights</Text>
        <Text style={styles.body}>
          You have the right to:{'\n\n'}
          â€¢ Access your personal data.{'\n'}
          â€¢ Request correction of inaccurate data.{'\n'}
          â€¢ Request deletion of your account and data.{'\n'}
          â€¢ Opt out of push notifications via device settings.
        </Text>

        <Text style={styles.sectionTitle}>7. Data Retention</Text>
        <Text style={styles.body}>
          We retain your data for as long as your account is active or as needed to provide services.
          Upon account deletion, your data is removed within 30 days.
        </Text>

        <Text style={styles.sectionTitle}>8. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about this Privacy Policy, please contact us at:{'\n\n'}
          Email: support@yourcompany.com{'\n'}
          Website: https://yourcompany.com
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
  },
  intro: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    marginTop: 8,
  },
  body: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 22,
    marginBottom: 20,
  },
});

