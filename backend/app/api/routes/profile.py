from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth_dependency import get_current_user_id
from app.supabase_client import supabase_admin


router = APIRouter(prefix="/profile", tags=["Profile"])


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    avatar_url: Optional[str] = Field(default=None, max_length=1000)
    preferred_language: Optional[str] = Field(default=None, max_length=20)


@router.get("")
def get_profile(user_id: str = Depends(get_current_user_id)):
    try:
        response = (
            supabase_admin
            .table("profiles")
            .select("*")
            .eq("id", user_id)
            .execute()
        )

        data = response.data if response is not None else None

        if data:
            return {
                "success": True,
                "data": data[0],
            }

        # Profile does not exist yet.
        # Get the authenticated user's information from Supabase Auth.
        user_response = supabase_admin.auth.admin.get_user_by_id(user_id)

        user = user_response.user if user_response else None

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )

        user_metadata = user.user_metadata or {}

        record = {
            "id": user_id,
            "full_name": user_metadata.get("full_name"),
            "email": user.email,
            "preferred_language": "en-IN",
        }

        created = (
            supabase_admin
            .table("profiles")
            .insert(record)
            .execute()
        )

        created_data = created.data if created is not None else None

        if created_data:
            return {
                "success": True,
                "data": created_data[0],
            }

        # If the insert response is unavailable, return the record
        # that was prepared for the profile.
        return {
            "success": True,
            "data": record,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("PROFILE GET ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch profile.",
        )


@router.patch("")
def update_profile(
    data: ProfileUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        updates = data.model_dump(exclude_unset=True)

        if not updates:
            raise HTTPException(
                status_code=400,
                detail="No profile changes supplied.",
            )

        response = (
            supabase_admin
            .table("profiles")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )

        response_data = response.data if response is not None else None

        if not response_data:
            raise HTTPException(
                status_code=404,
                detail="Profile not found.",
            )

        # Keep full_name synchronized with Supabase Auth metadata.
        if "full_name" in updates:
            supabase_admin.auth.admin.update_user_by_id(
                user_id,
                {
                    "user_metadata": {
                        "full_name": updates["full_name"],
                    }
                },
            )

        return {
            "success": True,
            "message": "Profile updated successfully.",
            "data": response_data[0],
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("PROFILE UPDATE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update profile.",
        )