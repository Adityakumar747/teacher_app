import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { colors, radius, typography, shadows } from '../theme/colors';

/**
 * Reusable Confirmation Dialog
 * Used for "Mark All Present" override warning, unsaved changes, etc.
 */
export default function ConfirmDialog({
  visible = false,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  activeOpacity={0.7}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    isDestructive ? styles.destructiveButton : styles.confirmButton,
                  ]}
                  activeOpacity={0.8}
                  onPress={onConfirm}
                >
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 79, 0.45)', // navy backdrop tint
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 22,
    ...shadows.dropdownMenu,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    color: colors.navy,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontFamily.medium,
    color: colors.muted,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.divider,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
    color: colors.navy,
  },
  confirmButton: {
    backgroundColor: colors.blue,
  },
  destructiveButton: {
    backgroundColor: colors.red,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
});

