// assets/js/supabase.js
// Init client Supabase (pakai CDN ESM)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://gjdvjbnvdxleduxjsity.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ncuXboBUse0F2rSXFaiDzQ_0nKqnaFi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});
