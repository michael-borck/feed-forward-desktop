"""Minimal OpenAI-compatible mock endpoint for smoke tests (stdlib only).

Serves exactly what feedforward-practice needs:
  GET  /v1/models            -> {"data": [{"id": ...}]}
  POST /v1/chat/completions  -> one assistant message containing a valid
                                practice-feedback JSON payload

Usage: python3 mock_openai.py [port]
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8488

FEEDBACK = {
    "overall_feedback": "A solid draft with a clear thesis; deepen the evidence analysis.",
    "categories": [
        {
            "name": "Argument",
            "score": 82,
            "feedback": "Your thesis is clearly stated and sustained.",
            "strengths": ["Clear thesis", "Consistent focus"],
            "improvements": ["Anticipate one counter-argument"],
        },
        {
            "name": "Evidence",
            "score": 74,
            "feedback": "Sources are relevant but mostly summarised, not analysed.",
            "strengths": ["Credible sources"],
            "improvements": ["Analyse quotes", "Connect evidence to the thesis"],
        },
    ],
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/v1/models":
            self._send({"data": [{"id": "mock-model"}, {"id": "mock-model-large"}]})
        else:
            self._send({"error": {"message": "not found"}}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/v1/chat/completions":
            self._send(
                {
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": json.dumps(FEEDBACK),
                            }
                        }
                    ],
                    "model": payload.get("model", "mock-model"),
                }
            )
        else:
            self._send({"error": {"message": "not found"}}, 404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"[mock-openai] listening on http://127.0.0.1:{PORT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
