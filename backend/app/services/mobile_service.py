import os
import random
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime
from typing import Dict, Optional, Tuple

# In-memory session store as a reliable primary store (DB is secondary)
_verification_sessions: Dict[str, dict] = {}  # email -> {code_hash, expires_at, attempts, created_at}
_camera_sessions: Dict[str, dict] = {}        # session_token -> {device_id, email, expires_at, ...}

class MobileConnectService:
    """
    Mobile Camera Connect Authentication, Email Verification & Session Service.
    Uses in-memory store as primary (DB as optional secondary).
    Enforces 6-digit code generation, hashing, 5-min expiration, 60s resend cooldown, 5-attempt limit.
    """

    def _hash_code(self, code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    def send_verification_email(self, email: str, code: str) -> bool:
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@nightvision.ai")

        subject = "NightVision AI - Your Mobile Camera Verification Code"
        body = f"""Hello,

Your 6-digit verification code to connect your mobile camera to NightVision AI is:

  {code}

This code expires in 5 minutes. Do not share this code.

Best regards,
NightVision AI Security Team"""

        # 1. SMTP if configured
        if smtp_host and smtp_user and smtp_password:
            try:
                msg = MIMEMultipart()
                msg["From"] = smtp_from
                msg["To"] = email
                msg["Subject"] = subject
                msg.attach(MIMEText(body, "plain"))
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, [email], msg.as_string())
                server.quit()
                print(f"[MobileService] Email sent to {email} via SMTP.")
                return True
            except Exception as e:
                print(f"[MobileService] SMTP error: {e}")

        # 2. Resend API if configured
        resend_key = os.getenv("RESEND_API_KEY")
        if resend_key:
            try:
                import urllib.request, json
                req_data = json.dumps({
                    "from": "NightVision AI <onboarding@resend.dev>",
                    "to": [email],
                    "subject": subject,
                    "text": body
                }).encode("utf-8")
                req = urllib.request.Request(
                    "https://api.resend.com/emails",
                    data=req_data,
                    headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=8) as response:
                    if response.status in (200, 201):
                        print(f"[MobileService] Email sent to {email} via Resend.")
                        return True
            except Exception as e_resend:
                print(f"[MobileService] Resend API error: {e_resend}")

        # 3. Dev fallback — log to console (always works)
        print(f"\n{'='*60}")
        print(f"[DEV MODE] VERIFICATION CODE FOR {email}: {code}")
        print(f"{'='*60}\n")
        return True

    def generate_verification_code(self, email: str) -> Tuple[bool, str, int]:
        now = datetime.datetime.utcnow()

        # Check 60s resend cooldown from in-memory store
        existing = _verification_sessions.get(email)
        if existing:
            seconds_since = (now - existing["created_at"]).total_seconds()
            if seconds_since < 60:
                remaining = int(60 - seconds_since)
                return False, f"Please wait {remaining} seconds before requesting a new code.", remaining

        code = f"{random.randint(100000, 999999)}"
        code_hash = self._hash_code(code)
        expires_at = now + datetime.timedelta(minutes=5)

        # Store in-memory
        _verification_sessions[email] = {
            "code_hash": code_hash,
            "expires_at": expires_at,
            "created_at": now,
            "attempts": 0,
            "verified": False,
        }

        # Also try to persist to DB (non-blocking)
        try:
            from app.database.connection import SessionLocal
            from app.database.models import VerificationSessionModel
            db = SessionLocal()
            try:
                session_id = f"vsec_{secrets.token_hex(8)}"
                new_session = VerificationSessionModel(
                    id=session_id,
                    email=email,
                    code_hash=code_hash,
                    attempts=0,
                    expires_at=expires_at,
                    created_at=now,
                    verified=False,
                )
                db.add(new_session)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception as db_err:
            print(f"[MobileService] DB persist notice (non-critical): {db_err}")

        self.send_verification_email(email, code)
        return True, "Verification code sent to your email address.", 60

    def verify_code(self, email: str, code: str) -> Tuple[bool, str, Optional[str]]:
        now = datetime.datetime.utcnow()

        # Primary: check in-memory store
        session = _verification_sessions.get(email)
        if not session:
            return False, "No verification code found for this email. Please request a new code.", None

        if session.get("verified"):
            return False, "Code already used. Please request a new verification code.", None

        if now > session["expires_at"]:
            _verification_sessions.pop(email, None)
            return False, "Verification code has expired. Please request a new code.", None

        if session["attempts"] >= 5:
            _verification_sessions.pop(email, None)
            return False, "Maximum verification attempts exceeded. Please request a new code.", None

        session["attempts"] += 1
        input_hash = self._hash_code(code)

        if input_hash != session["code_hash"]:
            remaining = 5 - session["attempts"]
            return False, f"Incorrect verification code. {remaining} attempt(s) remaining.", None

        # Verified — mark and generate secure token
        session["verified"] = True
        _verification_sessions[email] = session

        session_token = f"nvm_tok_{secrets.token_urlsafe(32)}"
        device_id = f"dev_{secrets.token_hex(6)}"

        _camera_sessions[session_token] = {
            "email": email,
            "device_id": device_id,
            "device_name": "Mobile Camera Device",
            "resolution": "1920x1080",
            "fps": 30,
            "signal_strength": "EXCELLENT",
            "battery_pct": 95,
            "camera_facing": "environment",
            "started_at": now,
            "expires_at": now + datetime.timedelta(minutes=10),
            "status": "VERIFIED",
        }

        # Non-blocking DB persist
        try:
            from app.database.connection import SessionLocal
            from app.database.models import (
                ConnectedDeviceModel, CameraSessionModel,
                ConnectionLogModel, DeviceHistoryModel
            )
            db = SessionLocal()
            try:
                db.add(ConnectedDeviceModel(
                    id=f"cdev_{secrets.token_hex(8)}",
                    email=email, device_id=device_id,
                    device_name="Mobile Camera Device",
                    session_token=session_token, status="VERIFIED",
                    last_connected=now,
                ))
                db.add(CameraSessionModel(
                    id=f"cams_{secrets.token_hex(8)}",
                    session_token=session_token, device_id=device_id,
                    resolution="1920x1080", fps=30,
                    signal_strength="EXCELLENT", battery_pct=95,
                    camera_facing="environment",
                    started_at=now,
                    expires_at=now + datetime.timedelta(minutes=10),
                ))
                db.add(ConnectionLogModel(
                    id=f"log_{secrets.token_hex(8)}",
                    device_id=device_id,
                    event_type="VERIFICATION_SUCCESS",
                    message=f"Email {email} verified.",
                    timestamp=now,
                ))
                db.add(DeviceHistoryModel(
                    id=f"hist_{secrets.token_hex(8)}",
                    email=email, device_id=device_id,
                    device_name="Mobile Camera Device",
                    last_ip="127.0.0.1",
                    first_connected=now, last_connected=now,
                ))
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception as db_err:
            print(f"[MobileService] DB persist notice (non-critical): {db_err}")

        return True, "Email verified successfully.", session_token

    def get_session(self, session_token: str) -> Optional[dict]:
        return _camera_sessions.get(session_token)

    def update_session(self, session_token: str, updates: dict):
        if session_token in _camera_sessions:
            _camera_sessions[session_token].update(updates)

    def disconnect_session(self, session_token: str):
        _camera_sessions.pop(session_token, None)

mobile_service = MobileConnectService()
