import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';
import { ProductMatchCandidate } from '../../services/RetailerService';
import { getRetailerDisplayName } from '../../constants/retailers';

interface Props {
  visible: boolean;
  searchQuery: string;
  candidates: ProductMatchCandidate[];
  onSelect: (match: ProductMatchCandidate) => void;
  onClose: () => void;
}

export const ProductMatchModal = ({
  visible,
  searchQuery,
  candidates,
  onSelect,
  onClose,
}: Props) => {
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { color: colors.text }]}>Select Matching Listing</Text>
              {!!searchQuery && (
                <Text style={[styles.sub, { color: colors.textDim }]} numberOfLines={1}>
                  Searched: {searchQuery}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <FontAwesome5 name="times" size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ gap: 10 }}>
            {candidates.map((item) => (
              <TouchableOpacity
                key={item.url}
                style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => onSelect(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.retailer, { color: colors.primary }]} numberOfLines={1}>
                    {getRetailerDisplayName(item.retailer)}
                  </Text>
                  <Text style={[styles.price, { color: colors.text }]}>
                    {item.price !== null ? `$${item.price.toFixed(2)}` : 'Price N/A'}
                  </Text>
                </View>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {!!item.description && (
                  <Text style={[styles.desc, { color: colors.textDim }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: colors.textDim }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  heading: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  list: { marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  retailer: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  price: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12, lineHeight: 16 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
});