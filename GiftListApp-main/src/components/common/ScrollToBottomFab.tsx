// src/components/ScrollToBottomFab.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ScrollToBottomFabProps {
    visible: boolean;
    onPress: () => void;
}

export const ScrollToBottomFab = ({ visible, onPress }: ScrollToBottomFabProps) => {
    // Initialize to 1 if visible, 0 if not
    const fabAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

    // Watch the 'visible' prop and animate whenever it changes
    useEffect(() => {
        Animated.timing(fabAnim, {
            toValue: visible ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [visible, fabAnim]);

    return (
        <Animated.View
            style={[
                styles.container, // ✅ Hoisted static styles
                {
                    opacity: fabAnim, // Dynamic animated styles
                    transform: [
                        {
                            scale: fabAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 1],
                            }),
                        },
                    ],
                }
            ]}
            // ✅ Safety measure: completely disables touches when hidden
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <TouchableOpacity
                className="items-center justify-center h-16 w-16 bg-blue-600 rounded-full shadow-lg shadow-blue-400"
                onPress={onPress}
            >
                <Text className="text-white text-3xl font-bold">↓</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ✅ Static styles hoisted outside the render loop
const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
    }
});