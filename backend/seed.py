from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    mobile = db.Column(db.String(15), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    location = db.Column(db.String(255), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='citizen')  # admin, citizen, officer
    department = db.Column(db.String(100), nullable=True)  # Set for officers
    employee_id = db.Column(db.String(50), nullable=True)  # E.g. OFF-WAT-101
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    complaints = db.relationship('Complaint', backref='owner', lazy=True, foreign_keys='Complaint.owner_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'mobile': self.mobile,
            'email': self.email,
            'location': self.location or '',
            'role': self.role,
            'department': self.department or '',
            'employeeId': self.employee_id or '',
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }


class Category(db.Model):
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    severity = db.Column(db.Integer, nullable=False, default=5)
    department = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'severity': self.severity,
            'department': self.department
        }


class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    mobile = db.Column(db.String(15), nullable=True)
    department = db.Column(db.String(100), nullable=False)
    zone = db.Column(db.String(20), nullable=False)   # East, West, North, South, Central
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('department', 'zone', name='_department_zone_uc'),)

    def open_tasks(self):
        return Complaint.query.filter(
            Complaint.assigned_employee_id == self.id,
            Complaint.status.notin_(['Resolved', 'Rejected'])
        ).count()

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'mobile': self.mobile or '',
            'department': self.department,
            'zone': self.zone,
            'openTasks': self.open_tasks()
        }


class Complaint(db.Model):
    __tablename__ = 'complaints'

    id = db.Column(db.Integer, primary_key=True)
    tracking_id = db.Column(db.String(30), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    location_text = db.Column(db.String(255), nullable=False)
    is_safety_hazard = db.Column(db.Boolean, default=False)
    citizen_email = db.Column(db.String(120), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    owner_name = db.Column(db.String(100), nullable=True)
    owner_mobile = db.Column(db.String(15), nullable=True)
    photo_url = db.Column(db.String(500), nullable=True, default='')
    status = db.Column(db.String(30), nullable=False, default='Submitted')
    upvotes = db.Column(db.Integer, default=0)
    assigned_officer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def priority_score(self):
        cat = Category.query.filter_by(name=self.category_name).first()
        severity = cat.severity if cat else 5
        age_days = (datetime.utcnow() - self.created_at).days if self.created_at else 0
        return severity * 10 + (self.upvotes or 0) * 2 + (50 if self.is_safety_hazard else 0) + age_days

    def to_dict(self):
        return {
            'id': self.id,
            'trackingId': self.tracking_id,
            'title': self.title,
            'description': self.description,
            'category': self.category_name,
            'department': self.department,
            'location': self.location_text,
            'safety': self.is_safety_hazard,
            'citizenEmail': self.citizen_email,
            'ownerId': self.owner_id,
            'ownerName': self.owner_name or '',
            'ownerMobile': self.owner_mobile or '',
            'photo': self.photo_url or '',
            'status': self.status,
            'upvotes': self.upvotes,
            'assignedOfficer': self.assigned_officer_id,
            'assignedEmployee': (lambda e: {'id': e.id, 'name': e.name, 'zone': e.zone} if e else None)(
                Employee.query.get(self.assigned_employee_id) if self.assigned_employee_id else None),
            'priorityScore': self.priority_score(),
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class Upvote(db.Model):
    __tablename__ = 'upvotes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'complaint_id', name='_user_complaint_uc'),)