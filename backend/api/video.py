import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON body"}).encode())
            return

        content = data.get("content", "")
        
        # Here we'd get settings like:
        # voice_deep = data.get("voiceDeep", 50)
        # voice_stability = data.get("voiceStability", 50)
        # slide_speed = data.get("slideSpeed", "normal")
        # animation_type = data.get("animationType", "fade")

        if not content:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Content is required to generate a video"}).encode())
            return

        # SIMULATE VIDEO GENERATION
        # In a real environment, this is where edge-tts and moviepy would process
        # the article into an MP4 and return a download link (or byte stream).
        # We'll return a sample MP4 link to prove the UI can parse and handle it.

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": "success",
            "videoUrl": "https://www.w3schools.com/html/mov_bbb.mp4", # Standard test video
            "message": "Video generated successfully! (Simulated for Vercel Serverless environment)"
        }).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
