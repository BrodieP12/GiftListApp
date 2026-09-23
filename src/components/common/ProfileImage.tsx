/**
 * ProfileImage.tsx
 *
 * Renders a user's avatar as an initials badge (no photo upload support in
 * this app) — a colored circle showing up to two initials derived from the
 * user's given/family name, falling back to the first letter of their
 * email. Used anywhere a user needs to be represented visually: profile
 * screens, friend lists, conversation headers, etc. The background color is
 * deterministically generated from the user's email so the same person
 * always gets the same color across the app/sessions.
 */
import React, { useMemo } from "react";
import { StyleSheet, Dimensions, View, Text, ViewStyle, StyleProp, TouchableOpacity } from "react-native";

const { height } = Dimensions.get("window");

// 1. Convert the string to a unique integer
const getHashOfString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        // A standard bitwise hashing algorithm
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
};

/**
 * Deterministically derives a pastel background color from a string (the
 * user's email). Same input always produces the same color, which is what
 * gives each user a stable, recognizable avatar color across the app.
 * Mixes the hashed RGB channels with white (`mixWithWhite`) to keep the
 * result pastel/light rather than a harsh saturated color.
 */
// 2. Convert that integer into a pastel Hex color
const generateConsistentPastelColor = (name: string) => {
    const hash = getHashOfString(name);

    // Helper to mix our extracted color with white (255)
    const mixWithWhite = (value: number) => Math.floor((value + 255) / 2);

    // Use bitwise masking to extract Red, Green, and Blue from the hash
    const r = mixWithWhite(Math.abs((hash & 0xFF0000) >> 16));
    const g = mixWithWhite(Math.abs((hash & 0x00FF00) >> 8));
    const b = mixWithWhite(Math.abs(hash & 0x0000FF));

    // Convert back to hex
    return '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0');
};

/**
 * Picks black or white initials text color based on the perceived
 * brightness (YIQ) of the generated background color, so the initials stay
 * legible regardless of which pastel shade a given user was assigned.
 */
// 3. Ensure text is always readable against the chosen background
const getAccessibleTextColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate perceived brightness using the YIQ color space formula
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return (yiq >= 128) ? '#000000' : '#FFFFFF';
};

/**
 * Props for {@link ProfileImage}.
 *
 * - `email` is used both as a fallback initial (when no name is available)
 *   and as the seed for the deterministic background color.
 * - `givenName`/`familyName` supply up to two initials; either may be empty.
 * - `size` sets the circle's diameter (and scales font size proportionally).
 * - `onPress` makes the badge tappable (e.g. to view a profile); the
 *   TouchableOpacity is disabled when omitted.
 */
interface ProfileImageProps {
    email: string;
    givenName: string;
    familyName: string;
    size?: number;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * Circular initials-based avatar badge. Computes initials from
 * `givenName`/`familyName` (falling back to the first letter of `email`
 * when no name parts are available) and renders them over a color that is
 * consistently derived from the user's email.
 */
const ProfileImage = ({
    email, 
    givenName, 
    familyName, 
    size = 40, 
    onPress, 
    style 
}: ProfileImageProps) => {
    // Extract up to two initials (first name and last name)
    var initials = "";

    if (givenName && givenName.length > 0) {
        initials += givenName[0].toUpperCase();
    }
    if (familyName && familyName.length > 0) {
        initials += familyName[0].toUpperCase();
    }

    if (initials.length === 0 && email) {
        initials = email[0].toUpperCase();
    }

    // Generate colors consistently based on the name string
    const backgroundColor = useMemo(() => generateConsistentPastelColor(email || 'default'), [email]);
    const textColor = useMemo(() => getAccessibleTextColor(backgroundColor), [backgroundColor]);

    const dynamicStyles = {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
    };

    const fontSize = size * 0.4;

    return (
        <TouchableOpacity
            style={[styles.userProfileImage, dynamicStyles, style]}
            onPress={onPress}
            disabled={!onPress}
        >
            <Text style={[styles.userProfileText, { color: textColor, fontSize }]}>
                {initials}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    userProfileImage: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    userProfileText: {
        fontWeight: '800',
        textAlign: 'center',
    }
});

export default ProfileImage;