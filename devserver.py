"""Dev server for newvu.

Plain `python -m http.server` sends no cache headers, so browsers keep running
old copies of the ES modules until a cache-bypassing reload. This one answers
every request with `Cache-Control: no-store`, so a normal reload always picks
up the current files.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = '127.0.0.1', 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    print(f'newvu → http://{HOST}:{PORT}/  (no-store; plain reload is enough)')
    ThreadingHTTPServer((HOST, PORT), NoCacheHandler).serve_forever()
