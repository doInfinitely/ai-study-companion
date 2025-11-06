import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (client-side, uses anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth state management
let currentUser = null;
let authToken = null;

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Get auth token for API calls
export function getAuthToken() {
  return authToken;
}

// Initialize auth (call this on app load)
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    currentUser = session.user;
    authToken = session.access_token;
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = session.user;
      authToken = session.access_token;
      
      // Reload app on login
      if (event === 'SIGNED_IN') {
        window.location.reload();
      }
    } else {
      currentUser = null;
      authToken = null;
      
      // Reload app on logout
      if (event === 'SIGNED_OUT') {
        window.location.reload();
      }
    }
  });

  return currentUser;
}

// Sign up with email and password
export async function signUp(email, password, fullName = '') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) throw error;
  return data;
}

// Sign in with email and password
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

// Sign in with OAuth (Google, GitHub, etc.)
export async function signInWithProvider(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) throw error;
  return data;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Reset password
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) throw error;
  return data;
}

// Update password
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return data;
}

