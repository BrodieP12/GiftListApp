/**
 * Row <-> model mappers.
 *
 * Postgres columns are snake_case; the UI models in src/types/models.ts are
 * camelCase. Centralizing the translation here keeps the service layer (and
 * therefore the screens) unchanged in shape.
 */
import type { Database } from '../types/database';
import { GiftList, GiftItem, ItemClaim, User } from '../types/models';
import { convertDate } from '../services/utils';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ListRow = Database['public']['Tables']['lists']['Row'];
type ItemRow = Database['public']['Tables']['items']['Row'];
type ClaimRow = Database['public']['Tables']['claims']['Row'];

export function profileFromRow(row: ProfileRow): User {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    givenName: row.given_name,
    familyName: row.family_name,
    photoURL: row.photo_url,
    birthday: convertDate(row.birthday),
    isPremium: row.is_premium,
    createdAt: convertDate(row.created_at),
    minorProtection: {
      isMinor: row.is_minor,
      parentEmail: row.parent_email,
    },
    legalAcceptance: {
      termsAccepted: row.terms_accepted,
      privacyAccepted: row.privacy_accepted,
      acceptanceDate: convertDate(row.acceptance_date),
      isEUUser: row.is_eu_user,
      gdprApplies: row.gdpr_applies,
      acceptedDataProcessing: row.accepted_data_processing,
    },
  };
}

/** Flattens a User model into a profiles Insert/Update payload. */
export function profileToRow(
  user: Partial<User>
): Database['public']['Tables']['profiles']['Update'] {
  const row: Database['public']['Tables']['profiles']['Update'] = {};
  if (user.email !== undefined) row.email = user.email;
  if (user.displayName !== undefined) row.display_name = user.displayName;
  if (user.givenName !== undefined) row.given_name = user.givenName;
  if (user.familyName !== undefined) row.family_name = user.familyName;
  if (user.photoURL !== undefined) row.photo_url = user.photoURL;
  if (user.birthday !== undefined)
    row.birthday = user.birthday instanceof Date ? user.birthday.toISOString() : user.birthday;
  if (user.isPremium !== undefined) row.is_premium = user.isPremium;
  if (user.minorProtection) {
    row.is_minor = user.minorProtection.isMinor;
    row.parent_email = user.minorProtection.parentEmail;
  }
  if (user.legalAcceptance) {
    row.terms_accepted = user.legalAcceptance.termsAccepted;
    row.privacy_accepted = user.legalAcceptance.privacyAccepted;
    row.acceptance_date =
      user.legalAcceptance.acceptanceDate instanceof Date
        ? user.legalAcceptance.acceptanceDate.toISOString()
        : (user.legalAcceptance.acceptanceDate as string | null);
    row.is_eu_user = user.legalAcceptance.isEUUser;
    row.gdpr_applies = user.legalAcceptance.gdprApplies;
    row.accepted_data_processing = user.legalAcceptance.acceptedDataProcessing;
  }
  return row;
}

export function listFromRow(row: ListRow): GiftList {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    isPrivate: row.is_private,
    shareCode: row.share_code ?? undefined,
    allowedUsers: [], // populated separately from list_members when needed
    clientCreatedAt: row.created_at,
    serverReceivedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function itemFromRow(row: ItemRow): GiftItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    description: row.description,
    price: row.price ?? undefined,
    imageUri: row.image_uri ?? undefined,
    url: row.url ?? undefined,
    clientCreatedAt: row.created_at,
    serverReceivedAt: row.created_at,
    updatedAt: row.updated_at,
    substitutions: row.substitutions,
  };
}

export function claimFromRow(row: ClaimRow): ItemClaim {
  return {
    itemId: row.item_id,
    item: undefined as any, // joined client-side in the UI layer when needed
    claimedBy: row.claimed_by,
    listOwnerId: row.list_owner_id,
    claimedAt: row.claimed_at,
    onToggleClaim: undefined as any,
  };
}
