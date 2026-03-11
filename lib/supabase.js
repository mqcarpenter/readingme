import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// If we have actual keys, use them. Otherwise, provide a fully mocked client for testing.
const isMock = !supabaseUrl || !supabaseAnonKey;

if (isMock) {
  console.warn('Supabase keys missing. Injecting Mock Supabase Client for local testing.');
}

// Mock Database State
let mockBooks = [
  { id: 1, title: 'Project Hail Mary', author: 'Andy Weir', status: 'queue', user_rating: 5, average_rating: 4.5, created_at: new Date().toISOString() },
  { id: 2, title: 'Dune', author: 'Frank Herbert', status: 'reading', user_rating: 4, average_rating: 4.2, created_at: new Date().toISOString() },
  { id: 3, title: 'The Martian', author: 'Andy Weir', status: 'done', user_rating: 3, average_rating: 3.8, created_at: new Date().toISOString() }
];

export const supabase = isMock ? {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'mock-user-123', email: 'test@example.com' } } } }),
    onAuthStateChange: (callback) => {
      // Immediately trigger logged in state
      setTimeout(() => callback('SIGNED_IN', { user: { id: 'mock-user-123' } }), 100);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithOtp: async () => ({ error: null }),
    signOut: async () => ({ error: null })
  },
  from: (table) => {
    if (table === 'books') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [...mockBooks], error: null })
          })
        }),
        update: (updates) => ({
          eq: (field, val) => ({
            eq: async () => {
              mockBooks = mockBooks.map(b => b.id === val ? { ...b, ...updates } : b);
              return { error: null };
            }
          })
        }),
        insert: (newBook) => {
           mockBooks.push({ id: Math.random(), ...newBook, created_at: new Date().toISOString() });
           return { error: null };
        }
      }
    }
    return {};
  }
} : createClient(supabaseUrl, supabaseAnonKey);
