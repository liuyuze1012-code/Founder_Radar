import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server-only reader. Tables have no public read policies; pages read
// exclusively through server functions, which use this privileged client.
export function publicDb() {
  return supabaseAdmin;
}
