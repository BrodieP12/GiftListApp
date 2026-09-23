/**
 * Domain model definitions for the Gift List app.
 *
 * These interfaces mirror the shape of rows returned from Supabase (see
 * src/api/supabase.ts) after they have been mapped from snake_case database
 * columns to camelCase application fields by the service layer. They are the
 * single source of truth for what a "user", "gift list", "item", "claim",
 * "friend", etc. looks like anywhere in the app.
 */

/**
 * An authenticated app user and their profile/compliance data.
 *
 * Business rules:
 * - `uid` is the Supabase auth user id and is used as the foreign key for
 *   ownership/ authorship everywhere else in the schema (lists, items,
 *   friends, messages).
 * - `minorProtection` and `legalAcceptance` exist to satisfy child-privacy
 *   and GDPR/consent requirements: a user under the minimum age must have
 *   `minorProtection.isMinor` set and a `parentEmail` on file, and every
 *   user must accept terms/privacy before using list-sharing features.
 * - `isPremium` gates access to paid features (e.g. ad-free experience,
 *   premium list limits) — see RetailerService/SmartAdBanner for consumers.
 */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  givenName: string;
  familyName: string;
  photoURL: string | null;
  birthday: string | null; // ISO date string
  isPremium: boolean;
  createdAt: string | null; // ISO date string

  /** Child-safety/compliance fields required before a minor can use sharing features. */
  minorProtection: {
    isMinor: boolean;
    parentEmail: string;
  };

  /** Consent/compliance tracking required for GDPR and terms-of-service acceptance. */
  legalAcceptance: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    acceptanceDate: string | null;
    isEUUser: boolean;
    gdprApplies: boolean;
    acceptedDataProcessing: boolean;
  };
}

/**
 * A gift wish-list owned by a single user and optionally shared with others.
 *
 * Business rules:
 * - `ownerId` identifies the only user who may edit the list's items or
 *   delete the list; other users interact with it only via claims.
 * - `isPrivate` lists are visible only to the owner; non-private lists can
 *   be joined by anyone who has the `shareCode`.
 * - `shareCode` is a short, human-shareable code (see ListService) used to
 *   let friends find and view a list without needing a direct invite link.
 */
export interface GiftList {
  id: string;
  ownerId: string;
  title: string;
  isPrivate: boolean;
  shareCode?: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
}

/**
 * A single wishlist item belonging to a `GiftList`.
 *
 * Business rules:
 * - `listId` ties the item to its parent list; items are always fetched
 *   scoped to a list, never globally.
 * - `substitutions` tells gift-givers whether the list owner is OK
 *   receiving a similar-but-not-identical item (e.g. different color/size).
 * - `price`/`imageUri`/`url` are optional enrichment fields, some of which
 *   may be auto-populated from a retailer link via RetailerService.
 */
export interface GiftItem {
  id: string;
  listId: string;
  name: string;
  description?: string;
  price?: number | null;
  imageUri?: string | null;
  url?: string | null;
  substitutions: boolean;
  createdAt: string | null;
  updatedAt?: string | null;
}

/**
 * Records that a specific user has claimed (intends to buy) a gift item.
 *
 * Business rules:
 * - Exactly one active claim may exist per item at a time — claiming an
 *   already-claimed item is rejected by ClaimService.
 * - `listOwnerId` is denormalized onto the claim so the list owner can be
 *   excluded from seeing claim status on their own list (a gift list owner
 *   must never see who claimed what on their own list, to preserve the
 *   surprise).
 * - `claimedBy` is who intends to purchase/gift the item; only that user
 *   (or an admin flow) may unclaim it.
 */
export interface ItemClaim {
  itemId: string;
  claimedBy: string;
  listOwnerId: string;
  claimedAt: string | null;
}

/**
 * A `GiftItem` enriched with the current viewer's claim status.
 *
 * Used purely for UI rendering — `claimStatus` is `null`/`undefined` when
 * the item is unclaimed or when the viewer is the list owner (who must not
 * see claim state, per the "no spoilers for the owner" rule above).
 */
export interface GiftItemUI extends GiftItem {
  claimStatus?: ItemClaim | null;
}

/**
 * User-submitted feedback (bug report, feature request, or general note),
 * captured in-app via FeedbackModal/FeedbackService and reviewed out-of-band.
 */
export interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  text: string;
  type: 'bug' | 'feature' | 'general';
  createdAt: string | null;
}

/**
 * Lifecycle states of a friend request.
 * `pending` -> request sent, awaiting the recipient's response.
 * `accepted` -> both users are now friends and can see shared lists/message.
 * `declined` -> recipient rejected the request; it should not be re-shown.
 */
export type FriendStatus = 'pending' | 'accepted' | 'declined';

/**
 * A directed friend relationship/request between two users.
 *
 * Business rules:
 * - `userId` is the requester, `friendId` is the recipient; the row is the
 *   canonical record of the request regardless of who initiated it.
 * - `profile` is not stored in the database — it is populated client-side
 *   by FriendService when listing friends, by joining against `UserProfile`
 *   so the UI doesn't need a second round trip.
 */
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  createdAt: string | null;
  // Populated when fetching friend list
  profile?: UserProfile;
}

/**
 * The public-facing subset of a `User`'s profile — safe to expose to other
 * users (friends, conversation participants, list share views) without
 * leaking private/compliance fields like `legalAcceptance` or `birthday`.
 */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  givenName: string;
  familyName: string;
  photoURL: string | null;
}

/**
 * A direct-message thread between two or more users.
 *
 * Business rules:
 * - `participants` are resolved `UserProfile`s, not raw ids, so the UI can
 *   render avatars/names without extra lookups.
 * - `lastMessage` is a denormalized preview used for conversation list
 *   rows; it is not the source of truth for full message history (see
 *   `Message` / MessageService).
 */
export interface Conversation {
  id: string;
  createdAt: string | null;
  participants: UserProfile[];
  lastMessage?: Message | null;
}

/** A single chat message within a `Conversation`. */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string | null;
}
