import { Tabs } from 'expo-router';
import { ShoppingCart, Search, List, MapPin, User } from 'lucide-react-native';
import { Colors } from '@/constants';
import { UserLocationProvider } from '@/contexts/UserLocationContext';

export default function TabLayout() {
  return (
    <UserLocationProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.text.secondary,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            paddingBottom: 5,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
      {/* Hidden: Deals page - Code preserved but hidden from navigation */}
      <Tabs.Screen
        name="index"
        options={{
          href: null, // This hides the tab from navigation
          title: 'Deals',
          tabBarIcon: ({ size, color }) => (
            <ShoppingCart size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="search"
        options={{
          title: 'Find',
          tabBarIcon: ({ size, color }) => (
            <Search size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden: My Lists page - Code preserved but hidden from navigation */}
      <Tabs.Screen
        name="lists"
        options={{
          href: null, // This hides the tab from navigation
          title: 'My Lists',
          tabBarIcon: ({ size, color }) => (
            <List size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="stores"
        options={{
          title: 'Stores',
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden: Me page - Code preserved but hidden from navigation */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // This hides the tab from navigation
          title: 'Me',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </UserLocationProvider>
  );
}