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