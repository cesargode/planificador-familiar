#!/usr/bin/env python3
"""Servidor estático para la PWA con cabeceras anti-caché.

Uso:  python3 serve.py            (puerto 8081, en 0.0.0.0)
"""
import http.server
import os
import socketserver

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
PORT = 8081
NO_CACHE = (".html", ".js", ".css", ".webmanifest", ".json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?")[0].split("#")[0]
        if path in ("/", "") or path.endswith(NO_CACHE):
            # siempre revalidar: así la app se actualiza sola en todos los móviles
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"sirviendo {ROOT} en http://0.0.0.0:{PORT}")
        httpd.serve_forever()
