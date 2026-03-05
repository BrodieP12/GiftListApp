import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch, Image, ScrollView, Platform, KeyboardAvoidingView
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { AppStackParamList } from '../navigation/types';
import { ListService } from '../services/ListService';
import { RetailerService } from '../services/RetailerService';
import * as ImagePicker from 'expo-image-picker';

type AddItemRouteProp = RouteProp<AppStackParamList, 'AddItem'>;

export const AddItemScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<AddItemRouteProp>();
  


  // Destructure listId safely
  const { listId } = route.params || {}; 

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [substitutions, setSubstitutions] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const handlePickImage = async() => {
    // Request permission first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if(!permissionResult.granted){
      Alert.alert(
        "Permission Required",
        "You need to grant photo library access to upload an image."
      );
      return;
    }

    // Launch the picker
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

  // Loading States
  const [submitting, setSubmitting] = useState(false);
  const [scraping, setScraping] = useState(false);


   const toggleSwitch = () => setSubstitutions(previousState => !previousState);

    

  // Safety Check: If listId is missing, warn the user immediately.
  useEffect(() => {
    if (!listId) {
      Alert.alert("Error", "No List ID provided!", [
        { text: "Go Back", onPress: () => navigation.goBack() }
      ]);
    }
  }, [listId]);

  // --- NEW: Handle URL Paste & Scrape ---
  const handleUrlBlur = async () => {
    if (!url || url.length < 4) return; // Don't scrape empty or short text

    setScraping(true);
    try {
      // Call the Cloud Function via our Service
      const data = await RetailerService.fetchItemMetadata(url);

      // Auto-fill fields if data was found
      if (data.title) setName(data.title);
      if (data.price) setPrice(data.price.toString());
      if (data.description) setDescription(data.description);
      
      // Optional: You could also save the image URL here if you have an image field
      // if (data.image) setImageUrl(data.image);

    } catch (error) {
      console.log('Scrape failed silently', error);
      // We don't alert the user here because they can just type it manually.
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
      console.error(e);
      Alert.alert("Error", "Could not add item. Check your internet connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!listId) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      
      {/* 1. MOVED LINK TO TOP (UX Best Practice: Paste link first to auto-fill the rest) */}
      <Text style={styles.label}>Link (Optional)</Text>
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imageBtnText}>+ Add Photo</Text>
        )}
        </TouchableOpacity>
        <TextInput 
          style={[styles.input, { paddingRight: 40, marginBottom: 0 }]} 
          placeholder="https://..." 
          autoCapitalize="none"
          value={url} 
          onChangeText={setUrl} 
          onBlur={handleUrlBlur} 
        />
        {scraping && (
          <ActivityIndicator 
            style={styles.loadingIcon} 
            color="#007AFF" 
          />
        )}
      </View>
      <Text style={styles.helperText}>Paste a link and tap away to auto-fill details!</Text>

      {/* 2. Standard Fields */}
      <Text style={styles.label}>Item Name</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. Lego Star Wars Set" 
        value={name} 
        onChangeText={setName} 
      />
      <Text style={styles.label}>Allow Substitutions?</Text>
      <Switch
          trackColor={{false: '#767577', true: '#81b0ff'}}
          thumbColor={substitutions ? '#f5dd4b' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleSwitch}
          value={substitutions}
      />
      <Text style={styles.label}>Price (Optional)</Text>
      <TextInput 
        style={styles.input} 
        placeholder="0.00" 
        keyboardType="numeric"
        value={price} 
        onChangeText={setPrice} 
      />

      <Text style={styles.label}>Description (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Size, color, or specific details"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* 3. Submit Button */}
      <TouchableOpacity 
        style={styles.btn} 
        onPress={handleAdd}
        disabled={submitting || scraping} // Disable while working
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Save Item</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#333' },
  
  // Updated Input Styling for the Loading Icon
  inputContainer: { position: 'relative', marginBottom: 5 },
  input: { 
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, 
    fontSize: 16, backgroundColor: '#f9f9f9', marginBottom: 20
  },
  loadingIcon: { position: 'absolute', right: 12, top: 12 },
  
  helperText: { fontSize: 12, color: '#888', marginBottom: 20, marginTop: 0 },
  
  btn: { 
    backgroundColor: '#007AFF', padding: 16, borderRadius: 8, 
    alignItems: 'center', marginTop: 10 
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  imageBtn: {
    height: 150,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  imageBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
  image: { width: '100%', height: '100%' },
  scrollContent: { padding: 20, paddingBottom: 40 },

});