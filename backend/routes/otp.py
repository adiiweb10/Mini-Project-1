import time, secrets, hashlib, smtplib
from email.message import EmailMessage
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from models import User

# ====== PUT YOUR GMAIL DETAILS HERE ======
SMTP_USER = 'adityabadakar2007@gmail.com'        # Gmail that SENDS the OTP
SMTP_PASS = 'jjob oczc zhrl tvly'           # 16-letter Gmail App Password (no spaces)
# =========================================

otp_bp = Blueprint('otp', __name__, url_prefix='/api/auth')

OTP_TTL = 300        # 5 minutes
MAX_ATTEMPTS = 5
RESEND_GAP = 30      # seconds
_otps = {}           # user_id -> {hash, expires, attempts, sent_at}
_verified = {}       # user_id -> expiry time


def _find_user(identifier):
    ident = (identifier or '').strip()
    return User.query.filter(
        (func.lower(User.email) == ident.lower()) |
        (User.mobile == ident) |
        (func.lower(User.employee_id) == ident.lower())
    ).first()


def _hash(code):
    return hashlib.sha256(code.encode()).hexdigest()


def _send_email(to, code):
    if 'youremail' in SMTP_USER or 'abcdefgh' in SMTP_PASS:
        print('!!! Gmail not set in otp.py (SMTP_USER / SMTP_PASS). OTP NOT emailed.')
        print(f'[DEV MODE] OTP for {to}: {code}')
        return
    msg = EmailMessage()
    msg['Subject'] = 'Your login OTP'
    msg['From'] = SMTP_USER
    msg['To'] = to
    msg.set_content(f'Your OTP is {code}. It is valid for 5 minutes. Do not share it.')
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)
    print(f'OTP email sent to {to}')


def is_otp_verified(user_id):
    return _verified.get(user_id, 0) > time.time()


@otp_bp.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    user = _find_user(data.get('identifier'))
    if not user or not user.check_password(data.get('password', '')):
        return jsonify({'error': 'Invalid credentials'}), 401

    old = _otps.get(user.id)
    if old and time.time() - old['sent_at'] < RESEND_GAP:
        return jsonify({'error': 'Please wait 30 seconds before requesting a new OTP'}), 429

    code = f'{secrets.randbelow(1000000):06d}'
    _otps[user.id] = {'hash': _hash(code), 'expires': time.time() + OTP_TTL,
                      'attempts': 0, 'sent_at': time.time()}
    try:
        _send_email(user.email, code)      # sends to the REGISTERED email
    except Exception as e:
        print('Email error:', e)
        return jsonify({'error': 'Could not send OTP email'}), 500
    return jsonify({'message': 'OTP sent'}), 200


@otp_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    user = _find_user(data.get('identifier'))
    rec = _otps.get(user.id) if user else None
    if not rec or rec['expires'] < time.time():
        return jsonify({'error': 'OTP expired. Please login again.'}), 400
    rec['attempts'] += 1
    if rec['attempts'] > MAX_ATTEMPTS:
        _otps.pop(user.id, None)
        return jsonify({'error': 'Too many wrong attempts. Please login again.'}), 429
    if _hash(str(data.get('otp', '')).strip()) != rec['hash']:
        return jsonify({'error': 'Wrong OTP'}), 400
    _otps.pop(user.id, None)
    _verified[user.id] = time.time() + 120
    return jsonify({'message': 'OTP verified'}), 200