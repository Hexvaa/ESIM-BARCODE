import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rhccjevdowkzpaudotqm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoY2NqZXZkb3drenBhdWRvdHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MjE1NjksImV4cCI6MjEwMzA5NzU2OX0.LrIs6OTfqV4vZLhcuyfF78ZLSxH2PqV0fa_mnjkUh84'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Profile = {
  id: string
  email: string
  role: 'admin' | 'member'
  is_premium: boolean
  created_at: string
}

export type EsimCode = {
  id: string
  lpa: string
  label: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  profiles?: Profile
}
