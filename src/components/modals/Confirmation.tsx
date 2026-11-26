import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';

export type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'cancel';

export interface ConfirmationButton {
    text: string;
    onPress: (inputValue?: string) => void;
    variant?: ButtonVariant;
    disabled?: boolean;
}

interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    onConfirm?: (inputValue?: string) => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    type?: 'danger' | 'info';
    customContent?: React.ReactNode;
    showInput?: boolean;
    inputPlaceholder?: string;
    initialInputValue?: string;
    buttons?: ConfirmationButton[];
    buttonLayout?: 'stacked' | 'row';
}

export const ConfirmationModal = ({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    hideCancel = false,
    type = 'danger',
    customContent,
    showInput = false,
    inputPlaceholder = '',
    initialInputValue = '',
    buttons,
    buttonLayout = 'stacked',
}: ConfirmationModalProps) => {
    const { colors } = useAppTheme();
    const styles = createStyles(colors);
    const [inputValue, setInputValue] = useState(initialInputValue);

    useEffect(() => {
        if (visible) {
            setInputValue(initialInputValue);
        }
    }, [visible, initialInputValue]);

    const iconName = type === 'danger' ? 'exclamation-triangle' : 'info-circle';
    const iconColor = type === 'danger' ? colors.danger : colors.primary;

    // Build default buttons if a custom `buttons` array wasn't provided
    const resolvedButtons: ConfirmationButton[] = buttons ?? [
        {
            text: confirmText,
            variant: type === 'danger' ? 'danger' : 'primary',
            onPress: (val) => onConfirm?.(val),
        },
        ...(!hideCancel
            ? [
                  {
                      text: cancelText,
                      variant: 'cancel' as const,
                      onPress: () => onCancel?.(),
                  },
              ]
            : []),
    ];

    const handleButtonPress = (button: ConfirmationButton) => {
        button.onPress(showInput ? inputValue : undefined);
    };

    const handleRequestClose = () => {
        if (onCancel) {
            onCancel();
            return;
        }
        const cancelBtn = resolvedButtons.find((b) => b.variant === 'cancel');
        cancelBtn?.onPress(undefined);
    };

    const handleSubmitEditing = () => {
        const primaryAction = resolvedButtons.find((b) => b.variant !== 'cancel');
        if (primaryAction && !primaryAction.disabled) {
            handleButtonPress(primaryAction);
        }
    };

    const getButtonStyles = (variant: ButtonVariant = 'primary') => {
        switch (variant) {
            case 'danger':
                return {
                    container: [styles.baseButton, { backgroundColor: colors.danger }],
                    text: styles.solidButtonText,
                };
            case 'secondary':
                return {
                    container: [styles.baseButton, styles.secondaryButton],
                    text: styles.secondaryButtonText,
                };
            case 'cancel':
                return {
                    container: [styles.baseButton, styles.cancelButton],
                    text: styles.cancelButtonText,
                };
            case 'primary':
            default:
                return {
                    container: [styles.baseButton, { backgroundColor: colors.primary }],
                    text: styles.solidButtonText,
                };
        }
    };

    const isRow = buttonLayout === 'row';

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={handleRequestClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <FontAwesome5 name={iconName} size={24} color={iconColor} style={styles.icon} />
                        <Text style={styles.title}>{title}</Text>
                    </View>

                    {!!message && <Text style={styles.message}>{message}</Text>}

                    {showInput && (
                        <TextInput
                            style={styles.input}
                            value={inputValue}
                            onChangeText={setInputValue}
                            placeholder={inputPlaceholder}
                            placeholderTextColor={colors.textDim}
                            autoFocus={true}
                            returnKeyType="done"
                            onSubmitEditing={handleSubmitEditing}
                        />
                    )}

                    {customContent}

                    <View style={[styles.buttonContainer, isRow && styles.buttonRow]}>
                        {resolvedButtons.map((button, index) => {
                            const { container, text } = getButtonStyles(button.variant);
                            return (
                                <TouchableOpacity
                                    key={`${button.text}-${index}`}
                                    style={[
                                        container,
                                        isRow ? styles.rowButton : styles.stackedButton,
                                        button.disabled && styles.disabledButton,
                                    ]}
                                    onPress={() => handleButtonPress(button)}
                                    disabled={button.disabled}
                                >
                                    <Text style={text}>{button.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </KeyboardAvoidingView>
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
        marginBottom: 20,
        lineHeight: 22,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: colors.textDim,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        marginBottom: 20,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        gap: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    baseButton: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stackedButton: {
        width: '100%',
    },
    rowButton: {
        flex: 1,
    },
    solidButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelButton: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
    },
    cancelButtonText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.45,
    },
});