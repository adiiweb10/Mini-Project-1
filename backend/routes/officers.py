import random
from flask import Blueprint, request, jsonify
from models import db, User, Employee
from utils import get_current_user, login_required

officers_bp = Blueprint('officers', __name__, url_prefix='/api/officers')

DEPARTMENTS = [
    "Water Department",
    "Sanitation Department",
    "Electrical Department",
    "Road Department",
    "Police Department"
]

CODE_MAP = {
    "Water Department": "WAT",
    "Sanitation Department": "SAN",
    "Electrical Department": "ELE",
    "Road Department": "ROA",
    "Police Department": "POL"
}

def generate_officer_id(department):
    prefix = CODE_MAP.get(department, "OFF")
    num = random.randint(100, 999)
    return f"OFF-{prefix}-{num}"

@officers_bp.route('', methods=['GET'])
def get_officers():
    # Can be accessed publicly or by admin to check active officers
    officers = User.query.filter_by(role='officer').all()
    return jsonify([officer.to_dict() for officer in officers]), 200


@officers_bp.route('/employees', methods=['GET'])
@login_required
def get_employees(current_user):
    """Officer sees the 5 zone employees of their own department. Admin sees all."""
    if current_user.role == 'officer':
        rows = Employee.query.filter_by(department=current_user.department)
    elif current_user.role == 'admin':
        rows = Employee.query
    else:
        return jsonify({'error': 'Not allowed.'}), 403
    zone_order = {'East': 1, 'West': 2, 'North': 3, 'South': 4, 'Central': 5}
    employees = sorted(rows.all(), key=lambda e: (e.department, zone_order.get(e.zone, 9)))
    return jsonify([e.to_dict() for e in employees]), 200


@officers_bp.route('/employees/<int:employee_id>/login', methods=['POST'])
@login_required
def create_employee_login(current_user, employee_id):
    """Department officer creates (or resets) the login of one of their zone employees."""
    if current_user.role != 'officer':
        return jsonify({'error': 'Only the department officer can create employee logins.'}), 403

    employee = Employee.query.get(employee_id)
    if not employee or employee.department != current_user.department:
        return jsonify({'error': 'Employee not found in your department.'}), 404

    data = request.get_json() or {}
    mobile = (data.get('mobile') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not mobile or not email or not password:
        return jsonify({'error': 'Mobile, email and password are required.'}), 400
    if len(mobile) != 10 or not mobile.isdigit():
        return jsonify({'error': 'Mobile number must be a valid 10-digit number.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400

    user = User.query.get(employee.user_id) if employee.user_id else None
    own_id = user.id if user else None
    clashes = User.query.filter((User.email == email) | (User.mobile == mobile)).all()
    if any(u.id != own_id for u in clashes):
        return jsonify({'error': 'Email or mobile is already registered to another account.'}), 400

    login_id = f"EMP-{CODE_MAP.get(employee.department, 'OFF')}-{employee.zone.upper()}"

    if user is None:
        user = User(
            name=employee.name,
            mobile=mobile,
            email=email,
            department=employee.department,
            employee_id=login_id,
            role='employee'
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        employee.user_id = user.id
    else:
        user.mobile = mobile
        user.email = email
        user.set_password(password)

    employee.mobile = mobile
    db.session.commit()

    return jsonify({
        'message': f'Login ready for {employee.name} ({employee.zone} Zone). Login ID: {login_id}',
        'loginId': login_id,
        'employee': employee.to_dict()
    }), 201


@officers_bp.route('', methods=['POST'])
@login_required
def create_officer(current_user):
    if current_user.role != 'admin':
        return jsonify({'error': 'Only Admin can create field officers.'}), 403

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    mobile = (data.get('mobile') or '').strip()
    email = (data.get('email') or '').strip().lower()
    department = (data.get('department') or '').strip()
    password = data.get('password') or ''

    if not name or not mobile or not email or not department or not password:
        return jsonify({'error': 'All fields (name, mobile, email, department, password) are required.'}), 400

    if department not in DEPARTMENTS:
        return jsonify({'error': f'Invalid department. Must be one of: {", ".join(DEPARTMENTS)}'}), 400

    if len(mobile) != 10 or not mobile.isdigit():
        return jsonify({'error': 'Mobile number must be a valid 10-digit number.'}), 400

    # Rule 2: Strictly ONE field officer per department
    existing_officer = User.query.filter_by(role='officer', department=department).first()
    if existing_officer:
        return jsonify({'error': f'An officer already exists for {department}. Remove the existing officer first.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered.'}), 400

    if User.query.filter_by(mobile=mobile).first():
        return jsonify({'error': 'Mobile number is already registered.'}), 400

    employee_id = generate_officer_id(department)

    officer = User(
        name=name,
        mobile=mobile,
        email=email,
        department=department,
        employee_id=employee_id,
        role='officer'
    )
    officer.set_password(password)

    db.session.add(officer)
    db.session.commit()

    return jsonify({
        'message': f'Field officer created successfully for {department}.',
        'officer': officer.to_dict()
    }), 201


@officers_bp.route('/<int:officer_id>', methods=['DELETE'])
@login_required
def delete_officer(current_user, officer_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Only Admin can remove field officers.'}), 403

    officer = User.query.filter_by(id=officer_id, role='officer').first()
    if not officer:
        return jsonify({'error': 'Officer not found.'}), 404

    db.session.delete(officer)
    db.session.commit()

    return jsonify({'message': 'Officer removed successfully.'}), 200