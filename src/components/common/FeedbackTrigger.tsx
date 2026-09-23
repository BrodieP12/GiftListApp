/**
 * FeedbackTrigger.tsx
 *
 * App-wide wrapper component that gives the user two "hidden" gestures for
 * opening the feedback form without hunting for a settings menu entry:
 * shaking the device, or a fast horizontal swipe. It owns no visible UI of
 * its own beyond rendering `children` plus the {@link FeedbackModal}; open/
 * close state is delegated to `FeedbackContext` so other parts of the app
 * (e.g. a menu item) could also trigger it.
 */
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Accelerometer } from 'expo-sensors';
import { FeedbackModal } from './FeedbackModal';
import { useFeedback } from '../../theme/FeedbackContext';

/**
 * FeedbackTrigger wraps the entire app and listens for:
 * 1. Edge swipes (GestureHandler)
 * 2. Device shakes (Accelerometer)
 * to trigger the FeedbackModal.
 *
 * Intended to be mounted once near the root of the app (inside the
 * `FeedbackProvider`) so every screen gets these gestures "for free".
 */
export const FeedbackTrigger = ({ children }: { children: React.ReactNode }) => {
  const { isFeedbackVisible, openFeedback, closeFeedback } = useFeedback();
  const [subscription, setSubscription] = useState<any>(null);
  const lastUpdate = useRef(0);

  // --- SHAKE DETECTION ---
  // Opens feedback when the device's accelerometer magnitude spikes well
  // above gravity (1.0g) — i.e. a deliberate shake, not just handling the
  // phone. Guarded by `!isFeedbackVisible` so a shake while the modal is
  // already open doesn't re-trigger it, and by a 2s debounce
  // (`lastUpdate.current`) so a single shake gesture (which produces many
  // accelerometer samples) only opens the modal once.
  const _subscribe = () => {
    // Set update interval to 100ms for responsiveness without too much overhead
    Accelerometer.setUpdateInterval(100);

    setSubscription(
      Accelerometer.addListener(accelerometerData => {
        const { x, y, z } = accelerometerData;

        // Calculate the total force (magnitude)
        const totalForce = Math.sqrt(x * x + y * y + z * z);

        // Shake threshold: 1.0 is gravity. 2.5 - 3.0 is a deliberate shake.
        // Also limit how often it can fire (debounce)
        const now = Date.now();
        if (totalForce > 2.5 && now - lastUpdate.current > 2000) {
          if (!isFeedbackVisible) {
            lastUpdate.current = now;
            openFeedback();
          }
        }
      })
    );
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, [isFeedbackVisible]); // Resubscribe if modal state changes to ensure we have fresh closure context if needed

  // --- SWIPE GESTURE ---
  // Opens feedback on a fast, mostly-horizontal pan gesture anywhere in the
  // app: it must travel far enough (150px) and fast enough (800px/s) to
  // count as an intentional swipe rather than an incidental drag, and the
  // horizontal travel must be at least double the vertical travel so it
  // doesn't fire on vertical scrolling gestures.
  const gesture = Gesture.Pan()
    .onFinalize((event, success) => {
      if (!success) return;

      const { translationX, velocityX, translationY } = event;

      // Horizontal swipe detection
      if (Math.abs(translationX) > 150 && Math.abs(velocityX) > 800) {
          if (Math.abs(translationX) > Math.abs(translationY) * 2) {
              openFeedback();
          }
      }
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        {children}
        <FeedbackModal 
          visible={isFeedbackVisible} 
          onClose={closeFeedback} 
        />
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
