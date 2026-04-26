    import 'react-native-gesture-handler';
    import './global.css';
    import React, { useEffect } from 'react';
    import { Alert, Linking, View, Text, StyleSheet, Dimensions } from 'react-native';
    import { StatusBar } from 'expo-status-bar';
    import { GestureHandlerRootView } from 'react-native-gesture-handler';
    import * as Updates from 'expo-updates';
    import { useUpdates } from 'expo-updates';
    import * as Application from 'expo-application';
    import remoteConfig from '@react-native-firebase/remote-config';
    import { AuthProvider } from './src/hooks/useAuth';
    import { RootNavigator } from './src/navigation/AppNavigator';
    import { FeedbackTrigger } from './src/components/common/FeedbackTrigger';
    import { FeedbackProvider } from './src/theme/FeedbackContext';
    import { ThemeProvider } from './src/theme/ThemeContext';
    import AsyncStorage from '@react-native-async-storage/async-storage';
    import { AppLogger, CrashLogger } from './src/services/LoggingService';
    import * as SplashScreen from 'expo-splash-screen';

    SplashScreen.preventAutoHideAsync();

    const { width } = Dimensions.get('window');

    /**
     * Standard React Native Progress Overlay
     */
    const UpdateOverlay = ({ progress }: { progress: number }) => {
        const displayProgress = Math.round(progress * 100);
        return (
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Updating GiftListApp</Text>
                    <Text style={styles.subtitle}>Downloading latest improvements...</Text>
                    <View style={styles.barBg}>
                        <View style={[styles.barFg, { width: `${displayProgress}%` }]} />
                    </View>
                    <Text style={styles.percentage}>{displayProgress}%</Text>
                </View>
            </View>
        );
    };

    export default function App() {
        const { isDownloading, downloadProgress } = useUpdates();

        useEffect(() => {
            async function runUpdateCheck() {

                await remoteConfig().setDefaults({
                    latest_ota_version: "1.0.9",
                    force_ota_update: false,
                    required_native_version: Application.nativeApplicationVersion || "1.0.5.4", // Default to current version
                    apk_download_url: "https://giftlistapp-557ce.web.app/latest.apk",
                    latest_update_message: "Transitioning to Firebase for OTA updates"
                });

                try {

                    // 1. Initialize Firebase Remote Config
                    const fetchTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('REMOTE_CONFIG_TIMEOUT')), 3000)
                    );

                    // Race the Firebase fetch against our 3-second timer
                    await Promise.race([
                        remoteConfig().fetchAndActivate(),
                        fetchTimeout
                    ]);

                    const remoteOtaId = remoteConfig().getValue('latest_ota_version').asString();
                    const isForceUpdate = remoteConfig().getValue('force_ota_update').asBoolean();
                    const requiredNativeVersion = remoteConfig().getValue('required_native_version').asString();
                    const downloadUrl = remoteConfig().getValue('apk_download_url').asString();
                    const latestUpdateMsg = remoteConfig().getValue('latest_update_message').asString() || "Internal improvements.";

                    const localOtaId = await AsyncStorage.getItem('current_ota_id');
                    const isFirstLaunch = await AsyncStorage.getItem('alreadyLaunched');

                    // 2. Check for FULL REINSTALL (Native Change)
                    if (Application.nativeApplicationVersion !== requiredNativeVersion && !__DEV__) {
                        await AppLogger.info('Native Version Mismatch - Forcing Reinstall');
                        Alert.alert(
                            "New Version Available",
                            `A full reinstall is required:\n\n"${latestUpdateMsg}"`,
                            [{ text: "Download Latest APK", onPress: () => Linking.openURL(downloadUrl) }],
                            { cancelable: false }
                        );
                        return;
                    }

                    // 3. Check for OTA Update via Firebase Versioning
                    if (remoteOtaId !== localOtaId) {
                        await AppLogger.info('OTA Update Detected via Firebase', { remoteOtaId, isForceUpdate });

                        const fetch = await Updates.fetchUpdateAsync();

                        if (fetch.isNew) {
                            await AsyncStorage.setItem('current_ota_id', remoteOtaId);

                            // Handle New Users Silently
                            if (isFirstLaunch === null) {
                                await AsyncStorage.setItem('alreadyLaunched', 'true');
                                await AppLogger.info('Silent Update for New User');
                                await Updates.reloadAsync();
                                return;
                            }

                            // Handle Returning Users
                            const buttons = [{ text: "Restart Now", onPress: () => Updates.reloadAsync() }];
                            if (!isForceUpdate) {
                                buttons.unshift({ text: "Later", style: "cancel" } as any);
                            }

                            Alert.alert(
                                isForceUpdate ? "Required Update" : "Update Available",
                                `What's New:\n"${latestUpdateMsg}"\n\nRestart now to apply changes?`,
                                buttons,
                                { cancelable: !isForceUpdate }
                            );
                        }
                    } else {
                        // No update needed, ensure first launch flag is set
                        if (isFirstLaunch === null) await AsyncStorage.setItem('alreadyLaunched', 'true');
                    }

                } catch (err: any) {
                    if (err.message === 'REMOTE_CONFIG_TIMEOUT') {
                        AppLogger.info('Remote Config timed out, proceeding with cached values.');
                    } else {
                        CrashLogger.error(err, 'Combined_Update_Flow_Failed');
                    }
                }
                finally {
                    await SplashScreen.hideAsync();
                }
            }

            runUpdateCheck();
        }, []);

        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <ThemeProvider>
                    <AuthProvider>
                        <FeedbackProvider>
                            <FeedbackTrigger>
                                <RootNavigator />
                                {isDownloading && <UpdateOverlay progress={downloadProgress ?? 0} />}
                                <StatusBar style="auto" />
                            </FeedbackTrigger>
                        </FeedbackProvider>
                    </AuthProvider>
                </ThemeProvider>
            </GestureHandlerRootView>
        );
    }

    const styles = StyleSheet.create({
        overlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
        },
        card: {
            width: width * 0.85,
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
        },
        title: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#111',
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 14,
            color: '#666',
            textAlign: 'center',
            marginBottom: 20,
        },
        barBg: {
            width: '100%',
            height: 12,
            backgroundColor: '#E0E0E0',
            borderRadius: 6,
            overflow: 'hidden',
        },
        barFg: {
            height: '100%',
            backgroundColor: '#007AFF',
        },
        percentage: {
            marginTop: 12,
            fontSize: 14,
            fontWeight: '600',
            color: '#007AFF',
        },
    });