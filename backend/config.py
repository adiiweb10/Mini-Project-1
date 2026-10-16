import os
from dotenv import load_dotenv

# Load .env file from backend directory if present
base_dir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(base_dir, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key-change-in-production')
    
    # PostgreSQL database URL
    # SQLAlchemy requires postgresql:// instead of postgres://
    db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/citizen_complaint_db')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = os.path.join(base_dir, os.environ.get('UPLOAD_FOLDER', 'uploads'))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    
    CORS_ORIGIN = os.environ.get(
    'CORS_ORIGIN',
    'http://127.0.0.1:5500'
)
