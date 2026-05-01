import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

let socket: Socket | null = null;
let watchSubscription: Location.LocationSubscription | null = null;
let courierId: string | null = null;

export async function startLocationTracking(cid: string) {
  courierId = cid;

  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Arka plan konum izni verilmedi');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Oturum bulunamadı');

  if (!socket) {
    socket = io(process.env.EXPO_PUBLIC_SOCKET_URL!, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
  }

  socket.on('connect', () => {
    socket?.emit('courier:register', { courierId: cid, token: session.access_token });
  });

  if (socket.connected) {
    socket.emit('courier:register', { courierId: cid, token: session.access_token });
  } else {
    socket.connect();
  }

  // Background location tracking
  watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,      // 5 seconds
      distanceInterval: 10,    // 10 meters
    },
    (location) => {
      const { latitude, longitude, heading, speed } = location.coords;
      socket?.emit('courier:location', {
        courierId: cid,
        lat: latitude,
        lng: longitude,
        heading: heading || 0,
        speed: speed || 0,
      });
    }
  );
}

export function stopLocationTracking() {
  watchSubscription?.remove();
  watchSubscription = null;
  socket?.disconnect();
  socket = null;
  courierId = null;
}

export function getSocket(): Socket | null {
  return socket;
}
