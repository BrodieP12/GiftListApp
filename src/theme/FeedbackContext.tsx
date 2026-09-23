/**
 * FeedbackContext.tsx
 *
 * Small React context that holds the open/closed state of the app-wide
 * feedback modal, decoupling "what can trigger feedback to open"
 * (`FeedbackTrigger`'s shake/swipe gestures, or any future UI entry point
 * like a menu button) from "what renders the feedback modal"
 * (`FeedbackModal`, also rendered by `FeedbackTrigger`). Any component
 * under the provider can call `useFeedback()` to open/close the modal
 * without prop-drilling.
 */
import React, { createContext, useContext, useState } from 'react';

/** Shape of the feedback context value: visibility flag plus open/close
 * actions. */
interface FeedbackContextType {
  openFeedback: () => void;
  closeFeedback: () => void;
  isFeedbackVisible: boolean;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

/**
 * Provides feedback-modal visibility state to the component tree. Should
 * wrap the app once near the root (alongside/above `FeedbackTrigger`).
 */
export const FeedbackProvider = ({ children }: { children: React.ReactNode }) => {
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const openFeedback = () => setIsFeedbackVisible(true);
  const closeFeedback = () => setIsFeedbackVisible(false);

  return (
    <FeedbackContext.Provider value={{ openFeedback, closeFeedback, isFeedbackVisible }}>
      {children}
    </FeedbackContext.Provider>
  );
};

/**
 * Hook to read/control feedback-modal visibility. Throws if used outside a
 * `FeedbackProvider`, so misuse fails loudly during development rather than
 * silently no-op-ing.
 */
export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
