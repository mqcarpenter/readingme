-- Phase 1: Supabase Database Setup & RLS

-- 1. Create the `books` table
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goodreads_id TEXT UNIQUE,
    title TEXT NOT NULL,
    author TEXT,
    isbn13 TEXT,
    status TEXT DEFAULT 'queue', -- 'queue', 'reading', 'done'
    user_rating INTEGER,
    average_rating NUMERIC,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Users can only SELECT their own books
CREATE POLICY "Users can view their own books"
ON public.books FOR SELECT
USING (auth.uid() = user_id);

-- Users can INSERT their own books
CREATE POLICY "Users can insert their own books"
ON public.books FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own books
CREATE POLICY "Users can update their own books"
ON public.books FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can DELETE their own books
CREATE POLICY "Users can delete their own books"
ON public.books FOR DELETE
USING (auth.uid() = user_id);

-- 4. Enable the Service Role Key to bypass RLS for the Python sync engine
-- The Service Role Key inherently bypasses RLS, so no explicit policy is needed for the backend script.

-- 5. (Optional but Recommended) Create an index for faster querying by user
CREATE INDEX books_user_id_idx ON public.books(user_id);
