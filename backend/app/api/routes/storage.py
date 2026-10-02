import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth_dependency import get_current_user_id
from app.supabase_client import supabase_admin


router = APIRouter(prefix="/storage", tags=["Storage"])


BUCKET_NAME = "voxify-files"
MAX_FILE_SIZE = 50 * 1024 * 1024


def get_storage_folder(mime_type: str) -> str:
    mime_type = (mime_type or "").lower()

    if mime_type.startswith("audio/"):
        return "audio"

    if mime_type.startswith("image/"):
        return "images"

    if mime_type == "application/pdf":
        return "pdf"

    if mime_type.startswith("video/"):
        return "video"

    if mime_type.startswith("text/"):
        return "text"

    return "files"


def get_file_extension(filename: str | None) -> str:
    if not filename:
        return ""

    suffix = Path(filename).suffix.lower()

    if len(suffix) > 20:
        return ""

    return suffix


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    try:
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="File name is required.",
            )

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File size exceeds the 50 MB limit.",
            )

        mime_type = file.content_type or "application/octet-stream"
        folder = get_storage_folder(mime_type)
        extension = get_file_extension(file.filename)

        unique_name = f"{uuid.uuid4()}{extension}"

        storage_path = f"{folder}/{user_id}/{unique_name}"

        upload_options = {
            "content-type": mime_type,
            "upsert": "false",
        }

        storage_response = (
            supabase_admin
            .storage
            .from_(BUCKET_NAME)
            .upload(
                storage_path,
                content,
                file_options=upload_options,
            )
        )

        if storage_response is None:
            raise HTTPException(
                status_code=500,
                detail="File upload failed.",
            )

        metadata = {
            "user_id": user_id,
            "original_file_name": file.filename,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "file_size": len(content),
        }

        db_response = (
            supabase_admin
            .table("file_uploads")
            .insert(metadata)
            .execute()
        )

        if db_response is None or not db_response.data:
            # Try to clean up the uploaded object if DB insert fails.
            try:
                supabase_admin.storage.from_(BUCKET_NAME).remove(
                    [storage_path]
                )
            except Exception:
                pass

            raise HTTPException(
                status_code=500,
                detail="File metadata could not be saved.",
            )

        return {
            "success": True,
            "message": "File uploaded successfully.",
            "data": {
                "id": db_response.data[0]["id"],
                "file_name": file.filename,
                "storage_path": storage_path,
                "mime_type": mime_type,
                "file_size": len(content),
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("STORAGE UPLOAD ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to upload file.",
        )


@router.get("/download/{file_id}")
def get_download_url(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        response = (
            supabase_admin
            .table("file_uploads")
            .select("*")
            .eq("id", file_id)
            .eq("user_id", user_id)
            .execute()
        )

        data = response.data if response is not None else None

        if not data:
            raise HTTPException(
                status_code=404,
                detail="File not found.",
            )

        file_record = data[0]
        storage_path = file_record["storage_path"]

        signed_response = (
            supabase_admin
            .storage
            .from_(BUCKET_NAME)
            .create_signed_url(
                storage_path,
                3600,
            )
        )

        if not signed_response:
            raise HTTPException(
                status_code=500,
                detail="Could not create download URL.",
            )

        signed_url = None

        if isinstance(signed_response, dict):
            signed_url = (
                signed_response.get("signedURL")
                or signed_response.get("signedUrl")
                or signed_response.get("signed_url")
            )

        if not signed_url:
            raise HTTPException(
                status_code=500,
                detail="Could not create download URL.",
            )

        return {
            "success": True,
            "data": {
                "id": file_record["id"],
                "file_name": file_record["original_file_name"],
                "storage_path": storage_path,
                "download_url": signed_url,
                "expires_in": 3600,
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("STORAGE DOWNLOAD ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to create download URL.",
        )