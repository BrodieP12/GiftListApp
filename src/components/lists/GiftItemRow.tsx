import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Linking, 
  Alert 
} from 'react-native';
import { GiftItemUI } from '../../types/models'; // Adjust path if necessary
import { useAppTheme } from '../../theme/ThemeContext';

interface GiftItemRowProps {
  item: GiftItemUI;
  isOwner: boolean;
  currentUserId?: string;
  onToggleClaim: (item: GiftItemUI) => void;
}

export const GiftItemRow = ({ 
  item, 
  isOwner, 
  currentUserId, 
  onToggleClaim 
}: GiftItemRowProps) => {

  const { colors, isDarkMode } = useAppTheme();

  // --- DERIVED STATE ---
  const isClaimed = !!item.claimStatus;
  const isClaimedByMe = item.claimStatus?.claimedBy === currentUserId;
  
  // Logic: Item is "Taken" if claimed by someone else
  const isTaken = isClaimed && !isClaimedByMe;

  // --- HANDLERS ---
  const handleOpenLink = () => {
    if (item.url) {
      Linking.openURL(item.url).catch(() => 
        Alert.alert('Error', 'Could not open link.')
      );
    }
  };

  // --- RENDER HELPERS ---
  const renderActionButton = () => {
    if (isOwner) return null; // Owners cannot claim items

    if (isTaken) {
      return (
        <View style={[styles.button, styles.btnTaken]}>
          <Text style={styles.btnTextTaken}>Taken</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.button, isClaimedByMe ? styles.btnUnclaim : styles.btnClaim]}
        onPress={() => onToggleClaim(item)}
      >
        <Text style={styles.btnText}>
          {isClaimedByMe ? 'Unclaim' : 'Claim'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, shadowColor: colors.text }, isTaken && { opacity: 0.6 }]}>
      {/* 1. Item Info Section */}
      <View style={styles.infoContainer}>
        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
        
        {/* Price & Link Row */}
        <View style={styles.metaRow}>
          {item.price ? (
            <Text style={[styles.price, { color: colors.textSecondary }]}>${item.price.toFixed(2)}</Text>
          ) : null}
        </View>
          
        {/* Strict boolean casting prevents an empty string "" from being rendered as a text node */}
        {!!item.url && (
          <TouchableOpacity onPress={handleOpenLink}>
            <Text style={[styles.link, { color: colors.primary }]}>View Online ↗</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Action Section - ADDED PREVIOUSLY MISSING CALL */}
      <View style={styles.actionContainer}>
        {renderActionButton()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  infoContainer: {
    flex: 1,
    paddingRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  link: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  actionContainer: {
    justifyContent: 'center',
    minWidth: 80,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnClaim: {
    backgroundColor: '#007AFF', // Blue
  },
  btnUnclaim: {
    backgroundColor: '#FF9500', // Orange/Warning
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  btnTaken: {
    backgroundColor: '#E0E0E0', // Grey
  },
  btnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextTaken: {
    color: '#757575',
    fontSize: 14,
    fontStyle: 'italic',
  },
});