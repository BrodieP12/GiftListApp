import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { FontAwesome5 } from '@expo/vector-icons';
import {GiftItem, GiftItemUI, ItemClaim} from '../../types/models';
import { useAppTheme } from '../../theme/ThemeContext';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { ThemeColors } from '../../theme/ThemeContext';

interface GiftItemRowProps extends GiftItemUI {
    item: GiftItem;
    claim: ItemClaim;

    onPress: () => void;
    onDelete: (id: string) => void;
    containerStyle?: StyleProp<ViewStyle>;
    cardStyle?: StyleProp<ViewStyle>;
    deleteActionStyle?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<ViewStyle>;
    subTitleStyle?: StyleProp<ViewStyle>;
    revealWidth?: number;

    currentUserId: string;
    isOwner: boolean;
    onToggleClaim: (itemId: string, currentClaimer: string | null) => void;
}

/**
 * Individual Component row for a list item.
 */
export const GiftItemRow = ({ 
    item,
    claim,
    onPress,
    onDelete,
    containerStyle,
    cardStyle,
    deleteActionStyle,
    titleStyle,
    subTitleStyle,
    revealWidth = 100,
    currentUserId,
    isOwner,
    onToggleClaim,
}: GiftItemRowProps) => {
  const { colors } = useAppTheme();

  const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
        <View style={[
          styles.deleteActionContainer,
          { width: revealWidth, backgroundColor: colors.danger },
          deleteActionStyle
        ]}>
          <TouchableOpacity
              style={styles.deleteActionButton}
              onPress={() => onDelete(item.id)}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <FontAwesome5 name="trash" size={24} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        </View>
    );
  };

  const isClaimed = Boolean(claim.claimedBy);
  const isClaimedByMe = claim.claimedBy === currentUserId;
  const displayPrice = item.price != undefined && item.price > 0 ? `$${item.price.toFixed(2)}` : 'Price Undetermined';

  const handleLinkPress = async () => {
    if (item.url) {
        const canOpen = await Linking.canOpenURL(item.url);
        if (canOpen) {
          Linking.openURL(item.url);
        }
    }
  };

  return (
    <View style={[
      styles.card, 
      { backgroundColor: colors.card, shadowColor: colors.border },
      isClaimed && !isClaimedByMe && styles.cardDimmed
    ]}>
      {/* Image Section */}
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.image} />
      ) : (
        <View style={[styles.placeholderImage, { backgroundColor: colors.background }]}>
          <FontAwesome5 name="image" size={24} color={colors.textDim} />
          <Text style={[styles.placeholderText, { color: colors.textDim }]}>No Image</Text>
        </View>
      )}

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.price}>{displayPrice}</Text>
        </View>

        {item.description ? (
          <Text style={[styles.description, { color: colors.textDim }]} numberOfLines={3}>{item.description}</Text>
        ) : null}

        <View style={styles.badgeRow}>
          {item.substitutions && (
            <View style={styles.subBadge}>
              <FontAwesome5 name="sync-alt" size={10} color="#1e8e3e" style={{ marginRight: 4 }} />
              <Text style={styles.subBadgeText}>Substitutions OK</Text>
            </View>
          )}
          {item.url && (
            <TouchableOpacity onPress={handleLinkPress} style={styles.linkContainer}>
              <FontAwesome5 name="link" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.linkText, { color: colors.primary }]}>View Link</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Claim Action */}
      {!isOwner && (
        <TouchableOpacity 
          style={[
            styles.claimBtn,
            { backgroundColor: colors.primary }, 
            isClaimedByMe ? [styles.claimBtnMine, { backgroundColor: colors.danger }] : isClaimed ? styles.claimBtnTaken : null
          ]}
          onPress={() => onToggleClaim(item.id, claim.claimedBy || null)}
          disabled={isClaimed && !isClaimedByMe}
        >
          <Text style={[
            styles.claimBtnText,
            isClaimed && !isClaimedByMe && styles.claimBtnTextTaken
          ]}>
            {isClaimedByMe ? 'Unclaim' : isClaimed ? 'Claimed' : 'Claim'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  cardDimmed: {
    opacity: 0.6,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  description: {
    fontSize: 13,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  subBadge: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subBadgeText: {
    fontSize: 11,
    color: '#1e8e3e',
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  claimBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  claimBtnMine: {
    // dynamically applied
  },
  claimBtnTaken: {
    backgroundColor: '#e0e0e0',
  },
  claimBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  claimBtnTextTaken: {
    color: '#888',
  },
  deleteActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  deleteActionButton: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});