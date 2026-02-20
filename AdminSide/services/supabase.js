import 'react-native-url-polyfill/auto'; // MUST be first
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://oxqmrdqeczcwgjfplzjv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cW1yZHFlY3pjd2dqZnBsemp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDQwODUsImV4cCI6MjA3MDQ4MDA4NX0.KdUmdVzh6MdnYpxIr2lQBZCbqWi3BBLv1lfAarEQlAA';

// Minimal CORS configuration that preserves your original setup
const supabaseOptions = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Only add custom fetch for web to handle CORS better
  ...(Platform.OS === 'web' && {
    global: {
      fetch: async (url, options = {}) => {
        return fetch(url, {
          ...options,
          mode: 'cors',
          credentials: 'omit',
        });
      }
    }
  })
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('vehicles').select('*').limit(1);
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const debugConnectivity = async () => {
  const results = { };
  try {
    const res = await fetch('https://www.gstatic.com/generate_204', { method: 'GET' });
    results.internet = res.ok;
  } catch (e) {
    results.internet = false;
    results.internetError = String(e?.message || e);
  }

  try {
    const health = await fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' });
    results.supabaseHealth = health.ok;
    results.supabaseStatus = health.status;
  } catch (e) {
    results.supabaseHealth = false;
    results.supabaseError = String(e?.message || e);
  }

  try {
    const { error } = await supabase.auth.getSession();
    results.authSession = !error;
    if (error) results.authSessionError = String(error?.message || error);
  } catch (e) {
    results.authSession = false;
    results.authSessionError = String(e?.message || e);
  }

  console.log('[ConnectivityDebug]', results);
  return results;
};