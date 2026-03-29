from __future__ import annotations

from flask import Flask

import db
from config import MAX_CONTENT_LENGTH, SECRET_KEY
from routes.api_routes import api_bp
from routes.main_routes import main_bp
from dotenv import load_dotenv
load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    db.init_db()
    app.teardown_appcontext(db.close_db)

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
