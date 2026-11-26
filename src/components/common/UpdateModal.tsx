/**
 * UpdateModal.tsx
 *
 * Themed dialog that displays app update information: new version tag,
 * release notes, and actions to download/install the update or dismiss.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Button } from './Button';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';
import { AppUpdateInfo } from '../../types/updates';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
  onUpdate: () => void;
}

export const UpdateModal = ({
  visible,
  updateInfo,
  onClose,
  onUpdate,
}: UpdateModalProps) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (!updateInfo) return null;

  const isForced = updateInfo.isForced;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isForced ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <FontAwesome5 name="rocket" size={32} color={colors.primary} />
          </View>

          {/* Title & Version */}
          <Text style={styles.title}>Update Available</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>
              v{updateInfo.currentVersion} ➔ v{updateInfo.latestVersion}
            </Text>
          </View>

          {/* Release Notes */}
          <Text style={styles.notesHeader}>What's New</Text>
          <ScrollView style={styles.notesScroll} contentContainerStyle={styles.notesContent}>
            <Text style={styles.notesText}>
              {updateInfo.releaseNotes?.trim() || 'Bug fixes, speed improvements, and UI enhancements.'}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Update Now"
              variant="primary"
              onPress={onUpdate}
              icon="arrow-alt-circle-down"
              style={styles.actionButton}
            />
            {!isForced && (
              <TouchableOpacity style={styles.laterButton} onPress={onClose}>
                <Text style={styles.laterText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    container: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    versionBadge: {
      backgroundColor: colors.primary + '1A',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 16,
    },
    versionBadgeText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    notesHeader: {
      alignSelf: 'flex-start',
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    notesScroll: {
      width: '100%',
      maxHeight: 140,
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: 20,
    },
    notesContent: {
      padding: 12,
    },
    notesText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textDim,
    },
    actions: {
      width: '100%',
      alignItems: 'center',
    },
    actionButton: {
      width: '100%',
      marginBottom: 8,
    },
    laterButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    laterText: {
      fontSize: 14,
      color: colors.textDim,
      fontWeight: '500',
    },
  });
