import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor() {
    const SUPABASE_URL = 'https://iqkltypxuzmchvxuzlcd.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxa2x0eXB4dXptY2h2eHV6bGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4MjU0NDgsImV4cCI6MjA1MjQwMTQ0OH0.zU_qIn1lYzYDrNwL8jpuTIkRPwY6zd15dIYOYJcmKg0';
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,  // 🚀 Wyłącza automatyczne zarządzanie sesją
        autoRefreshToken: false // 🚀 Wyłącza automatyczne odświeżanie tokenów
      }
  });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}