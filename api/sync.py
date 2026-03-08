import os
import json
import feedparser
from supabase import create_client, Client
from http.server import BaseHTTPRequestHandler

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") # Service role key to bypass RLS for system syncs

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # We need a user ID. For a robust app, we'd sync all users or accept via query params.
        # Since Vercel Cron hits this endpoint without auth, we might pass a generic API key or a specific user ID via Cron URL.
        # However, for simplicity per the provided plan, we assume `user_id` is passed as a query string or we fetch 'to-read' for a main account.
        
        # Parse query params
        from urllib.parse import urlparse, parse_qs
        parsed_path = urlparse(self.path)
        qs = parse_qs(parsed_path.query)
        
        user_id = qs.get('user_id', [None])[0]
        sys_user_id = qs.get('sys_uid', [None])[0] # Supabase auth.users ID to link records

        if not user_id or not sys_user_id:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing Goodreads user_id or system sys_uid parameter in querystring.'}).encode())
            return
            
        if not supabase:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Supabase credentials not configured'}).encode())
            return

        rss_url = f"https://www.goodreads.com/review/list_rss/{user_id}?shelf=to-read"
        
        try:
            # Parse RSS feed
            feed = feedparser.parse(rss_url)
            
            if feed.bozo:
                raise Exception("Failed to parse RSS feed")

            synced_count = 0
            
            for entry in feed.entries:
                # Extract book_id from the link or guid
                # Example guid: Book:12345
                guid = entry.get('id', '')
                goodreads_id = guid.split(':')[-1] if ':' in guid else guid
                
                title = entry.get('title', 'Unknown Title')
                author = entry.get('author_name', 'Unknown Author')
                isbn = entry.get('isbn', '')
                
                if not goodreads_id:
                    continue
                    
                # Google Books API metadata enrichment
                if not isbn:
                    try:
                        import urllib.request
                        import urllib.parse
                        query = urllib.parse.quote(f'intitle:{title} inauthor:{author}')
                        url = f"https://www.googleapis.com/books/v1/volumes?q={query}"
                        with urllib.request.urlopen(url) as res:
                            g_data = json.loads(res.read().decode())
                            if g_data.get('items'):
                                vol_info = g_data['items'][0].get('volumeInfo', {})
                                ids = vol_info.get('industryIdentifiers', [])
                                for identifier in ids:
                                    if identifier.get('type') == 'ISBN_13':
                                        isbn = identifier.get('identifier')
                                        break
                    except Exception as ge:
                        print(f"Google API error for {title}: {ge}")

                # Upsert into Supabase
                data = {
                    "goodreads_id": goodreads_id,
                    "title": title,
                    "author": author,
                    "isbn13": isbn if isbn else None,
                    "status": "queue",
                    "user_id": sys_user_id
                }
                
                # using upsert on the goodreads_id unique constraint
                # Note: On conflict, DO UPDATE to avoid duplicates
                response = supabase.table("books").upsert(data, on_conflict="goodreads_id").execute()
                synced_count += 1
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'synced_books': synced_count}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
