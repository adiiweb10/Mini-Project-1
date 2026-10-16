from flask import Blueprint, request, jsonify
from models import db, User
from utils import generate_token, get_current_user, login_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    mobile = (data.get('mobile') or '').strip()
    email = (data.get('email') or '').strip().lower()
    location = (data.get('location') or '').strip()
    password = data.get('password') or ''
    role = (data.get('role') or 'citizen').strip().lower()

    if not name or not mobile or not email or not password:
        return jsonify({'error': 'Name, mobile, email, and password are required.'}), 400

    if len(mobile) != 10 or not mobile.isdigit():
        return jsonify({'error': 'Mobile number must be a valid 10-digit number.'}), 400

    if role not in ['citizen', 'admin']:
        return jsonify({'error': 'Only citizen or admin self-registration is allowed.'}), 400

    # Rule 1: Enforce ONLY ONE Admin system-wide
    if role == 'admin':
        existing_admin = User.query.filter_by(role='admin').first()
        if existing_admin:
            return jsonify({'error': 'An Admin account already exists. Only one Admin is allowed.'}), 400

    # Unique check for email and mobile
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered.'}), 400

    if User.query.filter_by(mobile=mobile).first():
        return jsonify({'error': 'Mobile number is already registered.'}), 400

    user = User(
        name=name,
        mobile=mobile,
        email=email,
        location=location,
        role=role
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = generate_token(user)
    return jsonify({
        'message': 'Account created successfully.',
        'access_token': token,
        'token': token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    identifier = (data.get('identifier') or '').strip()
    password = data.get('password') or ''

    if not identifier or not password:
        return jsonify({'error': 'Identifier and password are required.'}), 400

    id_lower = identifier.lower()

    # Search user by email, mobile, or officer employee_id
    user = User.query.filter(
        (db.func.lower(User.email) == id_lower) |
        (User.mobile == identifier) |
        (db.func.lower(User.employee_id) == id_lower)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email, mobile number, officer ID, or password.'}), 401

    token = generate_token(user)
    user_dict = user.to_dict()

    return jsonify({
        'message': 'Login successful.',
        'access_token': token,
        'token': token,
        'user': user_dict,
        'role': user.role,
        'name': user.name,
        'email': user.email,
        'mobile': user.mobile,
        'location': user.location or '',
        'department': user.department or ''
    }), 200


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_me(current_user):
    return jsonify({
        'user': current_user.to_dict()
    }), 200
