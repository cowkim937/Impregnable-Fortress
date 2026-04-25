from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import sqlite3
from urllib.parse import urlparse

DB_PATH = os.environ.get("GAME_DB_PATH", "/data/game.db")


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS game_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            duration_seconds INTEGER NOT NULL,
            wood INTEGER NOT NULL,
            stone INTEGER NOT NULL,
            ore INTEGER NOT NULL,
            gold INTEGER NOT NULL,
            troops INTEGER NOT NULL,
            kills INTEGER NOT NULL,
            clicks INTEGER NOT NULL,
            hrc TEXT NOT NULL,
            wave INTEGER NOT NULL
        )
        """
    )
    conn.commit()
    return conn


class Handler(SimpleHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/api/rankings":
            with connect() as conn:
                rows = conn.execute(
                    """
                    SELECT nickname, duration_seconds, kills, clicks, hrc, wave, finished_at
                    FROM game_results
                    ORDER BY wave DESC, kills DESC, clicks DESC, duration_seconds DESC
                    LIMIT 20
                    """
                ).fetchall()
            self._json(200, [dict(row) for row in rows])
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/finish":
            self._json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            nickname = str(data.get("nickname", "")).strip()[:18] or "anonymous"
            values = {
                "nickname": nickname,
                "started_at": str(data.get("started_at", "")),
                "duration_seconds": int(data.get("duration_seconds", 0)),
                "wood": int(data.get("wood", 0)),
                "stone": int(data.get("stone", 0)),
                "ore": int(data.get("ore", 0)),
                "gold": int(data.get("gold", 0)),
                "troops": int(data.get("troops", 0)),
                "kills": int(data.get("kills", 0)),
                "clicks": int(data.get("clicks", 0)),
                "hrc": str(data.get("hrc", "1"))[:16],
                "wave": int(data.get("wave", 1)),
            }
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self._json(400, {"error": f"invalid payload: {exc}"})
            return

        with connect() as conn:
            conn.execute(
                """
                INSERT INTO game_results (
                    nickname, started_at, duration_seconds, wood, stone, ore, gold,
                    troops, kills, clicks, hrc, wave
                ) VALUES (
                    :nickname, :started_at, :duration_seconds, :wood, :stone, :ore, :gold,
                    :troops, :kills, :clicks, :hrc, :wave
                )
                """,
                values,
            )
            conn.commit()
        self._json(201, {"ok": True})


if __name__ == "__main__":
    connect().close()
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
