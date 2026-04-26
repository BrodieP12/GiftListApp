import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch, Image, Platform
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/AppNavigator';
import { ListService } from '../services/ListService';
import { RetailerService } from '../services/RetailerService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext'; // IMPORT THEME Context
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { KeyboardAwareScrollView} from "react-native-keyboard-aware-scroll-view";
import {CrashLogger} from "../services/LoggingService";

type AddItemRouteProp = RouteProp<AppStackParamList, 'AddItem'>;

export const AddItemScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<AddItemRouteProp>();
  const { colors } = useAppTheme();
  const styles = createStyles(colors); // DYNAMIC STYLES

  const { listId } = route.params || {}; 

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [substitutions, setSubstitutions] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

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
      aspect: [4, 3],
      quality: 0.8
    });

    if(!result.canceled){
      setImageUri(result.assets[0].uri);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [scraping, setScraping] = useState(false);

  const toggleSwitch = () => setSubstitutions(previousState => !previousState);

  useEffect(() => {
    if (!listId) {
      Alert.alert("Error", "No List ID provided!", [
        { text: "Go Back", onPress: () => navigation.goBack() }
      ]);
    }
  }, [listId, navigation]);

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

  const handleAdd = async () => {
    if (!listId) return;

    if (!name.trim()) {
      Alert.alert("Required", "Please enter an item name.");
      return;
    }

    setSubmitting(true);
    try {
      await ListService.addItem(listId, {
        name,
        price: price ? parseFloat(price) : 0, 
        description,
        url,
        listId
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
          <ActivityIndicator color="#fff" />
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