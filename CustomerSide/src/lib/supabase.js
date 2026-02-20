import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://oxqmrdqeczcwgjfplzjv.supabase.co"
const supabaseAnonKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cW1yZHFlY3pjd2dqZnBsemp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDQwODUsImV4cCI6MjA3MDQ4MDA4NX0.KdUmdVzh6MdnYpxIr2lQBZCbqWi3BBLv1lfAarEQlAA"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export { supabase }
export default supabase
