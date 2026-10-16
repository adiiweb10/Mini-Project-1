import os
import sys
from app import create_app
from models import db, Category, User, Complaint

DEFAULT_CATEGORIES = [
    {"name": "Water Leakage", "severity": 9, "department": "Water Department"},
    {"name": "Garbage Overflow", "severity": 7, "department": "Sanitation Department"},
    {"name": "Streetlight", "severity": 6, "department": "Electrical Department"},
    {"name": "Road Damage", "severity": 8, "department": "Road Department"},
    {"name": "Criminal Activity", "severity": 10, "department": "Police Department"}
]

def init_db():
    app = create_app()
    with app.app_context():
        print("Creating PostgreSQL database tables...")
        try:
            db.create_all()
            print("✓ Tables created successfully.")
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            print("\nPlease ensure PostgreSQL is running and your DATABASE_URL in .env is correct.")
            sys.exit(1)

        # Seed categories
        print("Seeding initial categories...")
        seeded_count = 0
        for cat_data in DEFAULT_CATEGORIES:
            existing = Category.query.filter_by(name=cat_data["name"]).first()
            if not existing:
                cat = Category(
                    name=cat_data["name"],
                    severity=cat_data["severity"],
                    department=cat_data["department"]
                )
                db.session.add(cat)
                seeded_count += 1

        if seeded_count > 0:
            db.session.commit()
            print(f"✓ Seeded {seeded_count} categories.")
        else:
            print("✓ Categories already present.")

        print("\nDatabase initialization complete! You can now start the server with: python app.py")

if __name__ == '__main__':
    init_db()
