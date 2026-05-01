import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [courierId, setCourierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: courier } = await supabase
          .from('couriers')
          .select('id, is_approved')
          .eq('id', session.user.id)
          .single();
        if (courier?.is_approved) setCourierId(courier.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') setCourierId(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <>
      <StatusBar style="light" backgroundColor="#0a1628" />
      {courierId
        ? <HomeScreen courierId={courierId} onLogout={() => setCourierId(null)} />
        : <LoginScreen onLogin={(id) => setCourierId(id)} />
      }
    </>
  );
}
