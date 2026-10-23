# 개발용 서버: 고친 파일이 새로 고침만으로 바로 보이도록 브라우저 캐시를 끔
# 사용: python tools/serve.py 8123  (프로젝트 폴더를 그대로 내보냄 — python -m http.server 와 같음)
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
