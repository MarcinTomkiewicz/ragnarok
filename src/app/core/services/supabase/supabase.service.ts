import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor() {
    const SUPABASE_URL = 'https://iqkltypxuzmchvxuzlcd.supabase.co';
    const SUPABASE_ANON_KEY = '4ab21f904bfedfc893ce24838396121ab65d773b1a2a08df9bb0eeb2d5bf2304';
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}