import http.server, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
server = http.server.HTTPServer(("0.0.0.0", 8080), http.server.SimpleHTTPRequestHandler)
server.serve_forever()
