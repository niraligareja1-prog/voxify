from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth_dependency import get_current_user_id
from app.supabase_client import supabase_admin


router = APIRouter(prefix="/history", tags=["History"])


class HistoryCreateRequest(BaseModel):
    content_type: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    original_text: Optional[str] = None
    translated_text: Optional[str] = None


@router.post("")
def create_history(
    data: HistoryCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        record = {
            "user_id": user_id,
            "content_type": data.content_type,
            "source_language": data.source_language,
            "target_language": data.target_language,
            "original_text": data.original_text,
            "translated_text": data.translated_text,
        }

        record = {
            key: value
            for key, value in record.items()
            if value is not None
        }

        response = (
            supabase_admin
            .table("translation_history")
            .insert(record)
            .execute()
        )

        if response is None or not response.data:
            raise HTTPException(
                status_code=500,
                detail="History record was not created.",
            )

        return {
            "success": True,
            "message": "History created successfully.",
            "data": response.data[0],
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("HISTORY CREATE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to save history.",
        )


@router.get("")
def get_history(
    user_id: str = Depends(get_current_user_id),
):
    try:
        response = (
            supabase_admin
            .table("translation_history")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        data = response.data if response is not None else []

        return {
            "success": True,
            "data": data,
        }

    except Exception as exc:
        print("HISTORY GET ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch history.",
        )


@router.delete("/{history_id}")
def delete_history(
    history_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        response = (
            supabase_admin
            .table("translation_history")
            .delete()
            .eq("id", history_id)
            .eq("user_id", user_id)
            .execute()
        )

        if response is None or not response.data:
            raise HTTPException(
                status_code=404,
                detail="History record not found.",
            )

        return {
            "success": True,
            "message": "History deleted successfully.",
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("HISTORY DELETE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to delete history.",
        )