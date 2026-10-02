# Voxify
AI Powered Multilingual Content Processing Platform

Languages: English, Gujarati, Hindi, Marathi, Tamil

## Structure
- `backend/`  - Python + FastAPI (REST API, Firebase Admin, AI services)
- `frontend/` - HTML + CSS + JavaScript (multi-page app)
- `docs/`     - API and database documentation

## Run the backend (Windows)
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```
Mac / Linux: activate with `source venv/bin/activate` and copy with `cp .env.example .env`.

- API docs:    http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/v1/health

## Run the tests
```
pip install -r requirements-dev.txt
pytest
```
