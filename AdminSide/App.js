// App.js - CarOwners & OwnerProfile removed (merged into UserManagementScreen)
import React, { useState, useEffect } from 'react';
import { NavigationContainer, CommonActions, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { firebaseAuth, debugConnectivity, getCurrentAppUser, ensureOwnerAppUser, setAuthCache } from './services/firebaseService';
import { AuthProvider } from './services/AuthContext';

// Admin screens
import BookingsScreen from './screens/BookingsScreen';
import VehiclesScreen from './screens/VehiclesScreen';
import AddVehicleScreen from './screens/AddVehicleScreen';
import ReportsScreen from './screens/ReportsScreen';
import CalendarScreen from './screens/CalendarScreen';
import CashFlowScreen from './screens/CashFlowScreen';
import DashboardScreen from './screens/DashboardScreen';
import LoginScreen from './screens/LoginScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import DriverBalanceScreen from './screens/DriverBalanceScreen';
import SystemSettingsScreen from './screens/SystemSettingsScreen';
import DriverDashboardScreen from './screens/Driverdashboardscreen';

// Owner Portal screens — lowercase filenames as per your project
import OwnerPortalDashboardScreen from './screens/Ownerportaldashboardscreen';
import OwnerPortalBookingsScreen from './screens/Ownerportalbookingsscreen';
import OwnerPortalVehiclesScreen from './screens/Ownerportalvehiclesscreen';
import OwnerPortalSettingsScreen from './screens/Ownerportalsettingsscreen';

export const navigationRef = createNavigationContainerRef();

const Tab  = createBottomTabNavigator();
const Stack = createStackNavigator();

const linking = {
  prefixes: ["adminside://"],
  config: { screens: { ResetPassword: "reset-password" } },
};

// ─── Admin / Owner Stacks ─────────────────────────────────────────────────────

function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', animationEnabled: false, cardStyle: { backgroundColor: 'transparent' }, presentation: 'transparentModal' }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} options={{ title: 'Bookings Management' }} />
    </Stack.Navigator>
  );
}

function VehiclesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', animationEnabled: false, cardStyle: { backgroundColor: 'transparent' }, presentation: 'transparentModal' }}>
      <Stack.Screen name="VehiclesList" component={VehiclesScreen} options={{ title: 'Vehicle Management' }} />
      <Stack.Screen name="AddVehicle"   component={AddVehicleScreen} options={{ title: 'Add New Vehicle' }} />
    </Stack.Navigator>
  );
}

function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', animationEnabled: false, cardStyle: { backgroundColor: 'transparent' }, presentation: 'transparentModal' }}>
      <Stack.Screen name="ReportsList" component={ReportsScreen} options={{ title: 'Performance Reports' }} />
      <Stack.Screen name="CashFlow"    component={CashFlowScreen} options={{ title: 'Cash Flow Management' }} />
    </Stack.Navigator>
  );
}

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', animationEnabled: false, cardStyle: { backgroundColor: 'transparent' }, presentation: 'transparentModal' }}>
      <Stack.Screen name="DashboardView" component={DashboardScreen} options={{ title: 'Dashboard Overview' }} />
    </Stack.Navigator>
  );
}

function CalendarStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff', animationEnabled: false, cardStyle: { backgroundColor: 'transparent' }, presentation: 'transparentModal' }}>
      <Stack.Screen name="CalendarView" component={CalendarScreen} options={{ title: 'Rental Calendar' }} />
    </Stack.Navigator>
  );
}

// UserManagement: includes CarOwners inline + AddVehicle for owner profile's button
function UserManagementStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'User Management' }} />
      <Stack.Screen name="SystemSettings" component={SystemSettingsScreen} options={{ title: 'System Settings' }} />
      <Stack.Screen name="AddVehicle"     component={AddVehicleScreen}    options={{ title: 'Add New Vehicle' }} />
    </Stack.Navigator>
  );
}

// ─── Driver Stacks ────────────────────────────────────────────────────────────

function DriverDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverDashboardView" component={DriverDashboardScreen} />
    </Stack.Navigator>
  );
}

function DriverBalanceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}>
      <Stack.Screen
        name="DriverBalance"
        component={DriverBalanceScreen}
        options={{
          title: 'My Balance',
          headerRight: () => (
            <TouchableOpacity
              onPress={async () => { try { await firebaseAuth.signOut(); } catch (e) { console.error(e); } }}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack.Navigator>
  );
}

// ─── Owner Portal Stacks (car_owner role — separate 4-tab portal) ─────────────

function OwnerPortalDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerPortalDashboardView" component={OwnerPortalDashboardScreen} />
    </Stack.Navigator>
  );
}

function OwnerPortalBookingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerPortalBookingsView" component={OwnerPortalBookingsScreen} />
    </Stack.Navigator>
  );
}

function OwnerPortalVehiclesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerPortalVehiclesView" component={OwnerPortalVehiclesScreen} />
    </Stack.Navigator>
  );
}

function OwnerPortalSettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerPortalSettingsView" component={OwnerPortalSettingsScreen} />
    </Stack.Navigator>
  );
}

// ─── Auth Navigator ───────────────────────────────────────────────────────────

function AuthNavigator() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#000" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Login"         component={LoginScreen}         options={{ headerShown: false }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
      </Stack.Navigator>
    </SafeAreaProvider>
  );
}

// ─── Owner Portal Navigator (car_owner role) ──────────────────────────────────
// Completely separate from the admin app — different screens, different tabs

function OwnerPortalNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#f9fafb" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor:   '#7c3aed',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#e5e7eb',
            paddingBottom: insets.bottom,
            paddingTop: 8,
            height: 60 + insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              OwnerDashboard: focused ? 'grid'     : 'grid-outline',
              OwnerBookings:  focused ? 'calendar' : 'calendar-outline',
              OwnerVehicles:  focused ? 'car'      : 'car-outline',
              OwnerSettings:  focused ? 'settings' : 'settings-outline',
            };
            return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="OwnerDashboard" component={OwnerPortalDashboardStack} options={{ title: 'Dashboard' }} />
        <Tab.Screen name="OwnerBookings"  component={OwnerPortalBookingsStack}  options={{ title: 'Bookings' }} />
        <Tab.Screen name="OwnerVehicles"  component={OwnerPortalVehiclesStack}  options={{ title: 'Vehicles' }} />
        <Tab.Screen name="OwnerSettings"  component={OwnerPortalSettingsStack}  options={{ title: 'Settings' }} />
      </Tab.Navigator>
    </SafeAreaProvider>
  );
}

// ─── Main Navigator (admin / owner role) ──────────────────────────────────────

function MainNavigator({ role }) {
  const insets   = useSafeAreaInsets();
  const isDriver = role === 'driver';
  const isOwner  = role === 'owner';

  console.log('[MainNavigator] role =', role, ' | isDriver =', isDriver);

  const tabIcon = ({ route, focused, color, size }) => {
    const icons = {
      Dashboard:      focused ? 'grid'      : 'grid-outline',
      DriverDashboard:focused ? 'car'       : 'car-outline',
      Bookings:       focused ? 'calendar'  : 'calendar-outline',
      Vehicles:       focused ? 'car'       : 'car-outline',
      Reports:        focused ? 'analytics' : 'analytics-outline',
      Calendar:       focused ? 'today'     : 'today-outline',
      // "Users" tab — people icon covers admins, owners, and drivers
      UserManagement: focused ? 'people'    : 'people-outline',
      DriverBalance:  focused ? 'wallet'    : 'wallet-outline',
    };
    return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
  };

  const commonTabOptions = {
    headerShown: false,
    tabBarActiveTintColor:   '#222',
    tabBarInactiveTintColor: '#666',
    tabBarStyle: {
      backgroundColor: '#fff',
      borderTopColor: '#eee',
      paddingBottom: insets.bottom,
      paddingTop: 8,
      height: 60 + insets.bottom,
      paddingHorizontal: 10,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    animationEnabled: false,
  };

  // ── DRIVER ─────────────────────────────────────────────────────────────────
  if (isDriver) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#222" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            ...commonTabOptions,
            tabBarIcon: ({ focused, color, size }) => tabIcon({ route, focused, color, size }),
          })}
        >
          <Tab.Screen name="DriverDashboard" component={DriverDashboardStack} options={{ title: 'Bookings' }} />
          <Tab.Screen name="DriverBalance"   component={DriverBalanceStack}   options={{ title: 'Balance' }} />
        </Tab.Navigator>
      </SafeAreaProvider>
    );
  }

  // ── ADMIN / SUPER OWNER ────────────────────────────────────────────────────
  // CarOwners tab is GONE — fully merged into UserManagement (Owners tab)
  const makeBlurListener = (screenName) => ({ navigation, route }) => ({
    blur: () => {
      try {
        const tabState  = navigation.getState();
        const tabRoute  = tabState.routes.find(r => r.name === route.name);
        const nestedKey = tabRoute?.state?.key;
        if (nestedKey) navigation.dispatch({ ...CommonActions.reset({ index: 0, routes: [{ name: screenName }] }), target: nestedKey });
      } catch (err) { console.warn(`${route.name} blur reset failed`, err); }
    },
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#222" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...commonTabOptions,
          tabBarIcon: ({ focused, color, size }) => tabIcon({ route, focused, color, size }),
        })}
      >
        <Tab.Screen name="Dashboard"  component={DashboardStack}  options={{ title: 'Dashboard', unmountOnBlur: true, listeners: makeBlurListener('DashboardView') }} />
        <Tab.Screen name="Bookings"   component={BookingsStack}   options={{ title: 'Bookings',  unmountOnBlur: true, listeners: makeBlurListener('BookingsList') }} />
        <Tab.Screen name="Vehicles"   component={VehiclesStack}   options={{ title: 'Vehicles',  unmountOnBlur: true, listeners: makeBlurListener('VehiclesList') }} />
        <Tab.Screen name="Reports"    component={ReportsStack}    options={{ title: 'Reports',   unmountOnBlur: true, listeners: makeBlurListener('ReportsList') }} />
        <Tab.Screen name="Calendar"   component={CalendarStack}   options={{ title: 'Calendar',  unmountOnBlur: true, listeners: makeBlurListener('CalendarView') }} />
        {isOwner && (
          <Tab.Screen
            name="UserManagement"
            component={UserManagementStack}
            options={{ title: 'Users' }}
          />
        )}
      </Tab.Navigator>
    </SafeAreaProvider>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user,    setUser]    = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    debugConnectivity().catch(() => {});
    let mounted = true;

    const init = async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null); setAppUser(null); setLoading(false); return;
      }
      try {
        const profile = await getCurrentAppUser();
        if (!mounted) return;

        console.log('[App] profile loaded:', JSON.stringify(profile));

        if (profile?.status === 'disabled') {
          await firebaseAuth.signOut();
          setUser(null); setAppUser(null); setLoading(false); return;
        }

        const role = profile?.role || 'owner';
        if (role === 'owner') await ensureOwnerAppUser();

        const effectiveOwnerId = profile?.owner_uid || firebaseUser.uid;
        setAuthCache(effectiveOwnerId, role);
        setAppUser(profile);
        setUser(firebaseUser);

        console.log('[App] role =', role, ' | effectiveOwnerId =', effectiveOwnerId);
      } catch (e) {
        console.error('[App] init error:', e);
        if (mounted) {
          setUser(firebaseUser);
          setAppUser({ role: 'owner', owner_uid: firebaseUser?.uid, status: 'active' });
          setAuthCache(firebaseUser?.uid, 'owner');
        }
      }
      if (mounted) setLoading(false);
    };

    const currentUser = firebaseAuth.getCurrentUser();
    if (currentUser) init(currentUser);
    else setLoading(false);

    const unsub = firebaseAuth.onAuthStateChange((firebaseUser) => {
      if (firebaseUser) init(firebaseUser);
      else { setUser(null); setAppUser(null); setLoading(false); }
    });

    return () => { mounted = false; unsub(); };
  }, []);

  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      if (url.includes("reset-password")) navigationRef.current?.navigate("ResetPassword");
    };
    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const role = appUser?.role || 'owner';
  console.log('[App] Rendering — user:', !!user, '| role:', role);

  // car_owner → separate Owner Portal (Ownerportaldashboardscreen etc.)
  // NOT the admin app
  const isCarOwner = role === 'car_owner';

  return (
    <SafeAreaProvider>
      <AuthProvider user={user} appUser={appUser} role={role}>
        <NavigationContainer ref={navigationRef} linking={linking}>
          {!user
            ? <AuthNavigator />
            : isCarOwner
              ? <OwnerPortalNavigator />
              : <MainNavigator role={role} />
          }
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}