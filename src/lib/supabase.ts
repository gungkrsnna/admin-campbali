import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/** Browser client with the anon key — used only for sign-in and uploads to signed URLs. */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey)
