import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import useAuthStore from '../store/authStore';

import PhoneScreen      from '../screens/auth/PhoneScreen';
import OTPScreen        from '../screens/auth/OTPScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import HomeScreen       from '../screens/home/HomeScreen';
import SplatRoomScreen  from '../screens/room/SplatRoomScreen';
import SwipeScreen      from '../screens/swipe/SwipeScreen';
import FeedScreen       from '../screens/feed/FeedScreen';
import ChatListScreen   from '../screens/chat/ChatListScreen';
import ChatScreen       from '../screens/chat/ChatScreen';
import ProfileScreen    from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const ChatsplatTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card:       C.surface,
    border:     C.border,
    primary:    C.purple,
    text:       '#fff',
  },
};

const TAB_ICONS = {
  Splat:    ['radio',         'radio-outline'],
  Match:    ['heart',         'heart-outline'],
  Feed:     ['newspaper',     'newspaper-outline'],
  Chat:     ['chatbubbles',   'chatbubbles-outline'],
  Me:       ['person',        'person-outline'],
};

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   C.purple,
        tabBarInactiveTintColor: C.sub,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor:  C.border,
          borderTopWidth:  1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const [active, inactive] = TAB_ICONS[route.name] || ['radio','radio-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Splat"  component={HomeScreen} />
      <Tab.Screen name="Match"  component={SwipeScreen} />
      <Tab.Screen name="Feed"   component={FeedScreen} />
      <Tab.Screen name="Chat"   component={ChatListScreen} />
      <Tab.Screen name="Me"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone"      component={PhoneScreen} />
      <Stack.Screen name="OTP"        component={OTPScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main"        component={HomeTabs} />
      <Stack.Screen name="SplatRoom"   component={SplatRoomScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="ChatRoom"    component={ChatScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={C.purple} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={ChatsplatTheme}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
