import mobileAds, { 
  MaxAdContentRating, 
  InterstitialAd, 
  AdEventType, 
  TestIds 
} from 'react-native-google-mobile-ads';

// Use Test IDs for development to avoid policy violations
const AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : 'YOUR-REAL-AD-UNIT-ID';

let interstitial: InterstitialAd | null = null;

export const AdsService = {
  /**
   * Initialize the Ad SDK. Call this on App launch.
   */
  async initialize() {
    await mobileAds().setRequestConfiguration({
      // Update this with your test device IDs
      testDeviceIdentifiers: ['__REQUS_TEST_DEVICE_ID__'], 
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    
    // Pre-load an interstitial
    this.loadInterstitial();
  },

  loadInterstitial() {
    interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitial.load();
  },

  /**
   * Logic: Only show ad if user is NOT premium.
   */
  async showInterstitialIfFreeUser(isPremium: boolean) {
    if (isPremium) {
      console.log('User is Premium. Skipping Ad.');
      return;
    }

    if (interstitial && interstitial.loaded) {
      interstitial.show();
      // Load the next one
      this.loadInterstitial();
    } else {
      console.log('Ad not ready yet.');
      this.loadInterstitial(); // Retry load
    }
  }
};