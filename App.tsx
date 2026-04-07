import 'react-native-gesture-handler';
import './global.css';
import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import remoteConfig from '@react-native-firebase/remote-config';
import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/AppNavigator';
import { FeedbackTrigger } from './src/components/common/FeedbackTrigger';
import { FeedbackProvider } from './src/theme/FeedbackContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {

    useEffect(() => {
        async function checkVersionAndUpdates() {
            try {
                // 1. Fetch the latest parameters from Firebase
                await remoteConfig().fetchAndActivate();
                const requiredNativeVersion = remoteConfig().getValue('required_native_version').asString();
                const downloadUrl = remoteConfig().getValue('apk_download_url').asString();
                const latestUpdateMsg = remoteConfig().getValue('latest_update_message').asString() || "Internal improvements and bug fixes.";

                // 2. Check for FULL REINSTALL (Native Change)
                if (Application.nativeApplicationVersion !== requiredNativeVersion && !__DEV__) {
                    Alert.alert(
                        "New Version Available",
                        `A full reinstall is required:\n\n"${latestUpdateMsg}"`,
                        [
                            { text: "Download Latest APK", onPress: () => Linking.openURL(downloadUrl) }
                        ],
                        { cancelable: false }
                    );
                    return;
                }

                // 3. Check for OTA Update (JavaScript Change)
                const updateCheck = await Updates.checkForUpdateAsync();

                if (updateCheck.isAvailable) {
                    const isFirstLaunch = await AsyncStorage.getItem('alreadyLaunched');
                    if (isFirstLaunch === null) {
                        await AsyncStorage.setItem('alreadyLaunched', 'true');
                        return; // Skip the update popup this one time
                    }

                    const updateFetch = await Updates.fetchUpdateAsync();
                    if (updateFetch.isNew) {
                        Alert.alert(
                            "Update Available",
                            `What's New:\n"${latestUpdateMsg}"\n\nRestart now to apply changes?`,
                            [
                                { text: "Later", style: "cancel" },
                                { text: "Restart", onPress: () => Updates.reloadAsync() }
                            ]
                        );
                    }
                }
            } catch (error) {
                console.log(`Update check failed: ${error}`);
            }
        }

        checkVersionAndUpdates();
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <AuthProvider>
                    <FeedbackProvider>
                        <FeedbackTrigger>
                            <RootNavigator />
                            <StatusBar style="auto" />
                        </FeedbackTrigger>
                    </FeedbackProvider>
                </AuthProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}