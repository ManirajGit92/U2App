import sys
import os
from http.server import HTTPServer

# Add the api directory to path so imports work
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from compare import handler as CompareHandler
from video import handler as VideoHandler

class LocalProxyHandler(CompareHandler, VideoHandler):
    # This acts as a simple router for testing the Vercel serverless functions locally
    def do_POST(self):
        if self.path == '/api/compare':
            CompareHandler.do_POST(self)
        elif self.path == '/api/video':
            VideoHandler.do_POST(self)
        else:
            self.send_response(404)
            self.end_headers()
            
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

def run(server_class=HTTPServer, handler_class=LocalProxyHandler, port=5000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Starting local python backend server on port {port}...')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print('Server stopped.')

if __name__ == '__main__':
    run()
