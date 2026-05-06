/**
 * BJCC Mobile App — Root Navigator
 * Bottom tabs (Home, Search, Assistant, Profile) + Stack screens (CaseDetail, Login, Signup)
 * Uses FloatingTabBar custom component with BlurView.
 */
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

// Context
import { LanguageProvider } from './src/context/LanguageContext';

// API — load saved server URL before anything else renders
import { initBaseUrl } from './src/api/client';

// Screens
import LandingScreen      from './src/screens/LandingScreen';
import SearchScreen       from './src/screens/SearchScreen';
import AIAssistantScreen  from './src/screens/AIAssistantScreen';
import ProfileScreen      from './src/screens/ProfileScreen';
import CaseDetailsScreen  from './src/screens/CaseDetailsScreen';
import LoginScreen        from './src/screens/LoginScreen';
import SignupScreen        from './src/screens/SignupScreen';
import ServerConfigScreen from './src/screens/ServerConfigScreen';

// Components
import FloatingTabBar from './src/components/FloatingTabBar';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Smooth fade + slide-up transition for auth screens.
 * Makes navigating between Login ↔ Signup feel fluid, not laggy.
 */
const authTransition = {
  cardStyleInterpolator: ({ current }) => ({
    cardStyle: {
      opacity: current.progress,
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          }),
        },
      ],
    },
  }),
  transitionSpec: {
    open:  { animation: 'timing', config: { duration: 300 } },
    close: { animation: 'timing', config: { duration: 240 } },
  },
};

/** Bottom tab navigator — 3 tabs: Home, Search, Profile */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab"    component={LandingScreen}  options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="SearchTab"  component={SearchScreen}   options={{ tabBarLabel: 'Search' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

/** Root stack */
function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#E8EFFC' },
      }}
    >
      <Stack.Screen name="Main"         component={MainTabs} />
      <Stack.Screen name="CaseDetail"   component={CaseDetailsScreen} />
      <Stack.Screen name="Login"        component={LoginScreen}        options={authTransition} />
      <Stack.Screen name="Signup"       component={SignupScreen}       options={authTransition} />
      <Stack.Screen name="ServerConfig" component={ServerConfigScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initBaseUrl().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0520', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
