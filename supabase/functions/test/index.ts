// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(async req => {
  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
      {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!,
        }
      }
    }
  );

  console.log(supabase)

  const { data: thread, error } = await supabase.from("test").select("*");
  if (error) {
    console.log(error);
  }

  const data = {
    message: `Hello ${thread}!`,
  };

  return new Response(
    JSON.stringify({
      data,
      thread,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/test' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
