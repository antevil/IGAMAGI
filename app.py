from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask

from routes.main_routes import main_bp
from routes.api_routes import api_bp

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-me")

    # routes（routing）
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)