import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch, Image, Platform
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { ListService } from '../services/ListService';
import { useAuth } from '../hooks/useAuth';
import { RetailerService } from '../services/RetailerService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext'; // IMPORT THEME Context
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { KeyboardAwareScrollView} from "react-native-keyboard-aware-scroll-view";
import {CrashLogger} from "../services/LoggingService";
import { ImageUploadService, ImageUploadError } from "../services/ImageUploadService";

/**
 * AddItemScreen
 * ---------------------------------------------------------------------------
 * Lets the owner of a gift list add a new wishlist item to it, either by
 * hand-filling the fields or by pasting a retailer product URL and letting
 * `RetailerService.fetchItemMetadata` auto-fill the name/price/description.
 *
 * Navigation:
 * - Route: `AppStackParamList['AddItem']` — expects `{ listId: string }` in
 *   `route.params`. Presented as a modal from `ListDetailScreen`'s FAB.
 * - Produces: no return params; on success it calls `navigation.goBack()` so
 *   the caller's realtime item subscription (`useListDetail` /
 *   `ListService.listenToItems`) picks up the new row automatically.
 *
 * Business rules enforced here:
 * - `listId` is required. If it's missing from route params, an alert is
 *   shown and the user is bounced back (defensive guard — this screen should
 *   never be reachable without a listId per the navigator's typing).
 * - Item `name` is the only required field; price/description/url/photo are
 *   optional. Price is parsed as a float and defaults to 0 if blank/invalid.
 * - `substitutions` (whether the owner accepts a similar-but-not-identical
 *   gift) defaults to false and is toggled via a Switch.
 * - Auto-fill via URL scraping is best-effort: on failure the user is told to
 *   type the data in manually rather than being blocked from submitting.
 */
type AddItemRouteProp = RouteProp<AppStackParamList, 'AddItem'>;

export const AddItemScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<AddItemRouteProp>();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const styles = createStyles(colors); // DYNAMIC STYLES

  const { listId } = route.params || {}; 

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [substitutions, setSubstitutions] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  /**
   * Opens the device photo library so the user can attach a picture to the
   * item. Requires media-library permission (requested inline); if the user
   * declines, we show an explanatory alert and leave `imageUri` untouched
   * rather than silently failing.
   *
   * The picked image is only stored locally as a `file://` URI in component
   * state at this point — it's compressed and uploaded (with NSFW
   * moderation) in `handleAdd` via `ImageUploadService`, only once the user
   * actually submits the form. This avoids uploading/moderating an image
   * the user might immediately replace or discard.
   */
  const handlePickImage = async() => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if(!permissionResult.granted){
      Alert.alert(
        "Permission Required",
        "You need to grant photo library access to upload an image."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });

    if(!result.canceled){
      setImageUri(result.assets[0].uri);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [scraping, setScraping] = useState(false);
  // Tracks the compress/moderate/upload phase specifically so the submit
  // button can show "Uploading Photo..." instead of a generic spinner —
  // this step can take a couple of seconds (network round-trip to the
  // moderation Edge Function) and users otherwise have no feedback on why.
  const [uploadingImage, setUploadingImage] = useState(false);

  const toggleSwitch = () => setSubstitutions(previousState => !previousState);

  // Defensive guard: AddItem should always be navigated to with a listId
  // (see AppStackParamList), but if it's ever missing (e.g. a malformed deep
  // link) we surface an alert and send the user back rather than letting
  // them submit an item with no parent list.
  useEffect(() => {
    if (!listId) {
      Alert.alert("Error", "No List ID provided!", [
        { text: "Go Back", onPress: () => navigation.goBack() }
      ]);
    }
  }, [listId, navigation]);

  /**
   * Fired on blur of the URL field. Attempts to scrape product metadata
   * (title/price/description) from the pasted retailer link via
   * `RetailerService.fetchItemMetadata`, pre-filling the form so the user
   * doesn't have to type everything by hand.
   *
   * This is purely a convenience — scraping failures are caught and logged,
   * and the user is told to fall back to manual entry rather than being
   * blocked. Only runs for URLs of at least 4 characters to avoid firing on
   * an essentially-empty field.
   */
  const handleUrlBlur = async () => {
    if (!url || url.length < 4) return;

    setScraping(true);
    try {
      const data = await RetailerService.fetchItemMetadata(url);

      if (data.title) setName(data.title);
      if (data.price) setPrice(data.price.toString());
      if (data.description) setDescription(data.description);

    } catch (error) {
      CrashLogger.error(error);
      Alert.alert("Data Collection failed. Sending URL to review. Please type in the data manually.")
    } finally {
      setScraping(false);
    }
  };

  /**
   * Validates and submits the new item to `ListService.addItem`, which
   * inserts a row into the Supabase `items` table scoped to `listId` and
   * `owner_id: user.uid`.
   *
   * Validation rules:
   * - `listId` must be present (guarded above).
   * - `name` is required and trimmed; all other fields are optional.
   * - `price` is coerced from free-text to a float, defaulting to 0 when
   *   blank (price is advisory display data, not used for payments).
   *
   * If a photo was picked, it's compressed and run through
   * `ImageUploadService.uploadItemImage` (client-side resize/compress, then
   * server-side NSFW moderation + storage upload) BEFORE the item row is
   * created. If the photo is rejected (flagged as NSFW) or the upload
   * otherwise fails, the whole submission is stopped with an alert — the
   * item is not created without the photo silently, since that could
   * confuse the user into thinking their photo was attached when it
   * wasn't. They can then pick a different photo (or clear this one) and
   * try again.
   *
   * On success, navigates back to ListDetailScreen — the new item then
   * appears there via the list's realtime `items` subscription rather than
   * this screen passing data back through navigation params.
   */
  const handleAdd = async () => {
    if (!listId) return;

    if (!name.trim()) {
      Alert.alert("Required", "Please enter an item name.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (imageUri) {
        setUploadingImage(true);
        try {
          uploadedImageUrl = await ImageUploadService.uploadItemImage(imageUri);
        } catch (uploadError) {
          const message = uploadError instanceof ImageUploadError
            ? uploadError.message
            : 'Failed to upload the photo. Please try again.';
          Alert.alert(
            uploadError instanceof ImageUploadError && uploadError.reason === 'nsfw'
              ? 'Photo Not Allowed'
              : 'Photo Upload Failed',
            message
          );
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      await ListService.addItem(listId, user!.uid, {
        name,
        price: price ? parseFloat(price) : 0,
        description,
        url,
        listId,
        imageUri: uploadedImageUrl,
      });
      navigation.goBack();
    } catch (e) {
      // @ts-ignore
      CrashLogger.error(e);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!listId) return <View style={styles.container} />;

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      enableOnAndroid={true}
      extraScrollHeight={120}
      contentContainerStyle={styles.scrollContent}>
      
      <Text style={styles.label}>Link (Optional)</Text>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <>
            <FontAwesome5 name="camera" size={32} color={colors.textDim} style={{ marginBottom: 8 }} />
            <Text style={styles.imageBtnText}>Add Photo</Text>
          </>
        )}
        </TouchableOpacity>
        <View style={styles.urlInputWrapper}>
          <FontAwesome5 name="link" size={16} color={colors.textDim} style={styles.inputIcon} />
          <TextInput 
            style={[styles.input, styles.urlInput]} 
            placeholder="https://..." 
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            value={url} 
            onChangeText={setUrl} 
            onBlur={handleUrlBlur} 
          />
        </View>
        {scraping && (
          <ActivityIndicator 
            style={styles.loadingIcon} 
            color={colors.primary} 
          />
        )}
      </View>
      <Text style={styles.helperText}>Paste a link and tap away to auto-fill details!</Text>

      <Text style={styles.label}>Item Name</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. Lego Star Wars Set" 
        placeholderTextColor={colors.textDim}
        value={name} 
        onChangeText={setName} 
      />
      <Text style={styles.label}>Allow Substitutions?</Text>
      <Switch
          trackColor={{false: colors.border, true: colors.primary}}
          thumbColor={'#fff'}
          ios_backgroundColor={colors.border}
          onValueChange={toggleSwitch}
          value={substitutions}
      />
      <Text style={styles.label}>Price (Optional)</Text>
      <TextInput 
        style={styles.input} 
        placeholder="0.00" 
        placeholderTextColor={colors.textDim}
        keyboardType="numeric"
        value={price} 
        onChangeText={setPrice} 
      />

      <Text style={styles.label}>Description (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Size, color, or specific details"
        placeholderTextColor={colors.textDim}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity
        style={styles.btn}
        onPress={handleAdd}
        disabled={submitting || scraping}
      >
        {submitting ? (
          <View style={styles.btnLoadingRow}>
            <ActivityIndicator color="#fff" />
            {uploadingImage && <Text style={styles.btnLoadingText}>Uploading photo...</Text>}
          </View>
        ) : (
          <Text style={styles.btnText}>Save Item</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: colors.text },
  
  inputContainer: { position: 'relative', marginBottom: 5 },
  input: { 
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8, 
    padding: 12, 
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: 20,
  },
  loadingIcon: { position: 'absolute', right: 12, top: 12 },
  urlInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    backgroundColor: colors.card,
  },
  urlInput: {
    borderWidth: 0,
    marginBottom: 0,
    flex: 1,
    paddingLeft: 40,
    backgroundColor: 'transparent',
    color: colors.text,
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  
  helperText: { fontSize: 12, marginBottom: 20, marginTop: 0, color: colors.textDim },
  
  btn: { 
    padding: 16, 
    borderRadius: 8,
    alignItems: 'center', 
    marginTop: 10,
    backgroundColor: colors.primary,
  },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  btnLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLoadingText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  imageBtn: {
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  imageBtnText: { fontSize: 16, fontWeight: '600', color: colors.textDim },
  image: { width: '100%', height: '100%' },
  scrollContent: { padding: 20, paddingBottom: 40 },
});