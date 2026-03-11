import os
import sys
import json
from unittest.mock import MagicMock
from http.server import HTTPServer
import api.sync
from api.sync import handler

def run(server_class=HTTPServer, handler_class=handler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Starting local test server on port {port}...')
    print(f'Test URL: http://localhost:{port}/api/sync?user_id=YOUR_GOODREADS_ID&sys_uid=YOUR_SUPABASE_USER_ID')
    print('You can test this endpoint using curl or your browser.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        sys.exit(0)

if __name__ == "__main__":
    print('\n--- Local API Testing for api/sync.py ---')
    # Check for required env vars
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_KEY"):
        print("WARNING: SUPABASE_URL and/or SUPABASE_SERVICE_KEY not set.")
        print("Starting in MOCK mode. Supabase calls will be intercepted and logged instead of executed.")
        
        # Create a mock Supabase client
        mock_supabase = MagicMock()
        mock_supabase.table().upsert().execute.return_value = MagicMock(data=[{"mock": "success"}])
        
        # We need a custom side effect to log what's being upserted
        def mock_upsert(data, **kwargs):
            book_title = data.get('title', 'Unknown')
            print(f"[MOCK SUPABASE] Upserting book: '{book_title}' (Goodreads ID: {data.get('goodreads_id')})")
            mock_execute = MagicMock()
            mock_execute.execute.return_value = MagicMock(data=[data])
            return mock_execute
        
        mock_supabase.table().upsert.side_effect = mock_upsert
        
        # Inject the mock into the api.sync module
        api.sync.supabase = mock_supabase

    run()
