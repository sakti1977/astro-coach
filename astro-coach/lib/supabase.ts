import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          user_id: string
          birth_data: Json | null
          chart: Json | null
          dashas: Json | null
          validation: Json | null
          goals: Json | null
          habits: Json | null
          chat_history: Json | null
          coaching: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          birth_data?: Json | null
          chart?: Json | null
          dashas?: Json | null
          validation?: Json | null
          goals?: Json | null
          habits?: Json | null
          chat_history?: Json | null
          coaching?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          birth_data?: Json | null
          chart?: Json | null
          dashas?: Json | null
          validation?: Json | null
          goals?: Json | null
          habits?: Json | null
          chat_history?: Json | null
          coaching?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      coaching_observations: {
        Row: {
          id: string
          user_id: string
          observation_id: string
          timestamp: string
          text: string
          category: string
          exchange_index: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          observation_id: string
          timestamp: string
          text: string
          category: string
          exchange_index: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          observation_id?: string
          timestamp?: string
          text?: string
          category?: string
          exchange_index?: number
          created_at?: string
        }
      }
    }
  }
}
