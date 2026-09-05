import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const checkEmailInUse = onCall(async (request) => {
    // SECURITY 1: Enforce App Check
    // This ensures the request is coming from your genuine iOS/Android/Web app
    // and completely shuts down bot-driven enumeration scripts.
    if (request.app == undefined) {
        throw new HttpsError(
            'failed-precondition',
            'The function must be called from a verified app.'
        );
    }

    // SECURITY 2: Strict Input Validation
    const email = request.data.email;
    if (!email || typeof email !== 'string' || email.length > 254) {
        throw new HttpsError('invalid-argument', 'Invalid email provided.');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Basic regex to ensure it's actually an email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        throw new HttpsError('invalid-argument', 'Malformed email address.');
    }

    try {
        // 1. Check Firebase Auth directly via Admin SDK
        try {
            await getAuth().getUserByEmail(cleanEmail);
            // If this succeeds, the user exists in Auth
            return { inUse: true };
        } catch (error: any) {
            // If the error is anything OTHER than user-not-found, throw it
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        // 2. Check Firestore via Admin SDK (Bypasses rules entirely)
        const db = getFirestore();
        const snapshot = await db
            .collection('users')
            .where('email', '==', cleanEmail)
            .limit(1)
            .get();

        return { inUse: !snapshot.empty };

    } catch (error) {
        console.error('Error checking email uniqueness:', error);
        throw new HttpsError('internal', 'Unable to verify email status.');
    }
});