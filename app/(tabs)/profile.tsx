import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Bell, MapPin, CreditCard, CircleHelp as HelpCircle, Settings, Star, TrendingUp, Shield, LogOut } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);

  const renderSettingRow = (
    key: string,
    icon: React.ReactNode,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightElement?: React.ReactNode
  ) => (
    <TouchableOpacity key={key} style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement}
    </TouchableOpacity>
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.guestHeader}>
            <View style={styles.guestAvatar}>
              <User size={40} color={Colors.primary} />
            </View>
            <Text style={styles.guestTitle}>Welcome to Pricewise</Text>
            <Text style={styles.guestSubtitle}>
              Sign in to unlock personalized savings and track your deals
            </Text>
          </View>

          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.primaryAuthButton}
              onPress={() => router.push('/auth/signin')}
            >
              <Text style={styles.primaryAuthButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAuthButton}
              onPress={() => router.push('/auth/signup')}
            >
              <Text style={styles.secondaryAuthButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>Why Sign In?</Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <TrendingUp size={20} color={Colors.primary} />
                <Text style={styles.benefitText}>Track your personal savings</Text>
              </View>
              <View style={styles.benefitItem}>
                <Star size={20} color={Colors.accent} />
                <Text style={styles.benefitText}>Get personalized deals</Text>
              </View>
              <View style={styles.benefitItem}>
                <Shield size={20} color={Colors.success} />
                <Text style={styles.benefitText}>Secure your shopping lists</Text>
              </View>
            </View>
          </View>

          <View style={styles.guestFeatures}>
            <Text style={styles.guestFeaturesTitle}>Available Without Sign In</Text>
            <Text style={styles.guestFeaturesText}>
              • Compare prices across stores{'\n'}
              • Find nearby grocery stores{'\n'}
              • Search for product deals{'\n'}
              • Create temporary shopping lists
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <User size={40} color={Colors.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userSubtitle}>
                Member since {user.joinedAt.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Savings Summary */}
        <View style={styles.savingsCard}>
          <Text style={styles.savingsTitle}>Your Pricewise Savings</Text>
          <View style={styles.savingsStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${user.monthlySavings.toFixed(2)}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${user.totalSavings.toFixed(2)}</Text>
              <Text style={styles.statLabel}>All Time</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.averageSavingsPercent}%</Text>
              <Text style={styles.statLabel}>Avg. Savings</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatCard}>
            <TrendingUp size={24} color={Colors.primary} />
            <Text style={styles.quickStatValue}>{user.priceComparisons}</Text>
            <Text style={styles.quickStatLabel}>Price Comparisons</Text>
          </View>
          <View style={styles.quickStatCard}>
            <Star size={24} color={Colors.warning} />
            <Text style={styles.quickStatValue}>4.9</Text>
            <Text style={styles.quickStatLabel}>Your Rating</Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Account & Preferences</Text>
          {[
            renderSettingRow(
              'profile-settings',
              <User size={20} color={Colors.primary} />,
              'Profile Settings',
              'Update your personal information'
            ),
            renderSettingRow(
              'notifications',
              <Bell size={20} color={Colors.primary} />,
              'Notifications',
              'Manage your notification preferences',
              undefined,
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            ),
            renderSettingRow(
              'location-services',
              <MapPin size={20} color={Colors.primary} />,
              'Location Services',
              'Allow Pricewise to find nearby stores',
              undefined,
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            )
          ]}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Shopping & Lists</Text>
          {[
            renderSettingRow(
              'payment-methods',
              <CreditCard size={20} color={Colors.primary} />,
              'Payment Methods',
              'Manage your payment options'
            ),
            renderSettingRow(
              'store-preferences',
              <Star size={20} color={Colors.primary} />,
              'Store Preferences',
              'Set your favorite stores and brands'
            )
          ]}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Support & Information</Text>
          {[
            renderSettingRow(
              'help-support',
              <HelpCircle size={20} color={Colors.primary} />,
              'Help & Support',
              'Get help with using Pricewise'
            ),
            renderSettingRow(
              'app-settings',
              <Settings size={20} color={Colors.primary} />,
              'App Settings',
              'Manage app preferences and data'
            ),
            renderSettingRow(
              'privacy-security',
              <Shield size={20} color={Colors.primary} />,
              'Privacy & Security',
              'Manage your privacy settings'
            )
          ]}
        </View>

        {/* Pricewise Community */}
        <View style={styles.communitySection}>
          <Text style={styles.sectionTitle}>Join the Pricewise Community</Text>
          <View style={styles.communityCard}>
            <Text style={styles.communityTitle}>Help Other Shoppers Save!</Text>
            <Text style={styles.communityText}>
              Share price updates and help the Pricewise community find the best deals.
            </Text>
            <TouchableOpacity style={styles.communityButton}>
              <Text style={styles.communityButtonText}>Become a Contributor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          {[
            renderSettingRow(
              'sign-out',
              <LogOut size={20} color={Colors.error} />,
              'Sign Out',
              'Sign out of your Pricewise account',
              handleSignOut,
              undefined
            )
          ]}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Pricewise v1.0.0</Text>
          <Text style={styles.appTagline}>Shop Smart, Save More</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  savingsCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  savingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  savingsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.xs,
  },
  quickStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  settingsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  communitySection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  communityCard: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  communityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  communityText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  communityButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  communityButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.background,
  },
  signOutSection: {
    marginBottom: Spacing.lg,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  appVersion: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 12,
    color: Colors.text.light,
    fontStyle: 'italic',
  },
  guestHeader: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  guestSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  authButtons: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  primaryAuthButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  primaryAuthButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.background,
  },
  secondaryAuthButton: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryAuthButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  benefitsSection: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  benefitsList: {
    gap: Spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  guestFeatures: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  guestFeaturesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  guestFeaturesText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});