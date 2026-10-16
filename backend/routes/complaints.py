import random
from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Complaint, Category, User, Upvote, Employee
from utils import get_current_user, save_uploaded_file

complaints_bp = Blueprint('complaints', __name__, url_prefix='/api/complaints')

CATEGORY_DEPARTMENT_MAP = {
    "Water Leakage": "Water Department",
    "Garbage Overflow": "Sanitation Department",
    "Streetlight": "Electrical Department",
    "Road Damage": "Road Department",
    "Criminal Activity": "Police Department"
}

VALID_STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"]

def generate_tracking_id():
    num = random.randint(100000, 999999)
    return f"CMP-{num}"

@complaints_bp.route('', methods=['GET'])
def get_complaints():
    user = get_current_user()

    query = Complaint.query

    if user and user.role == 'officer':
        # Rule 4: Field officers only see complaint queue for their assigned department
        query = query.filter_by(department=user.department)
    elif user and user.role == 'employee':
        # Field employees only see complaints assigned to them
        emp = Employee.query.filter_by(user_id=user.id).first()
        if emp:
            query = query.filter(Complaint.assigned_employee_id == emp.id)
        else:
            query = query.filter(Complaint.id == -1)

    # Order by creation date descending
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify([c.to_dict() for c in complaints]), 200


@complaints_bp.route('/<int:complaint_id>', methods=['GET'])
def get_complaint(complaint_id):
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404
    return jsonify(complaint.to_dict()), 200


@complaints_bp.route('', methods=['POST'])
def create_complaint():
    user = get_current_user()

    # Form parameters can come from request.form or request.get_json()
    if request.content_type and 'multipart/form-data' in request.content_type:
        title = (request.form.get('title') or '').strip()
        description = (request.form.get('description') or '').strip()
        category_name = (request.form.get('category') or '').strip()
        category_id = request.form.get('category_id')
        location_text = (request.form.get('location_text') or request.form.get('location') or '').strip()
        citizen_email = (request.form.get('citizen_email') or '').strip().lower()
        is_safety = request.form.get('is_safety_hazard') in ['true', '1', 'on'] or request.form.get('safety') == 'true'
        photo_file = request.files.get('photo')
        photo_url = save_uploaded_file(photo_file) if photo_file else ''
    else:
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        description = (data.get('description') or '').strip()
        category_name = (data.get('category') or '').strip()
        category_id = data.get('category_id')
        location_text = (data.get('location_text') or data.get('location') or '').strip()
        citizen_email = (data.get('citizen_email') or '').strip().lower()
        is_safety = bool(data.get('is_safety_hazard') or data.get('safety'))
        photo_url = (data.get('photo') or '').strip()

    # Lookup category if category_id was passed
    if category_id and not category_name:
        cat = Category.query.get(category_id)
        if cat:
            category_name = cat.name

    if not title or not description or not category_name or not location_text:
        return jsonify({'error': 'Title, description, category, and location are required.'}), 400

    department = CATEGORY_DEPARTMENT_MAP.get(category_name, "General Department")

    if user:
        citizen_email = user.email
        owner_id = user.id
        owner_name = user.name
        owner_mobile = user.mobile
    else:
        owner_id = None
        owner_name = citizen_email.split('@')[0] if citizen_email else 'Anonymous'
        owner_mobile = ''

    # Find active assigned officer for this department if exists
    assigned_officer = User.query.filter_by(role='officer', department=department).first()
    assigned_officer_id = assigned_officer.id if assigned_officer else None

    tracking_id = generate_tracking_id()

    complaint = Complaint(
        tracking_id=tracking_id,
        title=title,
        description=description,
        category_name=category_name,
        department=department,
        location_text=location_text,
        is_safety_hazard=is_safety,
        citizen_email=citizen_email,
        owner_id=owner_id,
        owner_name=owner_name,
        owner_mobile=owner_mobile,
        photo_url=photo_url,
        status='Submitted',
        assigned_officer_id=assigned_officer_id
    )

    db.session.add(complaint)
    db.session.commit()

    return jsonify({
        'message': 'Complaint registered successfully.',
        'id': complaint.id,
        'tracking_id': tracking_id,
        'complaint': complaint.to_dict()
    }), 201


@complaints_bp.route('/<int:complaint_id>/status', methods=['PATCH', 'PUT'])
def update_status(complaint_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required to update status.'}), 401

    if user.role not in ['admin', 'officer', 'employee']:
        return jsonify({'error': 'You are not allowed to update complaint status.'}), 403

    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404

    # Rule 4: Field officers can update ONLY complaints belonging to their assigned department
    if user.role == 'officer' and complaint.department != user.department:
        return jsonify({'error': f'Permission denied. You can only update complaints for {user.department}.'}), 403

    data = request.get_json() or {}
    new_status = (data.get('status') or '').strip()

    if new_status not in VALID_STATUSES:
        return jsonify({'error': f'Invalid status. Allowed values: {", ".join(VALID_STATUSES)}'}), 400

    if user.role == 'employee':
        emp = Employee.query.filter_by(user_id=user.id).first()
        if not emp or complaint.assigned_employee_id != emp.id:
            return jsonify({'error': 'This complaint is not assigned to you.'}), 403
        if new_status != 'In Progress':
            return jsonify({'error': 'Employees can only mark work In Progress. Upload a photo to report completion.'}), 403

    complaint.status = new_status
    if user.role == 'officer':
        complaint.assigned_officer_id = user.id

    db.session.commit()

    return jsonify({
        'message': f'Complaint status updated to {new_status}.',
        'complaint': complaint.to_dict()
    }), 200


@complaints_bp.route('/<int:complaint_id>/assign-employee', methods=['POST', 'PATCH'])
def assign_employee(complaint_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401
    if user.role != 'officer':
        return jsonify({'error': 'Only the field officer can assign employees.'}), 403

    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404
    if complaint.department != user.department:
        return jsonify({'error': f'You can only assign complaints of {user.department}.'}), 403

    data = request.get_json() or {}
    employee = Employee.query.get(data.get('employee_id'))
    if not employee or employee.department != user.department:
        return jsonify({'error': 'Choose an employee from your own department.'}), 400

    complaint.assigned_employee_id = employee.id
    complaint.assigned_officer_id = user.id
    db.session.commit()

    return jsonify({
        'message': f'Assigned to {employee.name} ({employee.zone} Zone).',
        'complaint': complaint.to_dict()
    }), 200


@complaints_bp.route('/<int:complaint_id>/upvote', methods=['POST'])
def upvote_complaint(complaint_id):
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404

    user = get_current_user()
    if user:
        existing = Upvote.query.filter_by(user_id=user.id, complaint_id=complaint.id).first()
        if existing:
            return jsonify({'error': 'You have already upvoted this complaint.'}), 400
        upvote = Upvote(user_id=user.id, complaint_id=complaint.id)
        db.session.add(upvote)

    complaint.upvotes += 1
    db.session.commit()

    return jsonify({
        'message': 'Upvote recorded.',
        'upvotes': complaint.upvotes,
        'complaint': complaint.to_dict()
    }), 200


@complaints_bp.route('/<int:complaint_id>/proof', methods=['POST'])
def submit_proof(complaint_id):
    """Field employee reports completed work by uploading a photo + remark."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401
    if user.role != 'employee':
        return jsonify({'error': 'Only field employees can submit work proof.'}), 403

    employee = Employee.query.filter_by(user_id=user.id).first()
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404
    if not employee or complaint.assigned_employee_id != employee.id:
        return jsonify({'error': 'This complaint is not assigned to you.'}), 403
    if complaint.status in ['Resolved', 'Rejected']:
        return jsonify({'error': f'This complaint is already {complaint.status}.'}), 400

    photo = request.files.get('photo')
    remark = (request.form.get('remark') or '').strip()
    if not photo or not photo.filename:
        return jsonify({'error': 'Please attach a photo of the completed work.'}), 400
    if not (photo.mimetype or '').startswith('image/'):
        return jsonify({'error': 'Only image files are allowed.'}), 400

    photo_url = save_uploaded_file(photo)
    if not photo_url:
        return jsonify({'error': 'Could not save the photo. Please try again.'}), 400

    complaint.proof_photo_url = photo_url
    complaint.employee_remark = remark
    complaint.proof_status = 'Submitted'
    complaint.proof_submitted_at = datetime.utcnow()
    if complaint.status in ['Submitted', 'Under Review']:
        complaint.status = 'In Progress'
    db.session.commit()

    return jsonify({
        'message': 'Work proof submitted. Your officer will review it.',
        'complaint': complaint.to_dict()
    }), 200


@complaints_bp.route('/<int:complaint_id>/review-proof', methods=['POST'])
def review_proof(complaint_id):
    """Department officer approves (-> Resolved) or rejects (-> In Progress) the employee's proof."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required.'}), 401
    if user.role != 'officer':
        return jsonify({'error': 'Only the department officer can review work proof.'}), 403

    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({'error': 'Complaint not found.'}), 404
    if complaint.department != user.department:
        return jsonify({'error': f'You can only review complaints of {user.department}.'}), 403
    if complaint.proof_status != 'Submitted':
        return jsonify({'error': 'There is no pending proof to review.'}), 400

    data = request.get_json() or {}
    action = (data.get('action') or '').strip().lower()
    if action == 'approve':
        complaint.proof_status = 'Approved'
        complaint.status = 'Resolved'
        msg = 'Proof approved. Complaint marked Resolved.'
    elif action == 'reject':
        complaint.proof_status = 'Rejected'
        complaint.status = 'In Progress'
        msg = 'Proof rejected. Complaint sent back to the employee.'
    else:
        return jsonify({'error': 'Action must be approve or reject.'}), 400

    complaint.assigned_officer_id = user.id
    db.session.commit()
    return jsonify({'message': msg, 'complaint': complaint.to_dict()}), 200