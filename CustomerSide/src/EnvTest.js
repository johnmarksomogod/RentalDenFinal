import React from "react";

export default function EnvTest() {
  console.log("SUPABASE URL:", process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("SUPABASE KEY:", process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <div>
      
    </div>
  );
}
