// SmartAdBanner.tsx
//
// NOTE: This entire component is currently disabled (commented out) — the
// react-native-google-mobile-ads dependency/integration is not wired up in
// this build. Kept here as reference for the intended behavior:
//
// A banner ad component intended to be rendered on screens (e.g. dashboard/
// list views) that gates ad display behind the signed-in user's premium
// status. Business rule: premium users (`user?.isPremium`) never see ads —
// the component renders `null` for them — while everyone else sees a
// non-personalized Google Mobile Ads banner. Uses Google's official test ad
// unit ID in development (`__DEV__`) and a placeholder real unit ID
// otherwise.
//
// import React from 'react';
// import { View, Text, StyleSheet } from 'react-native';
// import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
// import { useAuth } from '../../hooks/useAuth';

// const BANNER_ID = __DEV__ ? TestIds.BANNER : 'YOUR-REAL-BANNER-ID';

// export const SmartAdBanner = () => {
//   const { user } = useAuth();

//   // 1. The Gatekeeper Check
//   if (user?.isPremium) {
//     return null; // Don't render anything for premium users
//   }

//   // 2. Render the Ad
//   return (
//     <View style={styles.container}>
//       <Text style={styles.label}>Sponsored</Text>
//       <BannerAd
//         unitId={BANNER_ID}
//         size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
//         requestOptions={{
//           requestNonPersonalizedAdsOnly: true,
//         }}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 10,
//     backgroundColor: '#f0f0f0',
//     borderTopWidth: 1,
//     borderTopColor: '#e0e0e0',
//   },
//   label: {
//     fontSize: 10,
//     color: '#999',
//     marginBottom: 4,
//   }
// });