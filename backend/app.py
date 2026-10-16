import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from routes.otp import otp_bp          # with the other imports
        # with the other register_blueprint lines

from config import Config
from models import db
from routes.auth import auth_bp
from routes.complaints import complaints_bp
from routes.officers import officers_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://127.0.0.1:5500",
                "http://localhost:5500"
            ]
        }
    }
)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(complaints_bp)
    app.register_blueprint(officers_bp)
    app.register_blueprint(otp_bp) 

    # Healthcheck endpoint
    @app.route('/api/health', methods=['GET'])
    def healthcheck():
        return jsonify({
            'status': 'healthy',
            'service': 'Smart Citizen Complaint Management Backend',
            'version': '1.0.0'
        }), 200

    # Static file serving for uploaded photos
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # Global error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Resource not found'}), 404

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({'error': 'Internal server error'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
