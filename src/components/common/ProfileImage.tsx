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

// 3. Ensure text is always readable against the chosen background
const getAccessibleTextColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 2), 16);
    const b = parseInt(hex.substring(4, 2), 16);

    // Calculate perceived brightness using the YIQ color space formula
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return (yiq >= 128) ? '#000000' : '#FFFFFF';
};

interface ProfileImageProps {
    email: string;
    givenName: string;
    familyName: string;
    size?: number;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

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