import os

import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is required.",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Bearer authentication is required.",
        )

    access_token = credentials.credentials.strip()

    # Handle accidental formats such as:
    # "Bearer eyJ..."
    # "Bearer Bearer eyJ..."
    access_token = access_token.strip('"').strip("'").strip()

    while access_token.lower().startswith("bearer "):
        access_token = access_token[7:].strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Access token is missing.",
        )

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration is missing.",
        )

    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10,
        )

        if response.status_code != 200:
            print(
                "SUPABASE AUTH ERROR:",
                response.status_code,
                response.text[:500],
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired access token.",
            )

        user = response.json()
        user_id = user.get("id")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid user information.",
            )

        return str(user_id)

    except HTTPException:
        raise

    except requests.RequestException as exc:
        print("SUPABASE REQUEST ERROR:", repr(exc))
        raise HTTPException(
            status_code=503,
            detail="Unable to verify authentication with Supabase.",
        )

    except Exception as exc:
        print("AUTH VALIDATION ERROR:", repr(exc))
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token.",
        )