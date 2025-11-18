import React from 'react';
import { View, Text } from 'react-native';
import { useUserLocation } from '@/contexts/UserLocationContext';

export const ContextTest = () => {
  const { userAddress, userZipCode } = useUserLocation();
  
  return (
    <View style={{ padding: 10, backgroundColor: 'yellow' }}>
      <Text>Context Test:</Text>
      <Text>Address: {userAddress || 'none'}</Text>
      <Text>Zip: {userZipCode || 'none'}</Text>
    </View>
  );
};
