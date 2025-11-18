import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { 
  Plus, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  File,
  ShoppingCart,
  X,
  Camera
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants';
import { GroceryList } from '@/types';

export default function ListsScreen() {
  const [lists, setLists] = useState<GroceryList[]>([
    {
      id: '1',
      name: 'Weekly Groceries',
      items: ['Milk', 'Bread', 'Eggs', 'Chicken', 'Bananas'],
      createdAt: new Date(),
      estimatedTotal: 47.83,
    },
    {
      id: '2',
      name: 'Party Supplies',
      items: ['Chips', 'Soda', 'Pizza', 'Ice cream'],
      createdAt: new Date(),
      estimatedTotal: 28.49,
    },
  ]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListItems, setNewListItems] = useState('');

  const handleFileUpload = async (type: 'document' | 'image' | 'camera') => {
    try {
      let result;
      
      if (type === 'document') {
        result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'application/vnd.ms-excel', 'text/plain'],
        });
      } else if (type === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Camera permission is required to take photos');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Photo library permission is required');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });
      }

      if (!result.canceled) {
        setShowUploadModal(false);
        Alert.alert(
          'Processing...',
          'Pricewise is reading your list and finding the best prices...',
          [{ text: 'OK' }]
        );
        
        // Simulate processing
        setTimeout(() => {
          const newList: GroceryList = {
            id: Date.now().toString(),
            name: 'Uploaded List',
            items: ['Milk', 'Bread', 'Eggs', 'Apples', 'Chicken'],
            createdAt: new Date(),
            estimatedTotal: 32.15,
          };
          setLists(prev => [newList, ...prev]);
          Alert.alert(
            'Success!',
            'Pricewise found your items and calculated potential savings of $8.50!'
          );
        }, 2000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process the file. Please try again.');
    }
  };

  const handleCreateNewList = () => {
    if (!newListName.trim() || !newListItems.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const items = newListItems
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    const newList: GroceryList = {
      id: Date.now().toString(),
      name: newListName,
      items,
      createdAt: new Date(),
      estimatedTotal: Math.random() * 50 + 20, // Mock calculation
    };

    setLists(prev => [newList, ...prev]);
    setShowNewListModal(false);
    setNewListName('');
    setNewListItems('');
  };

  const renderList = (list: GroceryList) => (
    <TouchableOpacity key={list.id} style={styles.listCard}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.listName}>{list.name}</Text>
          <Text style={styles.listItems}>
            {list.items.length} items • ${list.estimatedTotal?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <ShoppingCart size={24} color={Colors.primary} />
      </View>
      
      <View style={styles.itemsPreview}>
        {list.items.slice(0, 3).map((item, index) => (
          <Text key={index} style={styles.itemText}>
            • {item}
          </Text>
        ))}
        {list.items.length > 3 && (
          <Text style={styles.moreItems}>
            +{list.items.length - 3} more items
          </Text>
        )}
      </View>
      
      <View style={styles.listActions}>
        <TouchableOpacity style={styles.compareButton}>
          <Text style={styles.compareButtonText}>Compare Prices</Text>
        </TouchableOpacity>
        <Text style={styles.lastUpdated}>
          Created {list.createdAt.toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderUploadModal = () => (
    <Modal
      visible={showUploadModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowUploadModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Your List</Text>
            <TouchableOpacity
              onPress={() => setShowUploadModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Let Pricewise read your receipt or grocery list
          </Text>
          
          <View style={styles.uploadOptions}>
            <TouchableOpacity
              style={styles.uploadOption}
              onPress={() => handleFileUpload('document')}
            >
              <FileText size={32} color={Colors.primary} />
              <Text style={styles.optionTitle}>Upload File</Text>
              <Text style={styles.optionSubtitle}>PDF, Excel, or Text file</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.uploadOption}
              onPress={() => handleFileUpload('image')}
            >
              <ImageIcon size={32} color={Colors.primary} />
              <Text style={styles.optionTitle}>Choose Photo</Text>
              <Text style={styles.optionSubtitle}>From your photo library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.uploadOption}
              onPress={() => handleFileUpload('camera')}
            >
              <Camera size={32} color={Colors.primary} />
              <Text style={styles.optionTitle}>Take Photo</Text>
              <Text style={styles.optionSubtitle}>Scan receipt or list</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderNewListModal = () => (
    <Modal
      visible={showNewListModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowNewListModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New List</Text>
            <TouchableOpacity
              onPress={() => setShowNewListModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>List Name</Text>
            <TextInput
              style={styles.textInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="e.g., Weekly Groceries"
            />
            
            <Text style={styles.inputLabel}>Items (one per line)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={newListItems}
              onChangeText={setNewListItems}
              placeholder="Milk&#10;Bread&#10;Eggs&#10;..."
              multiline
              numberOfLines={6}
            />
            
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateNewList}
            >
              <Text style={styles.createButtonText}>Create List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Grocery Lists</Text>
        <Text style={styles.subtitle}>
          Organize your shopping and find the best prices
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setShowNewListModal(true)}
        >
          <Plus size={20} color={Colors.background} />
          <Text style={styles.primaryButtonText}>New List</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowUploadModal(true)}
        >
          <Upload size={20} color={Colors.primary} />
          <Text style={styles.secondaryButtonText}>Upload</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Lists ({lists.length})</Text>
          {lists.map(renderList)}
        </View>
        
        {lists.length === 0 && (
          <View style={styles.emptyContainer}>
            <File size={64} color={Colors.text.light} />
            <Text style={styles.emptyTitle}>No lists yet</Text>
            <Text style={styles.emptyText}>
              Create your first grocery list or upload an existing one
            </Text>
          </View>
        )}
      </ScrollView>

      {renderUploadModal()}
      {renderNewListModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.background,
    marginLeft: Spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  listCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  listName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  listItems: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  itemsPreview: {
    marginBottom: Spacing.md,
  },
  itemText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  moreItems: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  listActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compareButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  compareButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: 34, // Safe area padding
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  uploadOptions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  uploadOption: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: Spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.background,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});