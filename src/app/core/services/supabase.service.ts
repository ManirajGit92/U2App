import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.user());
  readonly isConfigured: boolean;

  constructor() {
    const url = environment.supabaseUrl;
    const key = environment.supabaseAnonKey;

    // Only initialize if real credentials are provided
    this.isConfigured = url.startsWith('http') && key.length > 20;

    if (this.isConfigured) {
      try {
        this.supabase = createClient(url, key);
        this.supabase.auth.getUser().then(({ data }) => {
          this.user.set(data.user);
        });
        this.supabase.auth.onAuthStateChange((_event, session) => {
          this.user.set(session?.user ?? null);
        });
      } catch (e) {
        console.warn('Supabase initialization failed:', e);
        this.isConfigured = false;
      }
    } else {
      console.info('Supabase not configured. Set credentials in environment.ts to enable auth.');
    }
  }

  get client(): SupabaseClient | null {
    return this.supabase;
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.supabase) {
      alert('Supabase is not configured. Please set your Supabase URL and anon key in src/environments/environment.ts');
      return;
    }
    await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async signOut(): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
    this.user.set(null);
  }

  isPremiumUser(): boolean {
    const u = this.user();
    if (!u) return false;
    return u.user_metadata?.['is_premium'] === true;
  }

  async getSession() {
    if (!this.supabase) return null;
    return this.supabase.auth.getSession();
  }
}
