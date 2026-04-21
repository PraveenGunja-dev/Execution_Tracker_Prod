"""
SSO Router — Azure AD SAML-based Single Sign-On
Endpoints:
  GET  /api/sso/login    → Redirects user to Azure AD login
  POST /api/sso/callback → Receives SAML assertion, creates/finds user, redirects to frontend
"""
import os
import json
import base64
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from database import fetch_one, get_db
from utils.email import send_admin_notification
from auth_utils import create_access_token

router = APIRouter(prefix="/api/sso", tags=["sso"])

# ── Load SSO Configuration from Environment ─────────────────────────
TENANT_ID = os.environ.get("SSO_TENANT_ID", "04c72f56-1848-46a2-8167-8e5d36510cbc")
SP_BASE_URL = os.environ.get("SSO_SP_BASE_URL", "https://digitalized-dpr.adani.com")
FRONTEND_URL = os.environ.get("SSO_FRONTEND_URL", "https://digitalized-dpr.adani.com/execution-tracker")

# Force override to avoid .env copy-paste errors on the server
if not FRONTEND_URL.endswith("execution-tracker"):
    FRONTEND_URL = "https://digitalized-dpr.adani.com/execution-tracker"
    
ENABLE_SSO = os.environ.get("ENABLE_SSO", "true").lower() == "true"
SAML_CERT = os.environ.get("SSO_SAML_CERT", "")

def _get_saml_settings():
    """Build python3-saml settings dict from Azure AD metadata."""
    return {
        "strict": False,
        "debug": True,
        "sp": {
            "entityId": SP_BASE_URL,
            "assertionConsumerService": {
                "url": f"{SP_BASE_URL}/api/sso/callback",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "singleLogoutService": {
                "url": f"{SP_BASE_URL}/api/sso/sls",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            "x509cert": "",
            "privateKey": "",
        },
        "idp": {
            "entityId": f"https://sts.windows.net/{TENANT_ID}/",
            "singleSignOnService": {
                "url": f"https://login.microsoftonline.com/{TENANT_ID}/saml2",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "singleLogoutService": {
                "url": f"https://login.microsoftonline.com/{TENANT_ID}/saml2",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": SAML_CERT,
        },
        "security":{
            "requestedAuthnContext": False
        }
    }


async def _prepare_request(request: Request) -> dict:
    """Convert FastAPI request into the dict format python3-saml expects."""
    host = request.headers.get("host", request.url.hostname)
    https = (
        "on"
        if request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto") == "https"
        else "off"
    )
    form_data = await request.form()
    return {
        "https": https,
        "http_host": host,
        "server_port": request.url.port,
        "script_name": request.url.path,
        "get_data": dict(request.query_params),
        "post_data": dict(form_data),
        "lowercase_urlencoding": False,
    }


# ═══════════════════════════════════════════════════════════════════
# 1) Initiate SSO — redirects browser to Azure AD
# ═══════════════════════════════════════════════════════════════════
@router.get("/login")
async def sso_login(request: Request):
    if not ENABLE_SSO:
        raise HTTPException(status_code=403, detail="SSO is disabled")
    req = await _prepare_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=None, old_settings=_get_saml_settings())

    return_to = request.query_params.get("return_to", f"{FRONTEND_URL}/application")
    
    # Enforce correct subpath logic so RelayState doesn't get messed up
    if "execution-tracker" not in return_to:
        return_to = f"{FRONTEND_URL}/application"
        
    sso_url = auth.login(return_to=return_to)
    
    # Send a cookie so Nginx knows to route the Azure AD POST callback back to Port 3121
    # MUST be samesite="none" and secure=True to survive the cross-site POST from Microsoft
    response = RedirectResponse(url=sso_url)
    response.set_cookie(
        key="app_target", 
        value="execution-tracker", 
        path="/", 
        httponly=True, 
        max_age=300, 
        samesite="none", 
        secure=True
    )
    return response


# ═══════════════════════════════════════════════════════════════════
# 2) ACS (Assertion Consumer Service) — Azure AD POSTs here
# ═══════════════════════════════════════════════════════════════════
@router.post("/callback")
async def sso_callback(request: Request):
    req = await _prepare_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=None, old_settings=_get_saml_settings())

    auth.process_response()
    errors = auth.get_errors()

    if errors:
        reason = auth.get_last_error_reason()
        print(f"[SSO] SAML errors: {errors} — {reason}")
        return RedirectResponse(url=f"{FRONTEND_URL}/application?sso_error=saml_failed")

    if not auth.is_authenticated():
        return RedirectResponse(url=f"{FRONTEND_URL}/application?sso_error=not_authenticated")

    # ── Extract claims from SAML response ────────────────────────
    email = auth.get_nameid()
    attrs = auth.get_attributes()

    ad_name = (attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") or [""])[0]
    ad_email = (attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress") or [""])[0]
    ad_given = (attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname") or [""])[0]
    ad_surname = (attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname") or [""])[0]

    actual_email = ad_email or ad_name or email
    actual_username = f"{ad_given} {ad_surname}".strip() or actual_email.split("@")[0]

    # ── Find or create user in local DB ──────────────────────────
    user_row = fetch_one("SELECT * FROM users WHERE email = %s", (actual_email,))
    
    # Auto-promote specific emails to ADMIN
    target_role = "ADMIN" if actual_email.lower() == "praveen.gunja@adani.com" else "VIEWER"

    if not user_row:
        # First-time SSO user
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, email, password, role, scope) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (actual_username, actual_email, "sso-managed", target_role, "all"),
            )
            user_id = cur.fetchone()["id"]
        role = target_role
        scope = "all"
        
        # Notify admins about the new registration
        try:
            send_admin_notification(actual_username, actual_email)
        except Exception as e:
            print(f"[SSO] Email notification failed: {e}")
    else:
        user_id = user_row["id"]
        role = (user_row.get("role") or "VIEWER").upper()
        
        # Retroactive auto-promote if they already signed up as VIEWER
        if actual_email.lower() == "praveen.gunja@adani.com" and role != "ADMIN":
            with get_db() as conn:
                conn.execute("UPDATE users SET role='ADMIN' WHERE id=%s", (user_id,))
            role = "ADMIN"
            
        scope = user_row.get("scope") or "all"
        actual_username = user_row["username"]

    # ── Create a real JWT for the frontend ────────────────────────
    access_token = create_access_token({
        "sub": actual_email,
        "user_id": user_id,
        "username": actual_username,
        "role": role,
        "scope": scope,
    })

    # ── Encode user payload for the frontend ─────────────────────
    user_payload = json.dumps({
        "id": user_id,
        "username": actual_username,
        "email": actual_email,
        "role": role,
        "scope": scope,
        "access_token": access_token,
    })
    encoded = base64.urlsafe_b64encode(user_payload.encode()).decode()

    # Force target explicitly to Execution Tracker to avoid any intermittent main DPR routes
    target = f"{FRONTEND_URL}/application"

    sep = "&" if "?" in target else "?"
    # Use status_code=303 to force the browser to change the POST to a GET.
    response = RedirectResponse(url=f"{target}{sep}sso_auth={encoded}", status_code=303)
    # Clear the routing cookie now that we're successfully logged in
    response.delete_cookie(key="app_target", path="/")
    return response


# ═══════════════════════════════════════════════════════════════════
# 3) Metadata endpoint — handy for Azure AD config
# ═══════════════════════════════════════════════════════════════════
@router.get("/metadata")
async def sso_metadata(request: Request):
    req = await _prepare_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=None, old_settings=_get_saml_settings())
    metadata = auth.get_settings().get_sp_metadata()
    errors = auth.get_settings().validate_metadata(metadata)
    if errors:
        return {"errors": errors}
    from fastapi.responses import Response
    return Response(content=metadata, media_type="application/xml")
