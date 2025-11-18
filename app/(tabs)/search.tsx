import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
// Conditional import for WebView
let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  console.log('WebView not available on this platform');
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, Navigation, Edit3, ExternalLink } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants';
import { useLocation } from '@/hooks/useLocation';
import { useGroceryPrices } from '@/hooks/useGroceryPrices';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { API_CONFIG } from '@/config/api';

export default function SearchScreen() {
  const { location, getCurrentLocation } = useLocation();
  const { loading, error, result, fetchPrices, clearError, clearResult } = useGroceryPrices();
  const { userAddress, userZipCode, setUserLocation } = useUserLocation();
  
  // State
  const [groceryItems, setGroceryItems] = useState<string>('');
  const [manualLocation, setManualLocation] = useState<string>('');
  const [manualZipCode, setManualZipCode] = useState<string>('');
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'details'>('table');
  const [useMockData, setUseMockData] = useState(false); // Keep for fallback only
  const [locationSaved, setLocationSaved] = useState(false);
  const [autocompleteAddress, setAutocompleteAddress] = useState<string>('');
  const [autocompleteZipCode, setAutocompleteZipCode] = useState<string>('');
  const [showWebView, setShowWebView] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const webViewRef = useRef<any>(null);
  const autocompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fill location when available
  useEffect(() => {
    if (location && !manualLocation && !manualZipCode) {
      setManualLocation(`${location.city}, ${location.state}`);
      setManualZipCode(location.zipCode || '');
    }
  }, [location]);

  // Auto-save manual location to context when user finishes typing (debounced)
  useEffect(() => {
    if (showManualLocation && manualLocation && manualZipCode) {
      setLocationSaved(false); // Reset saved status
      const timer = setTimeout(() => {
        console.log('📍 [Search] Auto-saving manual location to context:', { manualLocation, manualZipCode });
        setUserLocation(manualLocation, manualZipCode);
        setLocationSaved(true); // Mark as saved
      }, 1000); // Wait 1 second after user stops typing

      return () => clearTimeout(timer);
    }
  }, [manualLocation, manualZipCode, showManualLocation, setUserLocation]);

  // HTML content for Google Maps Autocomplete WebView using working template
  const autocompleteHTML = `
    <!doctype html>
    <html>
      <head>
        <title>Place Autocomplete element</title>
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          p {
            font-family: Roboto, sans-serif;
            font-weight: bold;
            margin-bottom: 10px;
          }
          
          #selected-place {
            margin-top: 10px;
            padding: 10px;
            background-color: #f5f5f5;
            border-radius: 4px;
            font-size: 14px;
            display: none;
          }
          
          #select-button {
            margin-top: 10px;
            padding: 8px 16px;
            background-color: #1976d2;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <p>Search for a place here:</p>
        
        <div id="selected-place">
          <strong>Selected Address:</strong><br>
          <span id="selected-address"></span><br>
          <span id="selected-zip" style="display: none;"><strong>Zip Code:</strong> <span id="zip-value"></span><br></span>
          <button id="select-button" onclick="selectPlace()">Select This Address</button>
        </div>

        <script>
          (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})
          ({key: "${API_CONFIG.GOOGLE_PLACES_API_KEY}", v: "weekly"});
        </script>

        <script type="text/javascript">
          async function initMap() {
            // Request needed libraries.
            await google.maps.importLibrary("places");
            // Create the input HTML element, and append it.
            const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement();
            
            // Set zoom level for better view (higher number = more zoomed in)
            placeAutocomplete.setAttribute('zoom', '15');
            placeAutocomplete.setAttribute('center', '32.7767,-96.7970'); // Dallas area center
            
            document.body.appendChild(placeAutocomplete);
            
            // Add the gmp-select listener, and display the results.
            placeAutocomplete.addEventListener('gmp-select', async ({ placePrediction }) => {
              const place = placePrediction.toPlace();
              await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'addressComponents'] });
              
              const address = place.formattedAddress || '';
              let zipCode = '';
              
              // Extract zip code from address components
              if (place.addressComponents) {
                for (let component of place.addressComponents) {
                  if (component.types && component.types.includes('postal_code')) {
                    zipCode = component.longText || component.shortText || '';
                    break;
                  }
                }
              }
              
              // If no zip code found in components, try to extract from address
              if (!zipCode && address) {
                const zipMatch = address.match(/\\b\\d{5}(-\\d{4})?\\b/);
                if (zipMatch) {
                  zipCode = zipMatch[0];
                }
              }
              
              // Display selected place info
              document.getElementById('selected-address').textContent = address;
              
              if (zipCode) {
                document.getElementById('zip-value').textContent = zipCode;
                document.getElementById('selected-zip').style.display = 'block';
              } else {
                document.getElementById('selected-zip').style.display = 'none';
              }
              
              document.getElementById('selected-place').style.display = 'block';
              
              // Store the place data globally for the select button
              window.selectedPlaceData = {
                address: address,
                zipCode: zipCode
              };
            });
          }
          
          function selectPlace() {
            if (window.selectedPlaceData) {
              // Send the selected place data to React Native
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PLACE_SELECTED',
                data: window.selectedPlaceData
              }));
            }
          }
          
          // Initialize when the page loads
          initMap();
        </script>
      </body>
    </html>
  `;

  // Handle messages from WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'PLACE_SELECTED') {
        const { address, zipCode } = message.data;
        
        console.log('📍 [Autocomplete] Place selected:', { address, zipCode });
        
        // Update states
        setAutocompleteAddress(address);
        setAutocompleteZipCode(zipCode);
        setManualLocation(address);
        setManualZipCode(zipCode);
        
        // Auto-save to context
        setUserLocation(address, zipCode);
        setLocationSaved(true);
        
        // Hide WebView
        setShowWebView(false);
      }
    } catch (error) {
      console.error('📍 [Autocomplete] Error parsing WebView message:', error);
    }
  };

  // Fallback native autocomplete using Google Places API searchText
  const fetchAutocompleteSuggestions = async (input: string) => {
    if (!input.trim() || input.length < 3) {
      setAutocompleteSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_CONFIG.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.addressComponents'
          },
          body: JSON.stringify({
            textQuery: input,
            maxResultCount: 5,
            locationBias: {
              region: 'US'
            }
          })
        }
      );
      
      const data = await response.json();
      
      if (data.places && data.places.length > 0) {
        const suggestions = data.places.map((place: any) => ({
          place_id: place.id || Math.random().toString(36).substr(2, 9),
          description: place.formattedAddress || place.displayName?.text || 'Unknown address',
          formatted_address: place.formattedAddress,
          address_components: place.addressComponents
        }));
        
        setAutocompleteSuggestions(suggestions);
        setShowSuggestions(true);
      } else {
        setAutocompleteSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('📍 [Autocomplete] Error fetching suggestions:', error);
      setAutocompleteSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle suggestion selection for native autocomplete
  const handleSuggestionSelect = (suggestion: any) => {
    const address = suggestion.formatted_address || suggestion.description || '';
    let zipCode = '';
    
    // Extract zip code from address components
    if (suggestion.address_components) {
      for (let component of suggestion.address_components) {
        if (component.types && component.types.includes('postal_code')) {
          zipCode = component.longText || component.shortText || '';
          break;
        }
      }
    }
    
    // If no zip code found in components, try to extract from address
    if (!zipCode && address) {
      const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
      if (zipMatch) {
        zipCode = zipMatch[0];
      }
    }
    
    console.log('📍 [Autocomplete] Place selected:', { address, zipCode });
    
    // Update states
    setAutocompleteAddress(address);
    setAutocompleteZipCode(zipCode);
    setManualLocation(address);
    setManualZipCode(zipCode);
    
    // Auto-save to context
    setUserLocation(address, zipCode);
    setLocationSaved(true);
    
    // Hide suggestions
    setShowSuggestions(false);
    setAutocompleteSuggestions([]);
  };

  // Handle address input change (no longer needed since we removed the input field)
  const handleAddressInputChange = (text: string) => {
    // This function is kept for compatibility but not used
    // since we removed the address input field
  };

  // Clean store names by removing delivery service prefixes/suffixes
  const cleanStoreName = (storeName: string): string => {
    const deliveryServices = ['Instacart', 'Uber Eats', 'DoorDash'];
    
    let cleanedName = storeName;
    
    // Remove delivery service names from the beginning or end
    deliveryServices.forEach(service => {
      // Remove from beginning (e.g., "Instacart - Kroger" -> "Kroger")
      cleanedName = cleanedName.replace(new RegExp(`^${service}\\s*-?\\s*`, 'i'), '');
      // Remove from end (e.g., "Kroger - Instacart" -> "Kroger")
      cleanedName = cleanedName.replace(new RegExp(`\\s*-?\\s*${service}$`, 'i'), '');
      // Remove from middle (e.g., "Kroger via Instacart" -> "Kroger")
      cleanedName = cleanedName.replace(new RegExp(`\\s+via\\s+${service}\\s*`, 'i'), ' ');
      cleanedName = cleanedName.replace(new RegExp(`\\s+${service}\\s+`, 'i'), ' ');
    });
    
    // Clean up any extra spaces or dashes
    cleanedName = cleanedName.replace(/\s+-\s*$/, '').replace(/^\s*-\s+/, '').trim();
    
    return cleanedName || storeName; // Fallback to original if cleaning results in empty string
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!groceryItems.trim()) {
      Alert.alert('Error', 'Please enter at least one grocery item');
      return;
    }

    const items = groceryItems
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (items.length === 0) {
      Alert.alert('Error', 'Please enter valid grocery items');
      return;
    }

    const locationToUse = showManualLocation ? manualLocation : `${location?.city}, ${location?.state}`;
    const zipCodeToUse = showManualLocation ? manualZipCode : location?.zipCode;

    if (!locationToUse) {
      Alert.alert('Error', 'Please provide a valid location');
      return;
    }

    // Set user location in context for other tabs to use
    console.log('📍 [Search] Setting user location:', { locationToUse, zipCodeToUse });
    setUserLocation(locationToUse, zipCodeToUse || '');
    console.log('📍 [Search] User location set in context');
    
    // Test if context is working by reading it back
    setTimeout(() => {
      console.log('📍 [Search] Testing context after 1 second...');
      // This will be logged by the hook
    }, 1000);

    console.log('🛒 [Search] Starting price comparison:', {
      items,
      location: locationToUse,
      zipCode: zipCodeToUse,
      useManualLocation: showManualLocation,
      useRealTimeData: true
    });

    // Always use real-time data, fallback to mock only if API fails
    try {
      await fetchPrices(items, locationToUse, '', false, location?.latitude, location?.longitude);
    } catch (error) {
      console.warn('🛒 [Search] Real-time search failed, using mock data as fallback:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('Network') || errorMessage.includes('Connection')) {
        Alert.alert(
          'Connection Issue',
          'Having trouble connecting to the price service. Using sample data for demonstration.',
          [{ text: 'OK' }]
        );
      }
      
      await fetchPrices(items, locationToUse, '', true);
    }
  };

  const handleDirections = async (storeAddress: string) => {
    console.log('🗺️ [Directions] Opening directions to:', storeAddress);
    
    if (!storeAddress) {
      Alert.alert(
        'No Address',
        'Store address not available for directions',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Debug all available location sources
      console.log('🗺️ [Directions] Debug location sources:', {
        userAddress,
        userZipCode,
        manualLocation,
        manualZipCode,
        gpsLocation: location ? `${location.city}, ${location.state} ${location.zipCode}` : null
      });
      
      // Get user's location from context (manual address) or GPS location
      const userLocation = (userAddress && userZipCode) 
        ? `${userAddress} ${userZipCode}` 
        : manualLocation 
          ? `${manualLocation} ${manualZipCode}`
          : (location ? `${location.city}, ${location.state} ${location.zipCode}` : '');
      
      console.log('🗺️ [Directions] User location for directions:', userLocation);
      
      if (!userLocation) {
        console.log('🗺️ [Directions] No user location available, showing alert');
        Alert.alert(
          'Location Required',
          'Please enter your location in the Find tab to get directions',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Additional validation - make sure we have a valid starting point
      if (userLocation.trim() === '') {
        console.log('🗺️ [Directions] Empty user location, showing alert');
        Alert.alert(
          'Location Required',
          'Please enter your location in the Find tab to get directions',
          [{ text: 'OK' }]
        );
        return;
      }

      // Create directions URL based on platform
      let directionsUrl: string;
      
      console.log('🗺️ [Directions] Creating URL with:', {
        userLocation,
        storeAddress,
        platform: Platform.OS
      });
      
      if (Platform.OS === 'web') {
        // For web, use Google Maps web
        const encodedStart = encodeURIComponent(userLocation);
        const encodedEnd = encodeURIComponent(storeAddress);
        directionsUrl = `https://www.google.com/maps/dir/${encodedStart}/${encodedEnd}`;
        console.log('🗺️ [Directions] Web URL components:', { encodedStart, encodedEnd });
      } else {
        // For mobile, use platform-specific maps
        if (Platform.OS === 'ios') {
          const encodedStart = encodeURIComponent(userLocation);
          const encodedEnd = encodeURIComponent(storeAddress);
          directionsUrl = `http://maps.apple.com/?daddr=${encodedEnd}&saddr=${encodedStart}`;
          console.log('🗺️ [Directions] iOS URL components:', { encodedStart, encodedEnd });
        } else {
          // Android - use Google Maps
          const encodedStart = encodeURIComponent(userLocation);
          const encodedEnd = encodeURIComponent(storeAddress);
          directionsUrl = `https://www.google.com/maps/dir/${encodedStart}/${encodedEnd}`;
          console.log('🗺️ [Directions] Android URL components:', { encodedStart, encodedEnd });
        }
      }

      console.log('🗺️ [Directions] Generated URL:', directionsUrl);
      console.log('🗺️ [Directions] Starting point:', userLocation);
      console.log('🗺️ [Directions] Destination:', storeAddress);
      
      const supported = await Linking.canOpenURL(directionsUrl);
      if (supported) {
        await Linking.openURL(directionsUrl);
        console.log('🗺️ [Directions] Successfully opened directions');
      } else {
        console.log('🗺️ [Directions] Cannot open URL:', directionsUrl);
        Alert.alert(
          'Cannot Open Maps',
          'Cannot open the maps application for directions',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert(
        'Error',
        'Failed to open directions. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handlePriceClick = async (storeUrl: string | undefined, itemName: string, storeName: string) => {
    const cleanedStoreName = cleanStoreName(storeName);
    if (!storeUrl) {
      Alert.alert(
        'No URL Available',
        `Product URL not available for ${itemName} at ${cleanedStoreName}`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(storeUrl);
      if (supported) {
        await Linking.openURL(storeUrl);
      } else {
        Alert.alert(
          'Cannot Open Link',
          `Cannot open the product URL for ${itemName} at ${cleanedStoreName}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert(
        'Error',
        `Failed to open product page for ${itemName}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Helper function to render a price table for a specific store list
  const renderStoreTable = (stores: any[], title: string) => {
    if (!stores || stores.length === 0) return null;

    // Find the cheapest store index within this category
    const cheapestStoreIndex = stores.reduce((minIndex, store, index) => 
      store.totalPrice < stores[minIndex].totalPrice ? index : minIndex, 0
    );

    return (
      <View style={styles.storeTableContainer}>
        <Text style={styles.storeTableTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tableWrapper}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.tableHeaderCell}>
                <Text style={styles.tableHeaderText}>Items</Text>
              </View>
              {stores.map((store, index) => (
                <View key={index} style={[
                  styles.tableHeaderCell,
                  index === cheapestStoreIndex && styles.cheapestHeaderCell
                ]}>
                  <Text style={[
                    styles.tableHeaderText,
                    index === cheapestStoreIndex && styles.cheapestHeaderText
                  ]}>
                    {cleanStoreName(store.store.name)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Item Rows */}
            {result?.items.map((item, itemIndex) => {
              // Split item name after every two words for better alignment
              const words = item.split(' ');
              const formattedItem = words.reduce((acc, word, index) => {
                if (index > 0 && index % 2 === 0) {
                  return acc + '\n' + word;
                }
                return acc + (index === 0 ? '' : ' ') + word;
              }, '');

              return (
                <View key={itemIndex} style={styles.tableRow}>
                  <View style={styles.tableItemCell}>
                    <Text style={styles.tableItemText}>{formattedItem}</Text>
                  </View>
                  {stores.map((store, storeIndex) => {
                    // Try exact match first, then fuzzy match
                    let itemData = store.items.find((i: any) => i.name === item);
                    if (!itemData) {
                      // Try fuzzy matching - look for items that contain the requested item name
                      itemData = store.items.find((i: any) => 
                        i.name.toLowerCase().includes(item.toLowerCase()) || 
                        item.toLowerCase().includes(i.name.toLowerCase())
                      );
                    }
                    if (!itemData && store.items.length > 0) {
                      // If still no match, use the first item (for AI stores that might have different naming)
                      itemData = store.items[0];
                    }
                    const itemPrice = itemData?.price || 0;
                    const exactMatch = itemData?.exactMatch !== false; // Default to true
                    const isAI = itemData?.isAI === true;
                    const showAsterisk = !exactMatch;
                    
                    return (
                      <View 
                        key={storeIndex} 
                        style={[
                          styles.tablePriceCell,
                          storeIndex === cheapestStoreIndex && styles.cheapestPriceCell,
                          isAI && styles.aiPriceCell // Gray background for AI prices
                        ]}
                      >
                        <Text style={[
                          styles.tablePriceText,
                          storeIndex === cheapestStoreIndex && styles.cheapestPriceText
                        ]}>
                          ${itemPrice.toFixed(2)}{showAsterisk ? ' *' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Total Row */}
            <View style={styles.tableTotalRow}>
              <View style={styles.tableItemCell}>
                <Text style={styles.tableTotalText}>Total</Text>
              </View>
              {stores.map((store, storeIndex) => (
                <View key={storeIndex} style={[
                  styles.tablePriceCell,
                  storeIndex === cheapestStoreIndex && styles.cheapestPriceCell
                ]}>
                  <Text style={[
                    styles.tablePriceText,
                    storeIndex === cheapestStoreIndex && styles.cheapestPriceText
                  ]}>
                    ${store.totalPrice.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Notes Section */}
            <View style={styles.tableNotesContainer}>
              <Text style={styles.tableNotesText}>
                <Text style={styles.tableNotesBullet}>• </Text>
                Prices with <Text style={styles.tableNotesAsterisk}>*</Text> are equivalent products{'\n'}
                <Text style={styles.tableNotesBullet}>• </Text>
                Prices with grayish background are AI real-time pricing
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderPriceTable = () => {
    if (!result || !result.stores || result.stores.length === 0) return null;

    return (
      <View style={styles.tableContainer}>
        <Text style={styles.tableTitle}>
          Price Comparison - {result.location.address}, {result.location.zipCode}
        </Text>
        
        {/* Major Stores Table */}
        {result.majorStores && result.majorStores.length > 0 && (
          renderStoreTable(result.majorStores, "Major Stores")
        )}
        
        {/* Local / Online Stores Table */}
        {result.localStores && result.localStores.length > 0 && (
          renderStoreTable(result.localStores, "Local / Online Stores")
        )}
      </View>
    );
  };

  const renderStoreDetails = () => {
    if (!result || !result.stores || result.stores.length === 0) return null;

    // Find the cheapest store index
    const cheapestStoreIndex = result.stores.reduce((minIndex, store, index) => 
      store.totalPrice < result.stores[minIndex].totalPrice ? index : minIndex, 0
    );

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Store Details</Text>
        {result.stores.map((store, index) => (
          <View key={index} style={[
            styles.storeCard,
            index === cheapestStoreIndex && styles.cheapestStoreCard
          ]}>
            <View style={styles.storeHeader}>
              <Text style={styles.storeName}>{cleanStoreName(store.store.name)}</Text>
              <Text style={[
                styles.storeTotal,
                index === cheapestStoreIndex && styles.cheapestStoreTotal
              ]}>
                ${store.totalPrice.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.storeAddress}>{store.store.address}</Text>
            <Text style={styles.storeDistance}>{store.store.distance.toFixed(1)} miles away</Text>
            
            {/* Directions Button */}
            <TouchableOpacity 
              style={styles.directionsButton}
              onPress={() => handleDirections(store.store.address)}
              activeOpacity={0.7}
            >
              <Navigation size={16} color={Colors.primary} />
              <Text style={styles.directionsButtonText}>Directions</Text>
            </TouchableOpacity>
            <View style={styles.storeItems}>
              {store.items.map((item, itemIndex) => {
                const exactMatch = item.exactMatch !== false;
                const isAI = item.isAI === true;
                const showAsterisk = !exactMatch;
                
                return (
                  <View 
                    key={itemIndex} 
                    style={[
                      styles.storeItem,
                      isAI && styles.aiPriceItem
                    ]}
                  >
                    <Text style={styles.storeItemName}>{item.name}</Text>
                    <View style={styles.storeItemPriceContainer}>
                      <Text style={styles.storeItemPrice}>
                        ${item.price.toFixed(2)}{showAsterisk ? ' *' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
        </View>
            ))}
      </View>
    );
  };

    return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
          <Text style={styles.title}>Grocery Price Comparison</Text>
          <Text style={styles.subtitle}>Find the best deals near you</Text>
        </View>
        
        {/* Location Section */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <MapPin size={20} color={Colors.primary} />
            <Text style={styles.locationTitle}>Location</Text>
            <TouchableOpacity
              style={styles.locationToggle}
              onPress={() => {
                setShowManualLocation(!showManualLocation);
                // Always show WebView when in manual mode
                if (!showManualLocation) {
                  setShowWebView(true);
                }
              }}
            >
              <Edit3 size={16} color={Colors.primary} />
              <Text style={styles.locationToggleText}>
                {showManualLocation ? 'Use GPS' : 'Manual'}
              </Text>
            </TouchableOpacity>
          </View>

          {showManualLocation ? (
            <View style={styles.manualLocationContainer}>
              {/* Google Maps Search - Direct Integration */}
              {WebView && (
                <View style={styles.webViewContainer}>
                  <Text style={styles.webViewInstruction}>
                    🔍 Search for a place using the map below
                  </Text>
                  <WebView
                    ref={webViewRef}
                    source={{ html: autocompleteHTML }}
                    style={styles.webView}
                    onMessage={handleWebViewMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    scalesPageToFit={true}
                  />
                </View>
              )}

              {/* Native Autocomplete Fallback */}
              {!WebView && (
                <View style={styles.autocompleteContainer}>
                  <Text style={styles.fallbackInstruction}>
                    🔍 Search for a place (WebView not available)
                  </Text>
                  {/* Loading indicator */}
                  {isLoadingSuggestions && (
                    <View style={styles.loadingContainer}>
                      <Text style={styles.loadingText}>Searching addresses...</Text>
                    </View>
                  )}

                  {/* Suggestions dropdown */}
                  {showSuggestions && autocompleteSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      {autocompleteSuggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={suggestion.place_id}
                          style={styles.suggestionItem}
                          onPress={() => handleSuggestionSelect(suggestion)}
                        >
                          <Text style={styles.suggestionText}>{suggestion.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
              
              {/* Display selected address */}
              {autocompleteAddress && (
                <View style={styles.selectedAddressContainer}>
                  <Text style={styles.selectedAddressLabel}>Selected Address:</Text>
                  <Text style={styles.selectedAddressText}>{autocompleteAddress}</Text>
                  {autocompleteZipCode && (
                    <Text style={styles.selectedZipText}>Zip: {autocompleteZipCode}</Text>
                  )}
                  {locationSaved && (
                    <Text style={styles.locationSavedText}>✅ Location saved for Stores tab</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.gpsLocationContainer}>
              {location ? (
                <View style={styles.locationBadge}>
                  <MapPin size={16} color={Colors.primary} />
                  <Text style={styles.locationText}>
                    {location.city}, {location.state} {location.zipCode}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.locationRequestButton}
                  onPress={getCurrentLocation}
                >
                  <Navigation size={16} color={Colors.text.inverse} />
                  <Text style={styles.locationRequestText}>Enable Location</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Grocery Items Input */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Grocery Items</Text>
          <TextInput
            style={styles.itemsInput}
            // placeholder="Enter grocery items (one per line):&#10;Eggs one dozen&#10;Whole milk 1 gallon&#10;Banana count 12&#10;Apple 2lb&#10;Sugar 2lb&#10;Cooking oil 5 litres"
            placeholder="Enter grocery items (one per line):&#10; Item name, Quantity, Unit of Measure, Brand"
            value={groceryItems}
            onChangeText={setGroceryItems}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Real-time Data Info */}
        <View style={styles.mockDataSection}>
          <View style={styles.realTimeInfo}>
            <Text style={styles.realTimeText}>🤖 AI-powered price comparison</Text>
            <Text style={styles.realTimeSubtext}>Finding prices at major chains and local stores</Text>
          </View>
        </View>

        {/* Search Button */}
        <View style={styles.searchButtonContainer}>
          {/* Debug Info */}
          {/* <Text style={styles.debugInfo}>
            Items: {groceryItems.trim() ? '✓' : '✗'} | Location: {showManualLocation ? (manualLocation && manualZipCode ? '✓' : '✗') : (location ? '✓' : '✗')} | Context: {locationSaved ? '✅ Saved' : '⏳ Pending'}
            </Text> */}
            {/* {__DEV__ && (
              <Text style={styles.debugInfo}>
                Context: {userAddress || 'none'} | {userZipCode || 'none'}
              </Text>
            )} */}
          
          <TouchableOpacity
            style={[styles.searchButton, (!groceryItems.trim() || loading) && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!groceryItems.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <>
                <Search size={20} color={Colors.text.inverse} />
                <Text style={styles.searchButtonText}>
                  {!groceryItems.trim() ? 'Enter Items to Search' : 'Find Best Prices'}
            </Text>
              </>
            )}
          </TouchableOpacity>
          
          {/* Debug Test Button */}
          {/* {__DEV__ && (
          <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: Colors.accent, marginTop: 8 }]}
              onPress={() => {
                console.log('🧪 [Search] Manual test - setting location');
                setUserLocation('Test Address from Search', '12345');
              }}
            >
              <Text style={styles.searchButtonText}>Test Set Location</Text>
          </TouchableOpacity>
          )} */}
          
          {/* Test Directions Button */}
          {/* {__DEV__ && (
                <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: Colors.warning, marginTop: 8 }]}
                  onPress={() => {
                console.log('🧪 [Search] Testing directions with current location');
                handleDirections('1234 Test Store Address, Test City, TX 12345');
              }}
            >
              <Text style={styles.searchButtonText}>Test Directions</Text>
                </TouchableOpacity>
          )} */}
            </View>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.errorButtons}>
              <TouchableOpacity style={styles.retryButton} onPress={clearError}>
                <Text style={styles.retryButtonText}>Dismiss</Text>
              </TouchableOpacity>
              {error.includes('timeout') || error.includes('Network') || error.includes('Connection') ? (
                <TouchableOpacity
                  style={styles.retryButton} 
                  onPress={() => {
                    clearError();
                    handleSearch();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
          </View>
      </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Finding prices at stores near you...</Text>
            <Text style={styles.loadingSubtext}>Checking major chains and local stores</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultsSection}>
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Best Deal Found!</Text>
              <Text style={styles.summaryText}>
                {result.cheapestStore} offers the best total price of ${result.stores[0]?.totalPrice?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.savingsText}>
                You can save up to ${result.totalSavings.toFixed(2)} compared to the most expensive store
            </Text>
          </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'table' && styles.activeTabButton]}
                onPress={() => setActiveTab('table')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'table' && styles.activeTabButtonText]}>
                  Price Table
            </Text>
              </TouchableOpacity>
                <TouchableOpacity
                style={[styles.tabButton, activeTab === 'details' && styles.activeTabButton]}
                onPress={() => setActiveTab('details')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'details' && styles.activeTabButtonText]}>
                  Store Details
                </Text>
                </TouchableOpacity>
            </View>

            {/* Results Content */}
            {activeTab === 'table' ? renderPriceTable() : renderStoreDetails()}
            
            {/* AI Disclaimer */}
            {result && result.stores && result.stores.length > 0 && result.aiStoreNames && result.aiStoreNames.length > 0 && (
              <View style={styles.disclaimerContainer}>
                <Text style={styles.disclaimerTitle}>Price Information</Text>
                <Text style={styles.disclaimerText}>
                  Prices for {result.aiStoreNames.join(', ')} are estimated and may vary. Real-time prices are shown where available.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  locationSection: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.sm,
  },
  locationToggleText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  manualLocationContainer: {
    gap: Spacing.sm,
  },
  webViewContainer: {
    height: 175,
    width: '100%',
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webView: {
    flex: 1,
    minHeight: 175,
  },
  webViewInstruction: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  fallbackInstruction: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    maxHeight: 200,
    zIndex: 1001,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  loadingContainer: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  selectedAddressContainer: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  selectedAddressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: Spacing.xs,
  },
  selectedAddressText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  selectedZipText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  fallbackInputContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  fallbackLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  locationSavedIndicator: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  locationSavedText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  locationInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  zipInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
    width: 120,
  },
  gpsLocationContainer: {
    alignItems: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
  },
  locationText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  locationRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  locationRequestText: {
    fontSize: 16,
    color: Colors.text.inverse,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  itemsSection: {
    margin: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  itemsInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
    minHeight: 120,
  },
  mockDataSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  mockDataToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: 'bold',
  },
  mockDataText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  realTimeInfo: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  realTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: Spacing.xs,
  },
  realTimeSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  searchButtonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  debugInfo: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontFamily: 'monospace',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonDisabled: {
    backgroundColor: Colors.text.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  searchButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.inverse,
    marginLeft: Spacing.sm,
  },
  errorContainer: {
    backgroundColor: Colors.error + '20',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
  },
  retryButtonText: {
    fontSize: 14,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  resultsSection: {
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  summaryContainer: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
    marginBottom: Spacing.sm,
  },
  summaryText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  savingsText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  activeTabButton: {
    backgroundColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabButtonText: {
    color: Colors.text.inverse,
  },
  tableContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  storeTableContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
  },
  storeTableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    padding: Spacing.md,
    backgroundColor: Colors.primary + '10',
    textAlign: 'center',
  },
  tableWrapper: {
    minWidth: 600,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
  },
  tableHeaderCell: {
    width: 120, // Fixed width for store columns
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs, // Reduced padding for better centering
    paddingVertical: Spacing.xs,
  },
  tableHeaderText: {
    color: Colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    width: '100%', // Ensure full width for proper centering
    alignSelf: 'center', // Force center alignment
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'flex-start', // Allow items to align at top
  },
  tableItemCell: {
    width: 150, // Fixed width for items column
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    justifyContent: 'flex-start',
    minHeight: 40, // Ensure minimum height for wrapping
  },
  tableItemText: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
    lineHeight: 18,
    flexWrap: 'wrap', // Allow text wrapping
    textAlign: 'left', // Ensure left alignment for better readability
  },
  tablePriceCell: {
    width: 120, // Fixed width for price columns
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs, // Reduced padding for better centering
    paddingVertical: Spacing.xs,
    minHeight: 40, // Ensure minimum height for wrapping
  },
  aiPriceCell: {
    backgroundColor: '#E0E0E0', // Darker gray background for AI prices (more visible)
  },
  tablePriceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 18,
    flexWrap: 'wrap', // Allow text wrapping
    width: '100%', // Ensure full width for proper centering
    alignSelf: 'center', // Force center alignment
  },
  priceLinkIcon: {
    marginTop: 2,
  },
  totalRow: {
    backgroundColor: Colors.primary + '10',
    fontWeight: 'bold',
  },
  tableTotalRow: {
    backgroundColor: Colors.primary + '10',
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  tableTotalCell: {
    width: 120, // Fixed width for total columns
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs, // Reduced padding for better centering
    paddingVertical: Spacing.xs,
    minHeight: 40, // Ensure minimum height for wrapping
  },
  tableTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 20,
    flexWrap: 'wrap', // Allow text wrapping
    width: '100%', // Ensure full width for proper centering
    alignSelf: 'center', // Force center alignment
  },
  tableTotalLabel: {
    width: 150, // Fixed width for total label
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    justifyContent: 'flex-start',
    minHeight: 40, // Ensure minimum height for wrapping
  },
  tableTotalLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    lineHeight: 18,
    flexWrap: 'wrap', // Allow text wrapping
  },
  // Cheapest store highlighting styles
  cheapestHeaderCell: {
    backgroundColor: Colors.success + '30',
  },
  cheapestHeaderText: {
    color: Colors.success,
  },
  cheapestPriceCell: {
    backgroundColor: Colors.success + '20',
  },
  cheapestPriceText: {
    color: Colors.success,
    fontWeight: 'bold',
  },
  cheapestTotalCell: {
    backgroundColor: Colors.success + '30',
  },
  cheapestTotalText: {
    color: Colors.success,
    fontSize: 18,
  },
  cheapestStoreCard: {
    borderColor: Colors.success,
    borderWidth: 2,
    backgroundColor: Colors.success + '10',
  },
  cheapestStoreTotal: {
    color: Colors.success,
    fontSize: 20,
  },
  detailsContainer: {
    gap: Spacing.md,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  storeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  storeTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  storeDistance: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  storeItems: {
    gap: Spacing.xs,
  },
  storeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  aiPriceItem: {
    backgroundColor: '#E0E0E0', // Darker gray background for AI prices (more visible)
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  storeItemName: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  storeItemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  storeItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  storeItemLinkIcon: {
    marginLeft: Spacing.xs,
  },
  disclaimerContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    margin: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  tableNotesContainer: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
  },
  tableNotesText: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  tableNotesBullet: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  tableNotesAsterisk: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
});