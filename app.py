from __future__ import annotations

import os
import sys
import socket
import threading
import webbrowser

from flask import Flask
from dotenv import load_dotenv

import db
from config import MAX_CONTENT_LENGTH, SECRET_KEY
from routes.api_routes import api_bp
from routes.main_routes import main_bp

load_dotenv()


# =========================
# PyInstaller対応
# =========================
def resource_path(relative_path: str) -> str:
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, relative_path)


# =========================
# ポート使用チェック
# =========================
def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


# =========================
# ブラウザ起動
# =========================
def open_browser() -> None:
    webbrowser.open("http://127.0.0.1:5000", new=1)


# =========================
# Flask生成
# =========================
def create_app() -> Flask:
    template_dir = resource_path("templates")
    static_dir = resource_path("static")

    app = Flask(
        __name__,
        template_folder=template_dir,
        static_folder=static_dir,
    )

    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    db.init_db()
    app.teardown_appcontext(db.close_db)

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    return app


app = create_app()


# =========================
# 起動処理
# =========================
if __name__ == "__main__":
    PORT = 5000

    if is_port_in_use(PORT):
        print("Already running → open browser only")
        open_browser()
    else:
        print("Starting IGAMAGI...")
        threading.Timer(1.0, open_browser).start()
        app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)