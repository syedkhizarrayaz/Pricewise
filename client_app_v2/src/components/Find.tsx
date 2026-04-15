import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, ShoppingBag, Info, Sparkles, Navigation, List as ListIcon, Store as StoreIcon } from 'lucide-react';
import { compareUnifiedPrices } from '../services/pricingBackendService';
import { ComparisonResult, ShoppingList } from '../types';
import { cn } from '../lib/utils';
import { MAJOR_RETAILERS, STORE_LOGOS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

const extractZipFromAddress = (address: string): string => {
  const m = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return m ? m[0] : '';
};

const extractZipFromComponents = (
  components?: google.maps.GeocoderAddressComponent[]
): string => {
  if (!components) return '';
  const postal = components.find((c) => c.types.includes('postal_code'));
  return postal?.long_name || '';
};

const getStoreLogo = (name: string) => {
  if (!name) return null;
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Prioritize longer keys for better specificity (e.g., "whole foods market" over "whole foods")
  const sortedKeys = Object.keys(STORE_LOGOS).sort((a, b) => b.length - a.length);
  
  const key = sortedKeys.find(k => {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanName.includes(cleanKey) || cleanKey.includes(cleanName);
  });
  
  return key ? STORE_LOGOS[key] : null;
};

const StoreLogo = ({ name }: { name: string }) => {
  const [errorCount, setErrorCount] = useState(0);
  const logo = getStoreLogo(name);

  if (!logo || errorCount >= 2) {
    return (
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
        <StoreIcon className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  // Use Google Favicon as a fallback if Clearbit fails
  const displayLogo = errorCount === 1 
    ? `https://www.google.com/s2/favicons?domain=${logo.split('/').pop()}&sz=128`
    : logo;

  return (
    <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-border/20 flex items-center justify-center overflow-hidden p-1">
      <img 
        src={displayLogo} 
        alt={name} 
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
        onError={() => setErrorCount(prev => prev + 1)}
      />
    </div>
  );
};

const PriceTable = ({ data, title }: { data: ComparisonResult[], title: string }) => {
  if (data.length === 0) return null;
  
  const allProductNames = Array.from(new Set(data.flatMap(r => r.products.map(p => p.name))));
  const sortedData = [...data].sort((a, b) => a.totalPrice - b.totalPrice);

  const formatItemName = (name: string) => {
    // Try to split by common delimiters for quantity
    const delimiters = [' - ', ' (', ', ', ' : '];
    for (const delimiter of delimiters) {
      if (name.includes(delimiter)) {
        const [itemName, ...rest] = name.split(delimiter);
        let quantity = rest.join(delimiter);
        if (delimiter === ' (') quantity = '(' + quantity;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-tight">{itemName}</span>
            <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{quantity}</span>
          </div>
        );
      }
    }
    return <span className="font-bold text-foreground leading-tight">{name}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="font-black text-lg tracking-tight text-foreground/80">{title}</h2>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {data.length} Stores
        </span>
      </div>

      <div className="modern-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground sticky left-0 bg-card/80 backdrop-blur-md z-10 border-r border-border/30 w-[100px]">
                  Item
                </th>
                {sortedData.map((store, idx) => {
                  return (
                    <th key={store.storeId} className="p-3 text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <StoreLogo name={store.storeName} />
                        <span className="font-black text-[11px] tracking-tight text-foreground truncate max-w-[100px]">
                          {store.storeName}
                        </span>
                        {idx === 0 && (
                          <span className="text-[7px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            Best
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allProductNames.map((productName) => {
                const prices = data.map(s => s.products.find(p => p.name === productName)?.price).filter((p): p is number => p !== undefined);
                const minPrice = Math.min(...prices);

                return (
                  <tr key={productName} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                    <td className="p-3 text-[10px] sticky left-0 bg-card/80 backdrop-blur-md z-10 border-r border-border/30 group-hover:text-foreground transition-colors leading-tight">
                      {formatItemName(productName)}
                    </td>
                    {sortedData.map((store) => {
                      const product = store.products.find(p => p.name === productName);
                      const isCheapest = product?.price === minPrice;
                      
                      return (
                        <td key={store.storeId} className="p-3 text-center">
                          {product ? (
                            <div className={cn(
                              "inline-flex flex-col items-center px-2 py-1 rounded-lg transition-all",
                              isCheapest ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20" : "text-foreground/80"
                            )}>
                              <span className="text-[11px] font-black">
                                {store.currencySymbol || '$'}{product.price.toFixed(2)}
                              </span>
                              {isCheapest && (
                                <span className="text-[6px] font-black uppercase tracking-widest mt-0.5">Cheapest</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 text-[10px]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-black">
                <td className="p-3 text-[9px] uppercase tracking-widest text-foreground sticky left-0 bg-muted/80 backdrop-blur-md z-10 border-r border-border/30">
                  Total
                </td>
                {sortedData.map((store, idx) => (
                  <td key={store.storeId} className="p-3 text-center">
                    <div className={cn(
                      "inline-flex flex-col items-center",
                      idx === 0 ? "text-primary" : "text-foreground"
                    )}>
                      <span className="text-sm tracking-tighter">
                        <span className="text-[9px] font-bold mr-0.5">{store.currencySymbol || '$'}</span>
                        {store.totalPrice.toFixed(2)}
                      </span>
                      <span className="text-[7px] uppercase tracking-widest opacity-60">
                        {store.matchedItems}/{store.totalItems}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export function Find({ 
  sharedLocation, 
  setSharedLocation, 
  sharedCoords, 
  setSharedCoords 
}: { 
  sharedLocation: string; 
  setSharedLocation: (loc: string) => void;
  sharedCoords?: { lat: number; lng: number };
  setSharedCoords: (coords: { lat: number; lng: number } | undefined) => void;
}) {
  const { user } = useAuth();
  const [listText, setListText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing Prices...');
  const [results, setResults] = useState<ComparisonResult[] | null>(null);

  const categorizedResults = results ? {
    major: results.filter(r => {
      const cleanStoreName = r.storeName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return MAJOR_RETAILERS.some(m => {
        const cleanM = m.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanStoreName.includes(cleanM) || cleanM.includes(cleanStoreName);
      });
    }),
    others: results.filter(r => {
      const cleanStoreName = r.storeName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return !MAJOR_RETAILERS.some(m => {
        const cleanM = m.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanStoreName.includes(cleanM) || cleanM.includes(cleanStoreName);
      });
    })
  } : null;

  const loadingMessages = [
    'Finding nearest stores...',
    'Checking local prices...',
    'Comparing basket totals...',
    'Optimizing your savings...',
    'Always checking Walmart, Kroger, HEB...',
    'Including online options like Amazon...'
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      let i = 0;
      interval = setInterval(() => {
        setLoadingMessage(loadingMessages[i % loadingMessages.length]);
        i++;
      }, 2500);
    } else {
      setLoadingMessage('Analyzing Prices...');
    }
    return () => clearInterval(interval);
  }, [loading]);
  const [error, setError] = useState<string | null>(null);
  const [showLists, setShowLists] = useState(false);
  const [savedLists, setSavedLists] = useState<ShoppingList[]>([]);
  const [selectedZipCode, setSelectedZipCode] = useState('');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  const handleCompare = async () => {
    if (!listText.trim() || !sharedLocation.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    const items = listText.split('\n').filter(i => i.trim());
    
    try {
      const data = await compareUnifiedPrices({
        items,
        location: sharedLocation,
        zipCode: selectedZipCode || extractZipFromAddress(sharedLocation),
        coords: sharedCoords,
      });
      setResults(data);
    } catch (err: any) {
      console.error("Comparison Error:", err);
      setError(err.message || 'Failed to fetch prices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setSharedLocation(place.formatted_address);
        setSelectedZipCode(extractZipFromAddress(place.formatted_address));
      }
      const zipFromPlace = extractZipFromComponents(place.address_components);
      if (zipFromPlace) {
        setSelectedZipCode(zipFromPlace);
      }
      if (place.geometry?.location) {
        setSharedCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
      }
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const latLng = { lat: latitude, lng: longitude };
          setSharedCoords(latLng);
          
          if (isLoaded) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: latLng }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                setSharedLocation(results[0].formatted_address);
                setSelectedZipCode(
                  extractZipFromComponents(results[0].address_components) ||
                    extractZipFromAddress(results[0].formatted_address)
                );
              } else {
                setSharedLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                setSelectedZipCode('');
              }
            });
          } else {
            setSharedLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            setSelectedZipCode('');
          }
        },
        () => setError('Unable to retrieve your location.')
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  const fetchSavedLists = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, `users/${user.uid}/lists`));
      const querySnapshot = await getDocs(q);
      const lists: ShoppingList[] = [];
      querySnapshot.forEach((doc) => {
        lists.push({ id: doc.id, ...doc.data() } as ShoppingList);
      });
      setSavedLists(lists);
      setShowLists(true);
    } catch (err) {
      console.error("Error fetching lists:", err);
    }
  };

  const loadList = (list: ShoppingList) => {
    setListText(list.items.join('\n'));
    setShowLists(false);
  };

  return (
    <div className="pt-safe-top p-6 pb-24 max-w-md mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">AI Powered</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Find Best Prices</h1>
        <p className="text-muted-foreground text-sm mt-1">Smart comparison for your basket.</p>
      </header>

      <div className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="modern-card p-6 space-y-6 relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="relative space-y-5">
            <div>
              <div className="flex justify-between items-center mb-3 ml-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Shopping List
                </label>
                {user && (
                  <button 
                    onClick={fetchSavedLists}
                    className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                    Load Saved
                  </button>
                )}
              </div>
              <textarea
                value={listText}
                onChange={(e) => setListText(e.target.value)}
                placeholder="Milk&#10;Eggs&#10;Bread..."
                className="w-full h-40 p-5 modern-input resize-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3 ml-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Location
                </label>
                <button 
                  onClick={useCurrentLocation}
                  className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Current
                </button>
              </div>
              <div className="relative group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground z-10 group-focus-within:text-primary transition-colors" />
                {isLoaded ? (
                  <Autocomplete
                    onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                    onPlaceChanged={onPlaceChanged}
                  >
                    <input
                      type="text"
                      value={sharedLocation}
                      onChange={(e) => {
                        setSharedLocation(e.target.value);
                        setSelectedZipCode(extractZipFromAddress(e.target.value));
                      }}
                      placeholder="City, ZIP, or Address"
                      className="w-full pl-12 pr-5 py-4 modern-input"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    value={sharedLocation}
                    onChange={(e) => {
                      setSharedLocation(e.target.value);
                      setSelectedZipCode(extractZipFromAddress(e.target.value));
                    }}
                    placeholder="City, ZIP, or Address"
                    className="w-full pl-12 pr-5 py-4 modern-input"
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleCompare}
              disabled={loading || !listText.trim() || !sharedLocation.trim()}
              className="w-full py-5 gradient-primary text-primary-foreground rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-[0.97] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingMessage}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" strokeWidth={3} />
                  Compare Prices
                </>
              )}
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showLists && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-card w-full max-w-sm rounded-[2.5rem] border border-border shadow-2xl p-8"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-2xl tracking-tight">Saved Lists</h3>
                  <button onClick={() => setShowLists(false)} className="p-2 rounded-full hover:bg-muted transition-colors">✕</button>
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {savedLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => loadList(list)}
                      className="w-full text-left p-5 rounded-3xl hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all flex justify-between items-center group"
                    >
                      <div>
                        <span className="font-bold block text-foreground">{list.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{list.items.length} items</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    </button>
                  ))}
                  {savedLists.length === 0 && (
                    <div className="text-center py-8">
                      <ListIcon className="w-12 h-12 mx-auto mb-3 opacity-10" />
                      <p className="text-muted-foreground text-sm font-medium">No saved lists yet.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="p-5 bg-destructive/10 border border-destructive/20 text-destructive rounded-3xl text-sm font-bold flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-destructive/20 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              {error}
            </motion.div>
          )}

          {categorizedResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              <PriceTable data={categorizedResults.major} title="Major Retailers" />
              <PriceTable data={categorizedResults.others} title="Online and Local Stores" />

              <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-3xl border border-primary/10">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-wider">
                  Prices are estimated based on current market data and nearby store availability. 
                  Actual prices may vary at checkout.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
