import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_admin_notification(user_name: str, user_email: str):
    """Notify administrators via email when a new user registers via SSO."""
    smtp_server = os.environ.get("SMTP_SERVER")
    smtp_port = int(os.environ.get("SMTP_PORT", 25))
    smtp_user = os.environ.get("SMTP_USERNAME")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    admin_emails = os.environ.get("ADMIN_EMAILS", "").split(",")
    app_url = os.environ.get("APP_BASE_URL", "https://digitalized-dpr.adani.com")

    if not smtp_server or not admin_emails:
        print("[Email] SMTP not configured. Skipping notification.")
        return

    subject = f"[CEO Tracker] New User Registration: {user_name}"
    
    body = f"""
    <html>
    <body style="font-family: sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #0B74B0;">New User Registered</h2>
            <p>A new user has signed in via SSO and been created in the system.</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> {user_name}</p>
                <p><strong>Email:</strong> {user_email}</p>
                <p><strong>Default Role:</strong> VIEWER</p>
                <p><strong>Default Scope:</strong> All</p>
            </div>
            
            <p>Please review and update their access role if necessary via the Admin Console.</p>
            
            <a href="{app_url}/application" style="display: inline-block; padding: 12px 24px; background: #0B74B0; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Admin Console
            </a>
            
            <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; pt-10;">
                This is an automated notification from Adani Digitalized DPR - Execution Tracker.
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = ", ".join(admin_emails)
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f"[Email] Notification sent to admins for {user_email}")
    except Exception as e:
        print(f"[Email] Failed to send notification: {str(e)}")
