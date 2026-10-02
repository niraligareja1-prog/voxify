from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.supabase_client import supabase, supabase_admin

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


@router.post("/register")
def register_user(data: RegisterRequest):
    try:
        # Use the backend admin client for registration so development/testing
        # does not depend on Supabase's email-send rate limit.
        response = supabase_admin.auth.admin.create_user({
            "email": data.email,
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": data.full_name
            },
        })

        user = getattr(response, "user", None)

        if user is None:
            raise HTTPException(
                status_code=400,
                detail="Registration failed. Please try again.",
            )

        return {
            "message": "Registration successful. You can log in now.",
            "user_id": user.id,
            "email": user.email,
        }

    except HTTPException:
        raise

    except Exception as e:
        error_message = str(e)
        lowered = error_message.lower()

        if (
            "already been registered" in lowered
            or "already exists" in lowered
            or "user already registered" in lowered
        ):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please log in.",
            )

        if "email" in lowered and "invalid" in lowered:
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid email address.",
            )

        print("REGISTER ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Registration failed. Please try again.",
        )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login_user(data: LoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        if response.user is None or response.session is None:
            raise HTTPException(
                status_code=401,
                detail="Login failed"
            )

        return {
            "message": "Login successful",
            "user_id": response.user.id,
            "email": response.user.email,
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }

    except HTTPException:
        raise

    except Exception as e:
        error_message = str(e).lower()

        if "email not confirmed" in error_message:
            raise HTTPException(
                status_code=401,
                detail="Please verify your email before logging in."
            )

        if "invalid login credentials" in error_message:
            try:
                users_response = supabase_admin.auth.admin.list_users()

                user_exists = any(
                    user.email and user.email.lower() == data.email.lower()
                    for user in users_response
                )

                if user_exists:
                    raise HTTPException(
                        status_code=401,
                        detail="Incorrect password. Please try again."
                    )
                else:
                    raise HTTPException(
                        status_code=401,
                        detail="Account not found. Please register first."
                    )

            except HTTPException:
                raise

            except Exception as admin_error:
                print("ADMIN CHECK ERROR:", repr(admin_error))
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password"
                )

        print("LOGIN ERROR:", repr(e))

        raise HTTPException(
            status_code=401,
            detail="Login failed. Please try again."
        )
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    try:
        supabase.auth.reset_password_for_email(data.email)

        return {
            "message": "Password reset email sent successfully."
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
@router.post("/logout")
def logout_user():
    try:
        supabase.auth.sign_out()

        return {
            "message": "Logout successful"
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )