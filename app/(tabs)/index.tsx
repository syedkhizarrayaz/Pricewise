import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to search page since we're hiding the Deals page
    router.replace('/(tabs)/search');
  }, []);

  return null; // This component just redirects
}