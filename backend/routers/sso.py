"""
SSO Router — Azure AD OAuth2 Authorization Code Flow (MSAL)
Replaces the previous SAML-based authentication.
"""
import os
import json
import logging
import urllib.parse
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
import msal

from database import fetch_one, get_db, execute
from auth_utils import create_access_token

logger = logging.getLogger("ceo-tracker.sso")
router = APIRouter(prefix="/api/sso", tags=["sso"])

# --- SSO Configuration ---
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip('/')
ROOT_PATH = os.environ.get("FASTAPI_ROOT_PATH", "").rstrip('/')

def _get_msal_client():
    if not AZURE_CLIENT_ID or not AZURE_TENANT_ID or not AZURE_CLIENT_SECRET:
        logger.error("Azure AD credentials missing in environment")
        return None
    
    authority = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
    return msal.ConfidentialClientApplication(
        AZURE_CLIENT_ID,
        authority=authority,
        client_credential=AZURE_CLIENT_SECRET,
    )

def _get_redirect_uri(request: Request):
    """
    FORCE the production redirect URI to prevent 'http://127.0.0.1' mismatch.
    """
    # 1. Try to use it from .env or fallback
    base_url = os.environ.get("APP_BASE_URL", "https://digitalized-dpr.adani.com").rstrip('/')
    # 2. Match the Aegis Pattern (root level)
    return f"{base_url}/api/sso/callback"


@router.get("/login")
async def sso_login(request: Request):
    """Initiate Microsoft SSO login redirect."""
    client = _get_msal_client()
    if not client:
        raise HTTPException(500, detail="SSO Not Configured")
    
    # 1. Aegis Pattern: send a state
    state = "execution-tracker"
    
    # 2. Build URL
    redirect_uri = _get_redirect_uri(request)
    auth_url = client.get_authorization_request_url(
        ["User.Read"],
        redirect_uri=redirect_uri,
        state=state
    )
    
    print(f"[SSO] Redirect URI sent to Azure: {redirect_uri}")
    
    return RedirectResponse(auth_url)


@router.get("/callback")
async def sso_callback(request: Request, code: Optional[str] = None):
    """Handle the callback from Microsoft and exchange code for tokens."""
    # DEBUG: See if this backend is actually receiving the callback
    print(f"[DEBUG] Callback hit on Tracker (3121). State: {request.query_params.get('state')}")
    
    if not code:
        # If no code, maybe it's just a direct hit, redirect to main app
        return RedirectResponse(f"{ROOT_PATH}/application")

    client = _get_msal_client()
    if not client:
        raise HTTPException(500, detail="SSO Not Configured")
    
    # Exchange code for token
    redirect_uri = _get_redirect_uri(request)
    result = client.acquire_token_by_authorization_code(
        code,
        scopes=["User.Read"],
        redirect_uri=redirect_uri
    )
    
    if "error" in result:
        logger.error(f"Azure AD callback error: {result.get('error_description') or result.get('error')}")
        return RedirectResponse(f"{ROOT_PATH}/application?sso_error=AzureAuthFailed")

    # Extract user info
    claims = result.get("id_token_claims")
    if not claims:
        raise HTTPException(400, detail="No ID token claims found")

    email = (claims.get("preferred_username") or claims.get("email", "")).lower()
    name = claims.get("name", "User")

    if not email:
        return RedirectResponse(f"{ROOT_PATH}/application?sso_error=NoEmailFound")

    # --- Find or create user in local DB ---
    user_row = fetch_one("SELECT * FROM users WHERE email = %s", (email,))
    
    # Admin policy
    target_role = "ADMIN" if email == "praveen.gunja@adani.com" else "VIEWER"

    if not user_row:
        # Create new user
        user_id = execute(
            "INSERT INTO users (username, email, password, role, scope) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, email, "sso-managed", target_role, "all"),
        )
        role = target_role
        username = name
    else:
        user_id = user_row["id"]
        role = (user_row.get("role") or "VIEWER").upper()
        username = user_row["username"]
        
        # Auto-promote if admin email
        if email == "praveen.gunja@adani.com" and role != "ADMIN":
            execute("UPDATE users SET role='ADMIN' WHERE id=%s", (user_id,))
            role = "ADMIN"

    # --- Create JWT ---
    access_token = create_access_token({
        "sub": email,
        "user_id": user_id,
        "username": username,
        "role": role,
        "scope": "all",
    })

    # --- Prepare frontend payload ---
    user_payload = {
        "id": user_id,
        "username": username,
        "email": email,
        "role": role,
        "scope": "all",
        "access_token": access_token,
    }
    
    import base64
    encoded = base64.urlsafe_b64encode(json.dumps(user_payload).encode()).decode()

    # FORCE the return path to include /execution-tracker/ explicitly
    # This prevents the user from being redirected to the root domain's /application
    target_base = os.environ.get("APP_BASE_URL", "https://digitalized-dpr.adani.com").rstrip('/')
    target_url = f"{target_base}/execution-tracker/application?sso_auth={encoded}"
    
    print(f"[SSO] Handshake complete for {email}. Redirecting to: {target_url}")
    
    return RedirectResponse(url=target_url, status_code=303)


@router.get("/metadata")
async def sso_metadata():
    """Metadata placeholder (OAuth2 doesn't use SAML metadata)."""
    return {"status": "SSO is using OAuth2/MSAL", "type": "Authorization Code Flow"}
