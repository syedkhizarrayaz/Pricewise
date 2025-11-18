import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocation } from '@/hooks/useLocation';
import { useGroceryPricing } from '@/hooks/useGroceryPricing';
import { Colors, Spacing } from '@/constants';
import { Store, GroceryItem } from '@/types';

export default function GroceryPriceFinder() {
  const { location, getCurrentLocation, loading: locationLoading } = useLocation();
  const {
    stores,
    items,
    bestPrices,
    totalSavings,
    searchRadius,
    loading: pricingLoading,
    error,
    searchStores,
    getPriceComparison,
    clearError,
  } = useGroceryPricing();

  const [groceryItems, setGroceryItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Sample grocery items for quick testing
  const sampleItems = [
    'milk', 'bread', 'eggs', 'bananas', 'chicken',
    'rice', 'pasta', 'tomatoes', 'onions', 'potatoes',
    'cheese', 'yogurt', 'cereal', 'juice', 'soda'
  ];

  useEffect(() => {
    // Auto-load location on component mount
    if (!location) {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const addItem = () => {
    if (newItem.trim() && !groceryItems.includes(newItem.trim().toLowerCase())) {
      setGroceryItems([...groceryItems, newItem.trim().toLowerCase()]);
      setNewItem('');
    }
  };

  const removeItem = (item: string) => {
    setGroceryItems(groceryItems.filter(i => i !== item));
    setSelectedItems(selectedItems.filter(i => i !== item));
  };

  const toggleItemSelection = (item: string) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const addSampleItems = () => {
    const itemsToAdd = sampleItems.filter(item => !groceryItems.includes(item));
    setGroceryItems([...groceryItems, ...itemsToAdd.slice(0, 5)]);
  };

  const findStores = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services to find nearby stores.');
      return;
    }

    try {
      await searchStores(location, 5);
    } catch (error) {
      console.error('Error finding stores:', error);
    }
  };

  const comparePrices = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please enable location services to compare prices.');
      return;
    }

    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to compare prices.');
      return;
    }

    try {
      await getPriceComparison(selectedItems, location);
    } catch (error) {
      console.error('Error comparing prices:', error);
    }
  };

  const renderStoreCard = (store: Store) => (
    <View key={store.id} style={styles.storeCard}>
      <View style={styles.storeHeader}>
        <Text style={styles.storeName}>{store.name}</Text>
        <View style={styles.storeRating}>
          <Text style={styles.ratingText}>★ {store.rating}</Text>
        </View>
      </View>
      <Text style={styles.storeAddress}>{store.address}</Text>
      <View style={styles.storeDetails}>
        <Text style={styles.distanceText}>{store.distance} miles away</Text>
        <Text style={styles.priceScoreText}>Price Score: {store.priceScore}/10</Text>
        <Text style={[styles.statusText, { color: store.isOpen ? Colors.success : Colors.error }]}>
          {store.isOpen ? 'Open' : 'Closed'}
        </Text>
      </View>
    </View>
  );

  const renderItemCard = (item: GroceryItem) => {
    const bestPrice = bestPrices[item.id];
    const lowestPrice = item.prices.reduce((min, price) => 
      price.price < min.price ? price : min
    );
    const highestPrice = item.prices.reduce((max, price) => 
      price.price > max.price ? price : max
    );

    return (
      <View key={item.id} style={styles.itemCard}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.priceRange}>
          <Text style={styles.lowestPrice}>Lowest: ${lowestPrice.price}</Text>
          <Text style={styles.highestPrice}>Highest: ${highestPrice.price}</Text>
        </View>
        {bestPrice && (
          <View style={styles.bestPriceContainer}>
            <Text style={styles.bestPriceText}>
              Best Price: ${bestPrice.price} at {bestPrice.storeName}
            </Text>
          </View>
        )}
        <View style={styles.priceList}>
          {item.prices.map((price, index) => (
            <View key={index} style={styles.priceItem}>
              <Text style={styles.storeName}>{price.storeName}</Text>
              <Text style={[styles.price, price.onSale && styles.salePrice]}>
                ${price.price}
              </Text>
              {price.onSale && (
                <Text style={styles.originalPrice}>${price.salePrice}</Text>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grocery Price Finder</Text>
        <Text style={styles.subtitle}>Find the best prices for your grocery items</Text>
      </View>

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        {locationLoading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : location ? (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>
              {location.city || location.zipCode}, {location.state || 'Unknown'}
            </Text>
            <Text style={styles.coordinatesText}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
            <Text style={styles.buttonText}>Get Current Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Store Search Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nearby Stores</Text>
        <TouchableOpacity 
          style={[styles.button, !location && styles.buttonDisabled]} 
          onPress={findStores}
          disabled={!location || pricingLoading}
        >
          {pricingLoading ? (
            <ActivityIndicator size="small" color={Colors.text.inverse} />
          ) : (
            <Text style={styles.buttonText}>Find Stores</Text>
          )}
        </TouchableOpacity>
        
        {stores.length > 0 && (
          <View style={styles.storesContainer}>
            <Text style={styles.resultsText}>
              Found {stores.length} stores within {searchRadius} miles
            </Text>
            {stores.map(renderStoreCard)}
          </View>
        )}
      </View>

      {/* Grocery Items Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Grocery Items</Text>
        
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add grocery item..."
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={addItem}
          />
          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sampleButton} onPress={addSampleItems}>
          <Text style={styles.sampleButtonText}>Add Sample Items</Text>
        </TouchableOpacity>

        {groceryItems.length > 0 && (
          <View style={styles.itemsContainer}>
            <Text style={styles.itemsTitle}>Available Items:</Text>
            {groceryItems.map(item => (
              <View key={item} style={styles.itemRow}>
                <TouchableOpacity
                  style={[styles.itemCheckbox, selectedItems.includes(item) && styles.itemCheckboxSelected]}
                  onPress={() => toggleItemSelection(item)}
                >
                  {selectedItems.includes(item) && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.itemText}>{item}</Text>
                <TouchableOpacity onPress={() => removeItem(item)}>
                  <Text style={styles.removeButton}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Price Comparison Section */}
      {selectedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Comparison</Text>
          <TouchableOpacity 
            style={[styles.button, !location && styles.buttonDisabled]} 
            onPress={comparePrices}
            disabled={!location || pricingLoading}
          >
            {pricingLoading ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Compare Prices</Text>
            )}
          </TouchableOpacity>

          {totalSavings > 0 && (
            <View style={styles.savingsContainer}>
              <Text style={styles.savingsText}>
                Potential Savings: ${totalSavings.toFixed(2)}
              </Text>
            </View>
          )}

          {items.length > 0 && (
            <View style={styles.itemsResultsContainer}>
              {items.map(renderItemCard)}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.inverse,
    opacity: 0.9,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  locationInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  coordinatesText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  locationButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  buttonDisabled: {
    backgroundColor: Colors.disabled,
  },
  buttonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  storesContainer: {
    marginTop: Spacing.md,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  storeCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  storeRating: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  storeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  priceScoreText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addItemContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  sampleButton: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sampleButtonText: {
    color: Colors.text.primary,
    fontWeight: '500',
  },
  itemsContainer: {
    marginTop: Spacing.md,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  removeButton: {
    fontSize: 20,
    color: Colors.error,
    fontWeight: 'bold',
    paddingHorizontal: Spacing.sm,
  },
  savingsContainer: {
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  savingsText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  itemsResultsContainer: {
    marginTop: Spacing.md,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  priceRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  lowestPrice: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '600',
  },
  highestPrice: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '600',
  },
  bestPriceContainer: {
    backgroundColor: Colors.accent,
    padding: Spacing.sm,
    borderRadius: 4,
    marginBottom: Spacing.sm,
  },
  bestPriceText: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  priceList: {
    marginTop: Spacing.sm,
  },
  priceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  price: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  salePrice: {
    color: Colors.success,
    fontWeight: 'bold',
  },
  originalPrice: {
    fontSize: 12,
    color: Colors.text.secondary,
    textDecorationLine: 'line-through',
  },
});
