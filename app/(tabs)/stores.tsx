import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Star,
  Clock,
  Award,
  TrendingDown,
  Navigation,
  Phone,
  Globe,
  Search,
  Filter,
  RefreshCw,
  Map
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants';
import { useLocation } from '@/hooks/useLocation';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { googlePlacesService } from '@/services/googlePlacesService';
import { getStoreDirections } from '@/services/storeService';
import { Store, StoreSearchResult } from '@/types';
import { ContextTest } from '@/components/ContextTest';

// Get screen dimensions for map sizing
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function StoresScreen() {
  const router = useRouter();
  const { location, getCurrentLocation, loading: locationLoading, error: locationError } = useLocation();
  const { userAddress, userZipCode, setUserLocation } = useUserLocation();
  
  console.log('🗺️ [Stores] Component rendered with context:', { userAddress, userZipCode });
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5);
  const [maxRadius, setMaxRadius] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StoreSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [zipCodeInput, setZipCodeInput] = useState('');
  const [showZipCodeInput, setShowZipCodeInput] = useState(false);
  
  // New state for map functionality
  const [nearbyStores, setNearbyStores] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [mapUrl, setMapUrl] = useState<string>('');

  // New function to load nearby stores for map display using Google Maps JavaScript API
  const loadNearbyStoresForMap = async (address: string, radius: number = 5) => {
    try {
      setMapLoading(true);
      console.log('🗺️ [Stores] Loading nearby stores for map:', address);
      
      // Get nearby stores with addresses using Google Places API
      const storesWithAddresses = await googlePlacesService.getNearbyStoresWithAddressesNewAPI(address, radius);
      
      console.log('🗺️ [Stores] Found stores for map:', storesWithAddresses.length);
      setNearbyStores(storesWithAddresses);
      
      // Initialize Google Maps with JavaScript API
      if (Platform.OS === 'web' && storesWithAddresses.length > 0) {
        await initializeGoogleMaps(address, storesWithAddresses);
      }
      
    } catch (error) {
      console.error('❌ [Stores] Error loading nearby stores for map:', error);
      Alert.alert('Error', 'Failed to load nearby stores. Please try again.');
    } finally {
      setMapLoading(false);
    }
  };

  // Initialize Google Maps with JavaScript API
  const initializeGoogleMaps = async (address: string, stores: any[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Load Google Maps JavaScript API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyD8dkXiyOx4XoVIF4hosNG91h47zgPnsQY&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      // Define global callback function
      (window as any).initMap = async () => {
        const { Map, InfoWindow } = await (window as any).google.maps.importLibrary("maps");
        const { Place } = await (window as any).google.maps.importLibrary("places");
        const { AdvancedMarkerElement } = await (window as any).google.maps.importLibrary("marker");
        const { LatLngBounds } = await (window as any).google.maps.importLibrary("core");

        // Create map centered on the address
        const map = new Map(document.getElementById('map'), {
          center: { lat: 33.0198, lng: -96.6989 }, // Default to Plano, TX
          zoom: 13,
          mapTypeControl: false,
          mapId: 'DEMO_MAP_ID',
        });

        const infoWindow = new InfoWindow();
        const markers: any = {};

        // Search for grocery stores using searchByText with user's address
        const request = {
          textQuery: `grocery stores near ${address}`,
          fields: ['displayName', 'location', 'businessStatus', 'formattedAddress'],
          includedType: 'grocery_store',
          useStrictTypeFiltering: true,
          isOpenNow: true,
          language: 'en-US',
          maxResultCount: 8,
          minRating: 1,
          region: 'us',
        };

        console.log('🗺️ [Stores] Searching for grocery stores near:', address);

        const { places } = await Place.searchByText(request);

        if (places.length) {
          const bounds = new LatLngBounds();

          // Create markers for each place
          places.forEach((place: any, index: number) => {
            const marker = new AdvancedMarkerElement({
              map,
              position: place.location,
              title: place.displayName,
            });

            markers[place.id] = marker;

            // Add click listener
            marker.addListener('gmp-click', () => {
              map.panTo(place.location);
              updateInfoWindow(place.displayName, place.formattedAddress || place.displayName, marker);
            });

            if (place.location != null) {
              bounds.extend(place.location);
            }
          });

          map.fitBounds(bounds);
          console.log('🗺️ [Stores] Google Maps initialized with', places.length, 'stores');
        }
      };

      // Remove existing script if any
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      document.head.appendChild(script);
      
    } catch (error) {
      console.error('❌ [Stores] Error initializing Google Maps:', error);
    }
  };

  // Helper function to create an info window
  const updateInfoWindow = (title: string, content: string, anchor: any) => {
    if (typeof window !== 'undefined' && (window as any).infoWindow) {
      (window as any).infoWindow.setContent(content);
      (window as any).infoWindow.setHeaderContent(title);
      (window as any).infoWindow.open({
        map: (window as any).map,
        anchor,
        shouldFocus: false,
      });
    }
  };

  const loadStores = async (radius: number = 5, useZipCode?: boolean) => {
    if (!location && !useZipCode) {
      // If no location available, show default stores for demo purposes
      if (Platform.OS === 'web') {
        try {
          setLoading(true);
          const defaultStores = await findNearbyStores(40.7128, -74.0060, radius); // Default to NYC coordinates
          setStores(defaultStores);
          setSearchRadius(radius);
        } catch (error) {
          console.error('Error loading default stores:', error);
        } finally {
          setLoading(false);
        }
      }
      return;
    }
    
    try {
      setLoading(true);
      let nearbyStores: Store[] = [];

      if (useZipCode && zipCodeInput) {
        // Search by zip code
        nearbyStores = await findStoresByZipCode(zipCodeInput, radius);
      } else if (location) {
        // Search by coordinates
        nearbyStores = await findNearbyStores(location.latitude, location.longitude, radius);
      }

      if (nearbyStores.length === 0 && radius < maxRadius) {
        // Expand search radius if no stores found
        const nextRadius = Math.min(radius + 5, maxRadius);
        setSearchRadius(nextRadius);
        return loadStores(nextRadius, useZipCode);
      }
      
      setStores(nearbyStores);
      setSearchRadius(radius);
    } catch (error) {
      console.error('Error loading stores:', error);
      Alert.alert('Error', 'Failed to load stores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const searchStoresByName = async () => {
    if (!searchQuery.trim() || !location) return;

    try {
      setIsSearching(true);
      const results = await searchStores(
        searchQuery,
        location.latitude,
        location.longitude,
        searchRadius
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching stores:', error);
      Alert.alert('Error', 'Failed to search stores. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleZipCodeSearch = async () => {
    if (!zipCodeInput.trim()) {
      Alert.alert('Error', 'Please enter a valid zip code');
      return;
    }

    setShowZipCodeInput(false);
    await loadStores(5, true);
    
    // Also load map data for the zip code
    await loadNearbyStoresForMap(zipCodeInput, searchRadius);
  };

  const handleExpandRadius = async () => {
    const newRadius = Math.min(searchRadius + 5, maxRadius);
    setSearchRadius(newRadius);
    await loadStores(newRadius, !!zipCodeInput);
    
    // Also refresh map data with new radius
    if (location) {
      const address = `${location.city}, ${location.state} ${location.zipCode}`;
      await loadNearbyStoresForMap(address, newRadius);
    }
  };

  const refreshStores = async () => {
    if (zipCodeInput) {
      await loadStores(searchRadius, true);
    } else {
      await loadStores(searchRadius);
    }
    
    // Also refresh map data
    if (location) {
      const address = `${location.city}, ${location.state} ${location.zipCode}`;
      await loadNearbyStoresForMap(address, searchRadius);
    }
  };

  useEffect(() => {
    console.log('🗺️ [Stores] useEffect triggered:', {
      userAddress,
      userZipCode,
      location: location ? `${location.city}, ${location.state}` : null,
      platform: Platform.OS
    });

    // Prioritize user's manual address from Find tab, then GPS location
    const addressToUse = userAddress && userZipCode 
      ? `${userAddress} ${userZipCode}` 
      : location 
        ? `${location.city}, ${location.state} ${location.zipCode}` 
        : null;

    if (addressToUse) {
      console.log('🗺️ [Stores] Using address for map:', addressToUse);
      loadNearbyStoresForMap(addressToUse, searchRadius);
      loadStores();
    } else if (Platform.OS === 'web') {
      // On web, load default stores even without location
      console.log('🗺️ [Stores] No address available, loading default stores');
      loadStores();
    }
  }, [location, userAddress, userZipCode, searchRadius]);

  useEffect(() => {
    // Only auto-request location if no manual address is provided
    if (Platform.OS !== 'web' && !userAddress) {
      getCurrentLocation();
    }
  }, [userAddress]);

  const handleGetDirections = (store: Store) => {
    console.log('🗺️ [Stores] handleGetDirections called for store:', store.name);
    
    // Get user's location from context or GPS
    const userLocation = (userAddress && userZipCode) 
      ? `${userAddress} ${userZipCode}` 
      : (location ? `${location.city}, ${location.state} ${location.zipCode}` : '');
    
    console.log('🗺️ [Stores] Getting directions to:', store.name);
    console.log('🗺️ [Stores] User location for directions:', userLocation);
    console.log('🗺️ [Stores] Context values:', { userAddress, userZipCode });
    console.log('🗺️ [Stores] GPS location:', location);
    
    const directionsUrl = getStoreDirections(store, userLocation);
    console.log('🗺️ [Stores] Generated directions URL:', directionsUrl);
    
    Linking.openURL(directionsUrl).catch((error) => {
      console.error('🗺️ [Stores] Error opening directions:', error);
      Alert.alert('Error', 'Unable to open directions. Please try again.');
    });
  };

  const handleCallStore = (store: Store) => {
    if (store.phone) {
      const phoneNumber = `tel:${store.phone}`;
      Linking.openURL(phoneNumber).catch(() => {
        Alert.alert('Error', 'Unable to make call. Please try again.');
      });
    } else {
      Alert.alert('Info', 'Phone number not available for this store.');
    }
  };

  const handleVisitWebsite = (store: Store) => {
    if (store.website) {
      Linking.openURL(store.website).catch(() => {
        Alert.alert('Error', 'Unable to open website. Please try again.');
      });
    } else {
      Alert.alert('Info', 'Website not available for this store.');
    }
  };

  // COMMENTED OUT: Original store card rendering
  // const renderStoreCard = (store: Store) => (
  //   <View key={store.id} style={styles.storeCard}>
  //     <View style={styles.storeHeader}>
  //       <View style={styles.storeInfo}>
  //         <Text style={styles.storeName}>{store.name}</Text>
  //         <View style={styles.addressContainer}>
  //           <MapPin size={14} color={Colors.text.secondary} />
  //           <Text style={styles.storeAddress}>{store.address}</Text>
  //         </View>
  //         <View style={styles.distanceContainer}>
  //           <Navigation size={14} color={Colors.primary} />
  //           <Text style={styles.distance}>{store.distance} miles away</Text>
  //         </View>
  //         {store.zipCode && (
  //           <View style={styles.zipCodeContainer}>
  //             <Text style={styles.zipCodeText}>ZIP: {store.zipCode}</Text>
  //           </View>
  //         )}
  //       </View>
  //       
  //       <View style={styles.storeRating}>
  //         <View style={styles.ratingBadge}>
  //           <Star size={16} color={Colors.warning} />
  //           <Text style={styles.ratingText}>{store.rating}</Text>
  //         </View>
  //         <View style={styles.priceBadge}>
  //           <Award size={16} color={Colors.primary} />
  //           <Text style={styles.priceScoreText}>{store.priceScore}/10</Text>
  //         </View>
  //       </View>
  //     </View>
  //     
  //     <View style={styles.storeDetails}>
  //       <View style={styles.statusRow}>
  //         <View style={[styles.statusBadge, { 
  //           backgroundColor: store.isOpen ? Colors.success : Colors.error 
  //         }]}>
  //           <Clock size={12} color={Colors.background} />
  //           <Text style={styles.statusText}>
  //             {store.isOpen ? 'Open Now' : 'Closed'}
  //           </Text>
  //         </View>
  //         
  //         <View style={styles.dealsBadge}>
  //           <TrendingDown size={14} color={Colors.accent} />
  //           <Text style={styles.dealsText}>12 deals active</Text>
  //         </View>
  //       </View>
  //       
  //       {store.services && store.services.length > 0 && (
  //         <View style={styles.servicesContainer}>
  //           <Text style={styles.servicesTitle}>Services:</Text>
  //           <View style={styles.servicesList}>
  //             {store.services.slice(0, 3).map((service, index) => (
  //               <View key={index} style={styles.serviceBadge}>
  //                 <Text style={styles.serviceText}>{service}</Text>
  //               </View>
  //             ))}
  //           </View>
  //         </View>
  //       )}
  //       
  //       <Text style={styles.storeDescription}>
  //         Popular for fresh produce and competitive prices. 
  //         Pricewise users save an average of $8.50 per trip here.
  //       </Text>
  //       
  //       <View style={styles.storeActions}>
  //         <TouchableOpacity
  //           style={styles.actionButton}
  //           onPress={() => handleGetDirections(store)}
  //         >
  //           <Navigation size={16} color={Colors.background} />
  //           <Text style={styles.actionButtonText}>Directions</Text>
  //         </TouchableOpacity>
  //         
  //         <TouchableOpacity
  //           style={styles.secondaryActionButton}
  //           onPress={() => handleCallStore(store)}
  //         >
  //           <Phone size={16} color={Colors.primary} />
  //           <Text style={styles.secondaryActionText}>Call</Text>
  //         </TouchableOpacity>
  //         
  //         <TouchableOpacity 
  //           style={styles.secondaryActionButton}
  //           onPress={() => handleVisitWebsite(store)}
  //         >
  //           <Globe size={16} color={Colors.primary} />
  //           <Text style={styles.secondaryActionText}>Website</Text>
  //         </TouchableOpacity>
  //       </View>
  //     </View>
  //   </View>
  // );

  // New function to render the Google Maps with JavaScript API
  const renderGoogleMap = () => {
    // Check if we have any valid address (manual or GPS)
    const hasValidAddress = (userAddress && userZipCode) || location || zipCodeInput;
    if (!hasValidAddress) return null;
    
    return (
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <>
            {/* Google Maps JavaScript API Container */}
            <div 
              id="map" 
              style={{ 
                width: '100%', 
                height: '400px',
                borderRadius: '8px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd'
              }}
            />
            {/* Map Legend */}
            {nearbyStores.length > 0 && (
              <View style={styles.mapLegend}>
                <View style={styles.mapLegendHeader}>
                  <Text style={styles.mapLegendTitle}>Store Locations</Text>
                  <TouchableOpacity
                    style={styles.viewInMapsButton}
                    onPress={() => {
                      // Create a Google Maps URL with all stores using user's address
                      const addressToUse = userAddress && userZipCode 
                        ? `${userAddress} ${userZipCode}` 
                        : location 
                          ? `${location.city}, ${location.state}` 
                          : zipCodeInput;
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`grocery stores near ${addressToUse}`)}`;
                      console.log('🗺️ [Stores] Opening Google Maps with URL:', mapsUrl);
                      Linking.openURL(mapsUrl);
                    }}
                  >
                    <Text style={styles.viewInMapsButtonText}>View in Google Maps</Text>
                  </TouchableOpacity>
          </View>
                <View style={styles.mapLegendItems}>
                  {nearbyStores.slice(0, 6).map((store, index) => (
                    <View key={index} style={styles.mapLegendItem}>
                      <View style={styles.mapLegendMarker}>
                        <Text style={styles.mapLegendLabel}>
                          {String.fromCharCode(65 + index)}
                        </Text>
          </View>
                      <Text style={styles.mapLegendText} numberOfLines={1}>
                        {store.name}
            </Text>
                </View>
              ))}
                  {nearbyStores.length > 6 && (
                    <Text style={styles.mapLegendMore}>
                      +{nearbyStores.length - 6} more stores
                    </Text>
                  )}
            </View>
          </View>
        )}
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Map size={48} color={Colors.text.light} />
            <Text style={styles.mapPlaceholderText}>Interactive Map</Text>
            <Text style={styles.mapPlaceholderSubtext}>
              Tap to open in Maps app
        </Text>
          <TouchableOpacity
              style={styles.openMapsButton}
              onPress={() => {
                // Create a search URL that includes all nearby stores
                const addressToUse = userAddress && userZipCode 
                  ? `${userAddress} ${userZipCode}` 
                  : location 
                    ? `${location.city}, ${location.state}` 
                    : zipCodeInput;
                const searchQuery = `grocery stores near ${addressToUse}`;
                const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
                Linking.openURL(mapsUrl);
              }}
            >
              <Text style={styles.openMapsButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
        )}
    </View>
  );
  };

  // New function to render nearby stores list
  const renderNearbyStoresList = () => {
    if (nearbyStores.length === 0) return null;
    
    return (
      <View style={styles.nearbyStoresSection}>
        <Text style={styles.nearbyStoresTitle}>
          Nearby Grocery Stores ({nearbyStores.length})
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.storesList}
        >
          {nearbyStores.map((store, index) => (
        <TouchableOpacity
              key={index}
              style={[
                styles.storeItem,
                selectedStore?.name === store.name && styles.selectedStoreItem
              ]}
              onPress={() => setSelectedStore(store)}
            >
              <View style={styles.storeItemHeader}>
                <Text style={styles.storeItemName}>{store.name}</Text>
                {store.priceLevel && (
                  <View style={styles.priceLevelBadge}>
                    <Text style={styles.priceLevelText}>
                      {store.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$' :
                       store.priceLevel === 'PRICE_LEVEL_MODERATE' ? '$$' : '$'}
                    </Text>
                  </View>
                )}
      </View>
              <Text style={styles.storeItemAddress}>{store.address}</Text>
        <TouchableOpacity
                style={styles.directionsButton}
                onPress={() => handleGetDirections(store)}
              >
                <Navigation size={14} color={Colors.primary} />
                <Text style={styles.directionsButtonText}>Directions</Text>
        </TouchableOpacity>
        </TouchableOpacity>
          ))}
        </ScrollView>
    </View>
  );
  };

  // COMMENTED OUT: Search section (removed as requested)
  // const renderSearchSection = () => (
  //   <View style={styles.searchSection}>
  //     <View style={styles.searchContainer}>
  //       <Search size={20} color={Colors.text.secondary} />
  //       <TextInput
  //         style={styles.searchInput}
  //         placeholder="Search stores by name..."
  //         value={searchQuery}
  //         onChangeText={setSearchQuery}
  //         onSubmitEditing={searchStoresByName}
  //       />
  //       <TouchableOpacity
  //         style={styles.searchButton}
  //         onPress={searchStoresByName}
  //         disabled={isSearching}
  //       >
  //         {isSearching ? (
  //           <ActivityIndicator size="small" color={Colors.background} />
  //         ) : (
  //           <Text style={styles.searchButtonText}>Search</Text>
  //         )}
  //       </TouchableOpacity>
  //     </View>
  //     
  //     <View style={styles.locationOptions}>
  //       <TouchableOpacity
  //         style={styles.locationOption}
  //         onPress={() => setShowZipCodeInput(!showZipCodeInput)}
  //       >
  //         <MapPin size={16} color={Colors.primary} />
  //         <Text style={styles.locationOptionText}>
  //           {zipCodeInput ? `Search by ZIP: ${zipCodeInput}` : 'Search by ZIP Code'}
  //         </Text>
  //       </TouchableOpacity>
  //       
  //       <TouchableOpacity
  //         style={styles.locationOption}
  //         onPress={refreshStores}
  //         disabled={loading}
  //       >
  //         <RefreshCw size={16} color={Colors.primary} />
  //         <Text style={styles.locationOptionText}>Refresh</Text>
  //       </TouchableOpacity>
  //     </View>
  //     
  //     {showZipCodeInput && (
  //       <View style={styles.zipCodeInputContainer}>
  //         <TextInput
  //           style={styles.zipCodeInput}
  //           placeholder="Enter ZIP code..."
  //           value={zipCodeInput}
  //           onChangeText={setZipCodeInput}
  //           keyboardType="numeric"
  //           maxLength={5}
  //         />
  //         <TouchableOpacity
  //           style={styles.zipCodeButton}
  //           onPress={handleZipCodeSearch}
  //         >
  //           <Text style={styles.zipCodeButtonText}>Search</Text>
  //         </TouchableOpacity>
  //       </View>
  //     )}
  //   </View>
  // );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Stores</Text>
        <Text style={styles.subtitle}>
          Find the best grocery stores in your area
        </Text>
        
        {/* Debug Info */}
        {/* {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              Debug: userAddress={userAddress || 'none'}, userZipCode={userZipCode || 'none'}
            </Text>
            <Text style={styles.debugText}>
              Context: {userAddress ? '✅ From Find Tab' : '❌ Not Set'} | Stores: {nearbyStores.length}
            </Text>
          </View>
        )} */}
        
        {/* Context Test */}
        {/* <ContextTest /> */}
        
        {/* Manual Test Button */}
        {/* {__DEV__ && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              console.log('🧪 [Stores] Manual test - setting location');
              setUserLocation('Test Address, Test City', '12345');
            }}
          >
            <Text style={styles.testButtonText}>Test Set Location</Text>
          </TouchableOpacity>
        )} */}
        
        {/* Test Directions Button */}
        {/* {__DEV__ && (
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: Colors.warning }]}
            onPress={() => {
              console.log('🧪 [Stores] Testing directions with current location');
              const testStore: Store = {
                id: 'test',
                name: 'Test Store',
                address: '1234 Test Store Address, Test City, TX 12345',
                distance: 1.5,
                latitude: 33.0198,
                longitude: -96.6989,
                priceScore: 8.5,
                rating: 4.2,
                isOpen: true,
                zipCode: '12345',
                phone: '(555) 123-4567',
                website: 'https://teststore.com',
                hours: {
                  monday: '6:00 AM - 10:00 PM',
                  tuesday: '6:00 AM - 10:00 PM',
                  wednesday: '6:00 AM - 10:00 PM',
                  thursday: '6:00 AM - 10:00 PM',
                  friday: '6:00 AM - 10:00 PM',
                  saturday: '6:00 AM - 10:00 PM',
                  sunday: '6:00 AM - 10:00 PM'
                }
              };
              handleGetDirections(testStore);
            }}
          >
            <Text style={styles.testButtonText}>Test Directions</Text>
          </TouchableOpacity>
        )} */}
        {/* Show user's manual address if available, otherwise GPS location */}
        {(userAddress && userZipCode) && (
          <View style={styles.locationInfo}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.locationText}>
              📍 {userAddress} {userZipCode} • Searching within {searchRadius} miles
            </Text>
          </View>
        )}
        {!userAddress && location && (
          <View style={styles.locationInfo}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.locationText}>
              {location.city}, {location.state} {location.zipCode} • Searching within {searchRadius} miles
            </Text>
          </View>
        )}
        {zipCodeInput && (
          <View style={styles.zipCodeInfo}>
            <MapPin size={16} color={Colors.accent} />
            <Text style={styles.zipCodeInfoText}>
              Searching ZIP: {zipCodeInput} • Radius: {searchRadius} miles
            </Text>
          </View>
        )}
      </View>

      {/* COMMENTED OUT: Search section removed as requested */}
      {/* {renderSearchSection()} */}

      <ScrollView style={styles.content}>
        {/* Map Loading State */}
        {mapLoading && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              Loading nearby stores...
            </Text>
          </View>
        )}

        {/* Location Required State */}
        {!loading && !location && !userAddress && Platform.OS === 'web' && !locationError && (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color={Colors.text.light} />
            <Text style={styles.emptyTitle}>Location Required</Text>
            <Text style={styles.emptyText}>
              To find stores near you, please go to the Find tab and enter your address, 
              or allow location access in your browser.
            </Text>
            <TouchableOpacity
              style={styles.expandButton}
              onPress={getCurrentLocation}
            >
              <Text style={styles.expandButtonText}>
                Enable Location Access
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Location Access Denied State */}
        {!loading && !location && !userAddress && Platform.OS === 'web' && locationError && (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color={Colors.text.light} />
            <Text style={styles.emptyTitle}>Location Access Denied</Text>
            <Text style={styles.emptyText}>
              {locationError}. Please go to the Find tab and enter your address manually, 
              or enable location access in your browser settings.
            </Text>
            <TouchableOpacity
              style={styles.expandButton}
              onPress={getCurrentLocation}
            >
              <Text style={styles.expandButtonText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No Stores Found State */}
        {!mapLoading && nearbyStores.length === 0 && (location || userAddress || zipCodeInput) && (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color={Colors.text.light} />
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptyText}>
              No grocery stores found within {searchRadius} miles. 
              Please check your location or try again.
            </Text>
            {/* COMMENTED OUT: Expand radius functionality */}
            {/* {searchRadius < maxRadius && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={handleExpandRadius}
              >
                <Text style={styles.expandButtonText}>
                  Search {Math.min(searchRadius + 5, maxRadius)} miles
                </Text>
              </TouchableOpacity>
            )} */}
          </View>
        )}

        {/* Google Maps Display */}
        {!mapLoading && nearbyStores.length > 0 && renderGoogleMap()}

        {/* Nearby Stores List */}
        {!mapLoading && nearbyStores.length > 0 && renderNearbyStoresList()}

        {/* Selected Store Details */}
        {selectedStore && (
          <View style={styles.selectedStoreSection}>
            <Text style={styles.selectedStoreTitle}>Selected Store</Text>
            <View style={styles.selectedStoreCard}>
              <Text style={styles.selectedStoreName}>{selectedStore.name}</Text>
              <Text style={styles.selectedStoreAddress}>{selectedStore.address}</Text>
              <TouchableOpacity
                style={styles.selectedStoreDirections}
                onPress={() => handleGetDirections(selectedStore)}
              >
                <Navigation size={16} color={Colors.background} />
                <Text style={styles.selectedStoreDirectionsText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* COMMENTED OUT: Footer with expand radius functionality */}
        {/* {nearbyStores.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Showing {nearbyStores.length} stores within {searchRadius} miles
            </Text>
            {searchRadius < maxRadius && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={handleExpandRadius}
              >
                <Text style={styles.expandButtonText}>
                  Search wider area ({Math.min(searchRadius + 5, maxRadius)} miles)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )} */}
      </ScrollView>
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
    marginBottom: Spacing.md,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  zipCodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  zipCodeInfoText: {
    fontSize: 14,
    color: Colors.accent,
    marginLeft: Spacing.xs,
  },
  searchSection: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    marginLeft: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  searchButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  locationOptionText: {
    marginLeft: Spacing.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  zipCodeInputContainer: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  zipCodeInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    fontSize: 16,
    color: Colors.text.primary,
  },
  zipCodeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
  },
  zipCodeButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  loadingSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  searchResultsSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  storesSection: {
    paddingHorizontal: Spacing.lg,
  },
  storeCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  distance: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  zipCodeContainer: {
    marginTop: Spacing.xs,
  },
  zipCodeText: {
    fontSize: 12,
    color: Colors.text.light,
  },
  storeRating: {
    alignItems: 'flex-end',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: 4,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  priceScoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 4,
  },
  storeDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    color: Colors.background,
    marginLeft: 4,
    fontWeight: '500',
  },
  dealsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dealsText: {
    fontSize: 12,
    color: Colors.accent,
    marginLeft: 4,
    fontWeight: '500',
  },
  servicesContainer: {
    marginBottom: Spacing.md,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  serviceText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  storeDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  storeActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.background,
    marginLeft: 4,
  },
  secondaryActionButton: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 4,
  },
  expandButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  expandButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  footerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  
  // New styles for map-based layout
  mapContainer: {
    margin: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapPlaceholder: {
    height: 400,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  openMapsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  openMapsButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  nearbyStoresSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  nearbyStoresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  storesList: {
    flexDirection: 'row',
  },
  storeItem: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.md,
    width: 200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedStoreItem: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  storeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  storeItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  priceLevelBadge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priceLevelText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  storeItemAddress: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  directionsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  selectedStoreSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  selectedStoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  selectedStoreCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedStoreName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  selectedStoreAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  selectedStoreDirections: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  selectedStoreDirectionsText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Map legend styles
  mapLegend: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mapLegendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  mapLegendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  viewInMapsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  viewInMapsButtonText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapLegendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    minWidth: '45%',
  },
  mapLegendMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  mapLegendLabel: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapLegendText: {
    fontSize: 12,
    color: Colors.text.secondary,
    flex: 1,
  },
  mapLegendMore: {
    fontSize: 12,
    color: Colors.text.light,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  
  // Debug styles
  debugInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  debugText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  testButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  testButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});