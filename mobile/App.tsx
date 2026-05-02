import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import { supabase } from './src/lib/supabase';
import PermissionsScreen from './src/screens/PermissionsScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OrdersScreen from './src/screens/OrdersScreen';

type Screen = 'splash' | 'permissions' | 'login' | 'register' | 'pending' | 'home' | 'profile' | 'orders';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [courierId, setCourierId] = useState<string | null>(null);
  const [camPermission] = useCameraPermissions();

  useEffect(() => {
    initApp();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCourierId(null);
        setScreen('login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const initApp = async () => {
    // Check permissions first
    const locPerm = await Location.getForegroundPermissionsAsync();

    if (!locPerm.granted || !camPermission?.granted) {
      setScreen('permissions');
      return;
    }

    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await checkCourierStatus(session.user.id);
    } else {
      setScreen('login');
    }
  };

  const checkCourierStatus = async (userId: string) => {
    const { data: courier } = await supabase
      .from('couriers')
      .select('id, is_approved')
      .eq('id', userId)
      .single();

    if (courier?.is_approved) {
      setCourierId(courier.id);
      setScreen('home');
    } else if (courier && !courier.is_approved) {
      setScreen('pending');
    } else {
      setScreen('login');
    }
  };

  const handlePermissionsGranted = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await checkCourierStatus(session.user.id);
    } else {
      setScreen('login');
    }
  };

  const handleLogin = async (id: string) => {
    setCourierId(id);
    setScreen('home');
  };

  if (screen === 'splash') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1628', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0a1628" />
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (screen === 'permissions') {
    return <PermissionsScreen onGranted={handlePermissionsGranted} />;
  }

  if (screen === 'register') {
    return (
      <RegisterScreen
        onBack={() => setScreen('login')}
        onRegistered={() => setScreen('pending')}
      />
    );
  }

  if (screen === 'pending') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={() => setScreen('register')}
        pendingApproval
      />
    );
  }

  if (screen === 'home' && courierId) {
    return (
      <HomeScreen
        courierId={courierId}
        onLogout={() => { setCourierId(null); setScreen('login'); }}
        onProfile={() => setScreen('profile')}
        onOrders={() => setScreen('orders')}
      />
    );
  }

  if (screen === 'profile' && courierId) {
    return (
      <ProfileScreen
        courierId={courierId}
        onBack={() => setScreen('home')}
        onLogout={() => { setCourierId(null); setScreen('login'); }}
      />
    );
  }

  if (screen === 'orders' && courierId) {
    return (
      <OrdersScreen
        courierId={courierId}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
      onRegister={() => setScreen('register')}
    />
  );
}
