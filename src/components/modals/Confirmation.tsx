/**
 * Confirmation.tsx
 *
 * Generic, reusable confirm/cancel modal (an app-styled replacement for
 * `Alert.alert` with two buttons) used anywhere the app needs the user to
 * confirm a consequential action — e.g. deleting a list/item, unfriending
 * someone, or other destructive/important operations. Supports a 'danger'
 * (red, exclamation icon) or 'info' (theme primary color, info icon)
 * visual style, and an optional `customContent` slot for embedding extra
 * UI (like a text input) inside the confirmation body.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

/**
 * Props for {@link ConfirmationModal}.
 *
 * - `type` selects the icon and confirm-button color: 'danger' (default)
 *   for destructive actions, 'info' for non-destructive confirmations.
 * - `confirmText`/`cancelText` let callers customize button labels (e.g.
 *   "Delete" instead of the default "Confirm").
 * - `customContent` is rendered between the message and the buttons, for
 *   confirmations that need extra input/context beyond plain text.
 */
interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info';
    customContent?: React.ReactNode;
}

/**
 * Reusable confirm/cancel dialog. Renders a title, message, optional
 * `customContent`, and a confirm/cancel button pair whose confirm color and
 * icon adapt to `type`.
 */
export const ConfirmationModal = ({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger',
    customContent,
}: ConfirmationModalProps) => {
    const { colors } = useAppTheme();
    const styles = createStyles(colors);

    // Icon and confirm-button color are driven entirely by `type`: a
    // warning triangle in the theme's danger color for destructive
    // confirmations, or an info icon in the theme's primary color otherwise.
    const iconName = type === 'danger' ? 'exclamation-triangle' : 'info-circle';
    const confirmColor = type === 'danger' ? colors.danger : colors.primary;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <FontAwesome5 name={iconName} size={24} color={confirmColor} style={styles.icon} />
                        <Text style={styles.title}>{title}</Text>
                    </View>
                    
                    {!!message && <Text style={styles.message}>{message}</Text>}
                    {customContent}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity 
                            style={[styles.confirmButton, { backgroundColor: confirmColor }]} 
                            onPress={onConfirm}
                        >
                            <Text style={styles.confirmButtonText}>{confirmText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelButtonText}>{cancelText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        backgroundColor: colors.card,
        padding: 28,
        borderRadius: 20,
        width: '85%',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    icon: {
        marginRight: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
    },
    message: {
        fontSize: 16,
        color: colors.textDim,
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
    },
    confirmButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    confirmButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelButton: {
        width: '100%',
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },
});