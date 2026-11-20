// src/components/ScrollToBottomFab.tsx
/**
 * ScrollToBottomFab.tsx
 *
 * Small floating action button (a downward-arrow circle) that fades/scales
 * in and out based on a `visible` prop. Intended to float over a scrollable
 * list (e.g. a chat/conversation screen) so the user can jump back to the
 * latest message when they've scrolled up; the parent screen owns the
 * scroll-position logic and just toggles `visible`.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, Text, StyleSheet } from 'react-native';

/** Props for {@link ScrollToBottomFab}. `visible` drives the fade/scale
 * animation and disables touches while hidden; `onPress` is typically wired
 * to scroll the parent list to its bottom/end. */
interface ScrollToBottomFabProps {
    visible: boolean;
    onPress: () => void;
}

/**
 * Animated floating "scroll to bottom" button. Purely presentational — it
 * does not track scroll position itself, it only animates its own
 * opacity/scale in response to the `visible` prop and forwards taps via
 * `onPress`.
 */
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