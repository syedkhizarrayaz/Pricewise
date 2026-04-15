import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Phone, Globe, Star, Loader2, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';

interface Store {
  id: string;
  name: string;
  address: string;
  rating: number;
  distance: string;
  isOpen: boolean;
  phone?: string;
  website?: string;
  location?: google.maps.LatLngLiteral;
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

export function Stores({ 
  sharedLocation, 
  sharedCoords 
}: { 
  sharedLocation: string; 
  sharedCoords?: { lat: number; lng: number };
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  useEffect(() => {
    if (isLoaded && sharedCoords) {
      fetchNearbyStores(sharedCoords);
    }
  }, [isLoaded, sharedCoords]);

  const fetchNearbyStores = (location: google.maps.LatLngLiteral) => {
    setLoading(true);
    setError(null);
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    
    const request: google.maps.places.TextSearchRequest = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: 8046, // 5 miles in meters
      query: 'grocery stores'
    };

    service.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        // Sort by distance if possible, or just take top results
        // Google TextSearch results are generally ranked by relevance/distance
        const storesWithDetails = results.slice(0, 10).map(place => {
          return new Promise<Store>((resolve) => {
            service.getDetails({ 
              placeId: place.place_id!,
              fields: ['name', 'formatted_address', 'vicinity', 'rating', 'opening_hours', 'formatted_phone_number', 'website', 'geometry', 'utc_offset_minutes']
            }, (details, detailStatus) => {
              
              // Accurate open/closed logic
              let isOpen = false;
              if (details?.opening_hours) {
                isOpen = details.opening_hours.isOpen();
              }

              // Calculate distance string
              let distanceStr = 'Nearby';
              if (place.geometry?.location && location) {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                  new google.maps.LatLng(location.lat, location.lng),
                  place.geometry.location
                );
                const miles = dist * 0.000621371;
                distanceStr = `${miles.toFixed(1)} miles`;
              }

              resolve({
                id: place.place_id || Math.random().toString(),
                name: place.name || 'Unknown Store',
                address: place.vicinity || place.formatted_address || 'No address available',
                rating: place.rating || 0,
                distance: distanceStr,
                isOpen: isOpen,
                phone: details?.formatted_phone_number,
                website: details?.website,
                location: place.geometry?.location?.toJSON()
              });
            });
          });
        });

        Promise.all(storesWithDetails).then(formattedStores => {
          // Sort by distance (miles)
          const sorted = formattedStores.sort((a, b) => {
            const distA = parseFloat(a.distance);
            const distB = parseFloat(b.distance);
            return distA - distB;
          });
          setStores(sorted);
          setLoading(false);
        });
      } else {
        setError('No stores found in this area.');
        setStores([]);
        setLoading(false);
      }
    });
  };

  const getDirections = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="pt-safe-top p-6 pb-24 max-w-md mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Nearby Stores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {sharedLocation ? `Showing stores near ${sharedLocation}` : 'Discover local grocery options.'}
        </p>
      </header>

      <div className="space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
            </div>
            <p className="text-sm font-black uppercase tracking-[0.2em] mt-6">Finding stores...</p>
          </div>
        )}

        {error && !loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-[2rem] text-sm font-bold flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-destructive/20 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5" />
            </div>
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {!loading && stores.map((store, idx) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="modern-card overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h3 className="font-black text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">{store.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px] font-black">
                        <Star className="w-3 h-3 fill-current" />
                        {store.rating}
                      </div>
                      <span className="text-muted-foreground/30 text-xs">•</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{store.distance}</span>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] shadow-sm",
                    store.isOpen 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}>
                    {store.isOpen ? 'Open Now' : 'Closed'}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center shrink-0 shadow-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <span className="truncate font-bold text-xs">{store.address}</span>
                </div>
              </div>

              <div className="flex border-t border-border/50 bg-muted/10 p-2 gap-2">
                <button 
                  onClick={() => getDirections(store.address)}
                  className="flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-background hover:shadow-md transition-all active:scale-95"
                >
                  <Navigation className="w-4 h-4 text-primary" strokeWidth={2.5} />
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Route</span>
                </button>
                <button 
                  onClick={() => store.phone && (window.location.href = `tel:${store.phone}`)}
                  disabled={!store.phone}
                  className="flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-background hover:shadow-md transition-all active:scale-95 disabled:opacity-20"
                >
                  <Phone className="w-4 h-4 text-primary" strokeWidth={2.5} />
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Call</span>
                </button>
                <button 
                  onClick={() => store.website && window.open(store.website, '_blank')}
                  disabled={!store.website}
                  className="flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-background hover:shadow-md transition-all active:scale-95 disabled:opacity-20"
                >
                  <Globe className="w-4 h-4 text-primary" strokeWidth={2.5} />
                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Web</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && stores.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-24 h-24 rounded-[2.5rem] bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No stores nearby</p>
          </div>
        )}
      </div>
    </div>
  );
}
