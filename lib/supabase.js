import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://orfgzhhqhriqdijruwfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZmd6aGhxaHJpcWRpanJ1d2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNzcxMDIsImV4cCI6MjEwNDY1MzEwMn0.kHOBzFuPT-wQKUDEiZcehelTgP9AeoT1mxVwBUb98sk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);