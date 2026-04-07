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
 */
export const FeedbackTrigger = ({ children }: { children: React.ReactNode }) => {
  const { isFeedbackVisible, openFeedback, closeFeedback } = useFeedback();
  const [subscription, setSubscription] = useState<any>(null);
  const lastUpdate = useRef(0);

  // --- SHAKE DETECTION ---
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
