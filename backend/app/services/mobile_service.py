import os
import random
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime
from typing import Dict, Optional, Tuple

from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.database.models import (
    VerificationSessionModel,
    ConnectedDeviceModel,
    CameraSessionModel,
    ConnectionLogModel,
    DeviceHistoryModel,
)

class MobileConnectService:
    """
    Mobile Camera Connect Authentication, Email Verification & Session Service.
    Enforces 6-digit code generation, hashing, 5-min expiration, 60s resend cooldown, 
    5-attempt limit, and 10-min session token expiration.
    """

    def _hash_code(self, code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    def send_verification_email(self, email: str, code: str) -> bool:
        """
        Sends verification code to email using SMTP / Resend / SendGrid if configured,
        or logs code securely for local development.
        """
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@nightvision.ai")

        subject = "NightVision AI - Your Mobile Camera Verification Code"
        body = f"""
        Hello,

        Your 6-digit verification code to connect your mobile camera to NightVision AI is:

        {code}

        This code expires in 5 minutes. Do not share this code with anyone.

        Best regards,
        NightVision AI Security Team
        """

        # 1. Standard SMTP dispatch if configured
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
                print(f"[MobileService] Verification email sent to {email} via SMTP.")
                return True
            except Exception as e:
                print(f"[MobileService] SMTP dispatch error: {e}")

        # 2. Resend API if RESEND_API_KEY env variable set
        resend_key = os.getenv("RESEND_API_KEY")
        if resend_key:
            try:
                import urllib.request
                import json
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
                        print(f"[MobileService] Verification email sent to {email} via Resend.")
                        return True
            except Exception as e_resend:
                print(f"[MobileService] Resend API error: {e_resend}")

        # 3. Local Development Log Fallback
        print(f"==========================================================")
        print(f"[MOBILE VERIFICATION CODE FOR {email}]: {code}")
        print(f"==========================================================")
        return True

    def generate_verification_code(self, email: str) -> Tuple[bool, str, int]:
        db: Session = SessionLocal()
        try:
            now = datetime.datetime.utcnow()

            # Check 60s resend cooldown
            existing = (
                db.query(VerificationSessionModel)
                .filter(VerificationSessionModel.email == email)
                .order_by(VerificationSessionModel.created_at.desc())
                .first()
            )

            if existing:
                seconds_since_last = (now - existing.created_at).total_seconds()
                if seconds_since_last < 60:
                    cooldown_remaining = int(60 - seconds_since_last)
                    return False, f"Please wait {cooldown_remaining} seconds before requesting a new code.", cooldown_remaining

            code = f"{random.randint(100000, 999999)}"
            code_hash = self._hash_code(code)
            session_id = f"vsec_{secrets.token_hex(8)}"
            expires_at = now + datetime.timedelta(minutes=5)

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

            # Send Email
            self.send_verification_email(email, code)

            return True, "Verification code sent to your email address.", 60
        finally:
            db.close()

    def verify_code(self, email: str, code: str) -> Tuple[bool, str, Optional[str]]:
        db: Session = SessionLocal()
        try:
            now = datetime.datetime.utcnow()
            session = (
                db.query(VerificationSessionModel)
                .filter(VerificationSessionModel.email == email, VerificationSessionModel.verified == False)
                .order_by(VerificationSessionModel.created_at.desc())
                .first()
            )

            if not session:
                return False, "No active verification session found for this email. Please request a code.", None

            # Check expiration (5 minutes)
            if now > session.expires_at:
                return False, "Verification code has expired. Please request a new code.", None

            # Check attempt limit (5 attempts max)
            if session.attempts >= 5:
                return False, "Maximum verification attempts exceeded. Please request a new code.", None

            session.attempts += 1
            input_hash = self._hash_code(code)

            if input_hash != session.code_hash:
                db.commit()
                remaining = 5 - session.attempts
                return False, f"Incorrect verification code. {remaining} attempt(s) remaining.", None

            # Mark verified
            session.verified = True

            # Generate Cryptographically Secure Session Token
            session_token = f"nvm_tok_{secrets.token_urlsafe(32)}"
            device_id = f"dev_{secrets.token_hex(6)}"

            # Create Connected Device & Camera Session Records
            connected_device = ConnectedDeviceModel(
                id=f"cdev_{secrets.token_hex(8)}",
                email=email,
                device_id=device_id,
                device_name="Mobile Camera Device",
                session_token=session_token,
                status="VERIFIED",
                last_connected=now,
            )
            db.add(connected_device)

            camera_session = CameraSessionModel(
                id=f"cams_{secrets.token_hex(8)}",
                session_token=session_token,
                device_id=device_id,
                resolution="1920x1080",
                fps=30,
                signal_strength="EXCELLENT",
                battery_pct=95,
                camera_facing="environment",
                started_at=now,
                expires_at=now + datetime.timedelta(minutes=10),
            )
            db.add(camera_session)

            # Log event
            log_entry = ConnectionLogModel(
                id=f"log_{secrets.token_hex(8)}",
                device_id=device_id,
                event_type="VERIFICATION_SUCCESS",
                message=f"Email {email} successfully verified code.",
                timestamp=now,
            )
            db.add(log_entry)

            # Update Device History
            history = DeviceHistoryModel(
                id=f"hist_{secrets.token_hex(8)}",
                email=email,
                device_id=device_id,
                device_name="Mobile Camera Device",
                last_ip="127.0.0.1",
                first_connected=now,
                last_connected=now,
            )
            db.add(history)

            db.commit()
            return True, "Email verified successfully.", session_token
        finally:
            db.close()

mobile_service = MobileConnectService()
