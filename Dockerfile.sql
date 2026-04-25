FROM python:3.11-slim

WORKDIR /db

RUN mkdir -p /data

CMD ["python", "-c", "import sqlite3, time; conn=sqlite3.connect('/data/game.db'); conn.execute('CREATE TABLE IF NOT EXISTS game_results (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, duration_seconds INTEGER NOT NULL, wood INTEGER NOT NULL, stone INTEGER NOT NULL, ore INTEGER NOT NULL, gold INTEGER NOT NULL, troops INTEGER NOT NULL, kills INTEGER NOT NULL, clicks INTEGER NOT NULL, hrc TEXT NOT NULL, wave INTEGER NOT NULL)'); conn.commit(); conn.close(); time.sleep(31536000)"]
