/**
 * ItemDetailModal.tsx
 *
 * Bottom-sheet modal showing full detail for a single gift item (large
 * image, name, price, description, substitutions badge, external link, and
 * a claim/unclaim button) — an expanded view compared to the compact
 * {@link GiftItemRow} used in list rows. Presence of `item` (non-null)
 * controls the modal's visibility, so the parent screen conditionally
 * renders this by passing the selected item or `null`.
 *
 * Shares the same "owner never sees claims" business rule as GiftItemRow:
 * the claim button is only rendered when `isOwner` is false.
 */
import React from 'react';
import {
  Modal, View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Pressable,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { GiftItemUI, ItemClaim } from '../../types/models';
import { useAppTheme } from '../../theme/ThemeContext';

/**
 * Props for {@link ItemDetailModal}.
 *
 * - `item` is the item to show detail for; passing `null` hides the modal
 *   entirely (the component early-returns `null` in that case — see below).
 * - `isOwner`/`currentUserId` gate and personalize the claim button exactly
 *   as in `GiftItemRow`.
 * - `onToggleClaim` claims/unclaims the item; `onClose` is also called
 *   automatically right after a claim toggle (see below) so the sheet
 *   dismisses once the user acts.
 */
interface Props {
  item: GiftItemUI | null;
  isOwner: boolean;
  currentUserId: string;
  onClose: () => void;
  onToggleClaim: (itemId: string, currentClaimer: string | null) => void;
}

/**
 * Full-detail bottom sheet for a gift item. Renders nothing when `item` is
 * `null` (see the early return below), which lets the parent screen simply
 * keep this component mounted and toggle `item` to open/close it.
 */
export const ItemDetailModal = ({ item, isOwner, currentUserId, onClose, onToggleClaim }: Props) => {
  const { colors } = useAppTheme();

  // No item selected -> render nothing (also implicitly closes the Modal,
  // since `visible={!!item}` below would be false anyway).
  if (!item) return null;

  // `claimStatus` is expected to be null/undefined for the list owner (see
  // file header) so these derived flags read as "unclaimed" for them.
  const claim = item.claimStatus as ItemClaim | null;
  const isClaimed = Boolean(claim?.claimedBy);
  const isClaimedByMe = claim?.claimedBy === currentUserId;
  const displayPrice = item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : 'Price not set';

  const handleLink = async () => {
    if (item.url) {
      const canOpen = await Linking.canOpenURL(item.url);
      if (canOpen) Linking.openURL(item.url);
    }
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <FontAwesome5 name="times" size={18} color={colors.textDim} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.background }]}>
              <FontAwesome5 name="gift" size={48} color={colors.textDim} />
            </View>
          )}

          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{displayPrice}</Text>

          {item.description ? (
            <Text style={[styles.description, { color: colors.textDim }]}>{item.description}</Text>
          ) : null}

          {item.substitutions && (
            <View style={styles.badge}>
              <FontAwesome5 name="sync-alt" size={12} color="#1e8e3e" style={{ marginRight: 6 }} />
              <Text style={styles.badgeText}>Substitutions OK</Text>
            </View>
          )}

          {item.url && (
            <TouchableOpacity style={[styles.linkBtn, { borderColor: colors.primary }]} onPress={handleLink}>
              <FontAwesome5 name="external-link-alt" size={14} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.linkBtnText, { color: colors.primary }]}>Open Link</Text>
            </TouchableOpacity>
          )}

          {/* Claim Action — hidden for the list owner (see file header).
              Tapping it both toggles the claim and immediately closes the
              sheet, since the resulting state change is reflected back in
              the underlying list rather than in this modal. */}
          {!isOwner && (
            <TouchableOpacity
              style={[
                styles.claimBtn,
                { backgroundColor: isClaimedByMe ? colors.danger : isClaimed ? colors.border : colors.primary },
              ]}
              onPress={() => {
                onToggleClaim(item.id, claim?.claimedBy ?? null);
                onClose();
              }}
              disabled={isClaimed && !isClaimedByMe}
            >
              <Text style={[styles.claimBtnText, isClaimed && !isClaimedByMe && { color: colors.textDim }]}>
                {isClaimedByMe ? 'Unclaim' : isClaimed ? 'Already Claimed' : 'Claim This Item'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  badgeText: {
    color: '#1e8e3e',
    fontWeight: '600',
    fontSize: 13,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  linkBtnText: {
    fontWeight: '600',
    fontSize: 15,
  },
  claimBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  claimBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
