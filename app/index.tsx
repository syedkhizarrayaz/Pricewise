import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  withSequence,
  withDelay
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '@/constants';

export default function SplashScreen() {
  const router = useRouter();
  const [showTagline, setShowTagline] = useState(false);
  
  const logoScale = useSharedValue(0);
  const logoRotation = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: logoScale.value },
        { rotateZ: `${logoRotation.value}deg` }
      ],
    };
  });

  const taglineAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: taglineOpacity.value,
    };
  });

  useEffect(() => {
    // Animate logo entrance
    logoScale.value = withSequence(
      withTiming(1.2, { duration: 600 }),
      withTiming(1, { duration: 200 })
    );
    
    logoRotation.value = withTiming(360, { duration: 1000 });

    // Show tagline after logo animation
    setTimeout(() => {
      setShowTagline(true);
      taglineOpacity.value = withTiming(1, { duration: 800 });
    }, 800);

    // Navigate to onboarding after animations
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 3000);
  }, []);

  return (
    <LinearGradient
      colors={Colors.gradients.primary}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>P</Text>
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>$</Text>
            </View>
          </View>
        </Animated.View>
        
        <Text style={styles.appName}>Pricewise</Text>
        
        {showTagline && (
          <Animated.Text style={[styles.tagline, taglineAnimatedStyle]}>
            Shop Smart, Save More
          </Animated.Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
  priceTag: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  priceTagText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    marginBottom: Spacing.md,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});