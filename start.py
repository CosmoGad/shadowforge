"""Start the local app. Windows may otherwise serve .mjs as text/plain."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import functools
import mimetypes
import webbrowser

mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('text/javascript', '.js')
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8765)
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
handler = functools.partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent / 'dist'))
server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
url = f'http://127.0.0.1:{args.port}'
print(f'ShadowForge: {url}', flush=True)
if not args.no_browser:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
