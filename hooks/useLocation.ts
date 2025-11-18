import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Location as LocationType } from '@/types';


export function useLocation() {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = async () => {
    console.log('🔍 [DEBUG] getCurrentLocation called');
    
    // Prevent multiple simultaneous requests
    if (loading) {
      console.log('🔍 [DEBUG] Location request already in progress, returning early');
      return null;
    }

    try {
      console.log('🔍 [DEBUG] Starting location request...');
      setLoading(true);
      setError(null);

      // For web, check if we're in a secure context
      if (Platform.OS === 'web') {
        if (!window.isSecureContext) {
          const errorMessage = 'Location requires a secure context (HTTPS)';
          setError(errorMessage);
          console.warn('Location error (web):', errorMessage);
          return null;
        }
      }

      // Check if location services are available
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        const errorMessage = 'Location services are disabled';
        setError(errorMessage);
        if (Platform.OS === 'web') {
          console.warn('Location error (web):', errorMessage);
          return null;
        }
        throw new Error(errorMessage);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const errorMessage = Platform.OS === 'web' 
          ? 'Location permission denied. Please allow location access in your browser settings.'
          : 'Location permission denied';
        setError(errorMessage);
        if (Platform.OS === 'web') {
          console.warn('Location error (web):', errorMessage);
          return null;
        }
        throw new Error(errorMessage);
      }

      console.log('🔍 [DEBUG] Requesting current position...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000, // 10 second timeout
        maximumAge: 60000, // Accept cached location up to 1 minute old
      });
      
      console.log('🔍 [DEBUG] Position received:', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      });

      // Get detailed address information using Expo's reverse geocoding
      let locationDetails = null;
      try {
        const address = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        
        if (address.length > 0) {
          locationDetails = {
            results: [{
              address_components: [
                { long_name: address[0].postalCode, short_name: address[0].postalCode, types: ['postal_code'] },
                { long_name: address[0].city, short_name: address[0].city, types: ['locality'] },
                { long_name: address[0].region, short_name: address[0].region, types: ['administrative_area_level_1'] },
                { long_name: address[0].country, short_name: address[0].country, types: ['country'] }
              ],
              formatted_address: `${address[0].street}, ${address[0].city}, ${address[0].region} ${address[0].postalCode}`
            }]
          };
        }
      } catch (geocodeError) {
        console.warn('Failed to get address details from Expo:', geocodeError);
      }

      // Extract location data
      const locationData: LocationType = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        zipCode: extractZipCode(locationDetails),
        city: extractCity(locationDetails),
        state: extractState(locationDetails),
        country: extractCountry(locationDetails),
        address: extractAddress(locationDetails),
      };

      console.log('🔍 [DEBUG] Location data extracted:', {
        coordinates: `${locationData.latitude}, ${locationData.longitude}`,
        zipCode: locationData.zipCode,
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        address: locationData.address
      });

      setLocation(locationData);
      return locationData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      
      // For web, don't throw the error to prevent app crashes
      if (Platform.OS === 'web') {
        console.warn('Location error (web):', errorMessage);
        return null;
      }
      
      // For mobile, still throw but wrap in a try-catch in the calling code
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to extract location data
  const extractZipCode = (locationDetails: any): string | undefined => {
    if (!locationDetails?.results?.[0]?.address_components) return undefined;
    
    const postalCode = locationDetails.results[0].address_components.find(
      (component: any) => component.types.includes('postal_code')
    );
    return postalCode?.long_name;
  };

  const extractCity = (locationDetails: any): string | undefined => {
    if (!locationDetails?.results?.[0]?.address_components) return undefined;
    
    const city = locationDetails.results[0].address_components.find(
      (component: any) => component.types.includes('locality')
    );
    return city?.long_name;
  };

  const extractState = (locationDetails: any): string | undefined => {
    if (!locationDetails?.results?.[0]?.address_components) return undefined;
    
    const state = locationDetails.results[0].address_components.find(
      (component: any) => component.types.includes('administrative_area_level_1')
    );
    return state?.long_name;
  };

  const extractCountry = (locationDetails: any): string | undefined => {
    if (!locationDetails?.results?.[0]?.address_components) return undefined;
    
    const country = locationDetails.results[0].address_components.find(
      (component: any) => component.types.includes('country')
    );
    return country?.long_name;
  };

  const extractAddress = (locationDetails: any): string | undefined => {
    return locationDetails?.results?.[0]?.formatted_address;
  };

  // Auto-request location on mount for both web and mobile
  useEffect(() => {
    const initLocation = async () => {
      try {
        console.log('🔍 [DEBUG] Auto-requesting location on mount...');
        await getCurrentLocation();
      } catch (error) {
        console.warn('🔍 [DEBUG] Failed to get initial location:', error);
        
        // For web, provide a fallback location if location fails
        if (Platform.OS === 'web') {
          console.log('🔍 [DEBUG] Setting fallback location for web...');
          const fallbackLocation = {
            latitude: 40.7128,
            longitude: -74.0060,
            zipCode: '10001',
            city: 'New York',
            state: 'New York',
            country: 'United States',
            address: 'New York, NY 10001, USA'
          };
          setLocation(fallbackLocation);
        }
      }
    };
    
    initLocation();
  }, []);

  return {
    location,
    loading,
    error,
    getCurrentLocation,
  };
}