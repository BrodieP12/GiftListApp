import React, { createContext, useContext, useState } from 'react';

interface FeedbackContextType {
  openFeedback: () => void;
  closeFeedback: () => void;
  isFeedbackVisible: boolean;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

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

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
