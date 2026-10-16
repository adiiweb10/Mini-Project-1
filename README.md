# Smart Citizen Complaint Management

This repository contains the complete frontend (HTML + CSS + Vanilla JS) and a **Python Flask & PostgreSQL** backend.

---

## 🚀 Quick Start (Frontend Demo Mode)

By default, the application runs entirely in the browser using `localStorage`.

1. Open `index.html` in your web browser (or use VS Code Live Server).
2. Register as a **Citizen** or the **System Admin**.

---

## 🐍 Setting Up Python Flask & PostgreSQL Backend

To run with the real Python Flask backend connected to a PostgreSQL database:

### 1. Prerequisites
- Python 3.9+ installed
- PostgreSQL database server running locally or hosted (e.g. Supabase, Render, ElephantSQL)

### 2. Create PostgreSQL Database
Open PostgreSQL `psql` shell or pgAdmin and create a database:
```sql
CREATE DATABASE citizen_complaint_db;
```

### 3. Setup Backend Environment
Navigate into the `backend/` directory:
```bash
cd backend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

### 4. Configure `.env`
Ensure `.env` contains your PostgreSQL credentials:
```env
FLASK_APP=app.py
FLASK_ENV=development
PORT=5000
SECRET_KEY=your-secure-secret-key

# PostgreSQL Connection String format:
# postgresql://<username>:<password>@<host>:<port>/<database_name>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/citizen_complaint_db

CORS_ORIGIN=*
UPLOAD_FOLDER=uploads
```

### 5. Initialize & Seed Database Tables
Run the database setup script:
```bash
python init_db.py
```
This will automatically create tables for Users, Categories, Complaints, and Upvotes, and pre-seed default categories.

### 6. Start the Flask Server
```bash
python app.py
```
The server will start at `http://localhost:5000`.

### 7. Connect Frontend to Backend
Open `script.js` and set `USE_API` to `true`:
```javascript
const CONFIG = {
  USE_API: true,
  API_BASE_URL: "http://localhost:5000/api"
};
```

---

## 🔒 Security & Business Rules Enforced by Backend

1. **One System Admin Limit**: Only 1 Admin account is permitted system-wide.
2. **One Field Officer per Department**: Strictly 1 active field officer login per department (Water, Sanitation, Electrical, Road, Police).
3. **Role-Based Authorization**:
   - **Citizens**: Register, file complaints, view own/public complaints, upvote.
   - **Field Officers**: Authenticate using Officer Employee ID or Email/Mobile; view and update status ONLY for complaints belonging to their assigned department.
   - **System Admin**: Create and remove department field officers; view and update status for all complaints.
4. **Secure Password Hashing**: Uses Werkzeug's SHA-256 password hashing.
5. **JWT Authentication**: Secured REST endpoints using JSON Web Tokens.
