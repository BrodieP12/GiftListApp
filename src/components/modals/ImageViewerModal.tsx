import React from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  imageUri: string | null | undefined;
  onClose: () => void;
}

export const ImageViewerModal = ({ visible, imageUri, onClose }: Props) => {
  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <Pressable style={styles.backdrop} onPress={onClose}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close image"
        >
          <FontAwesome5 name="times" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.imageWrapper} pointerEvents="box-none">
          <Image
            source={{ uri: imageUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '82%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});