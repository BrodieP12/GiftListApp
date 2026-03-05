import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Linking, 
  Alert 
} from 'react-native';
import { GiftItemUI } from '../../types/models';

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
    <View style={[styles.container, isTaken && styles.containerDimmed]}>
      {/* 1. Item Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        
        {/* Price & Link Row */}
        <View style={styles.metaRow}>
          {item.price ? (
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          ) : null}
          
          {item.url && (
            <TouchableOpacity onPress={handleOpenLink}>
              <Text style={styles.link}>View Online ↗</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Action Section */}
      <View style={styles.actionContainer}>
        {renderActionButton()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    // Shadow for depth
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  containerDimmed: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  infoContainer: {
    flex: 1,
    paddingRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    color: '#2E7D32', // Green
    fontWeight: '600',
    marginRight: 12,
  },
  link: {
    fontSize: 14,
    color: '#007AFF',
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