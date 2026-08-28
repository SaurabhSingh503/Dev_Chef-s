
# Dev_Chef-s

# MANAK

## Overview
MANAK is a full-stack intelligence and certification platform managing standards, testing guidelines, and documentation. It integrates a responsive web interface, a robust REST API, and an AI-powered RAG (Retrieval-Augmented Generation) backend to search and query technical PDFs efficiently.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Vanilla CSS
- **Backend**: Node.js, Express.js, TypeScript, REST API, JWT Authentication, Zod Validation, PDFKit
- **Database**: PostgreSQL, Supabase (Authentication & Data), pgvector
- **AI/RAG**: Python 3.13, FastAPI, Uvicorn, sentence-transformers (`all-MiniLM-L6-v2`), PyTorch, pypdf, SQLAlchemy/asyncpg

## Project Structure
- `frontend/`: React application (Vite). Runs on port `5173`.
- `backend/`: Node.js Express API. Runs on port `4000`.
- `rag/`: Python FastAPI service for vector search and LLM ingestion. Runs on port `8001`.
- `database/`: Database configuration and Supabase migrations.
- `scripts/`: Project setup scripts.
- `Datasets/`: Extracted static dataset files (PDFs).

## Prerequisites
To run this project, you need:
- Git
- Node.js & npm (v20+)
- Python 3.13
- PostgreSQL / Supabase local setup

## Installation

1. Clone the repository:
   ```bash
   git clone YOUR_GITHUB_REPOSITORY_URL
   cd MANAK
   ```

2. Setup Frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Setup Backend dependencies:
   ```bash
   cd ../backend
   npm install
   ```

4. Setup RAG Environment:
   ```bash
   cd ../rag
   python3.13 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Environment Configuration
The project uses `.env` files for configuration. **Never commit actual secrets (API keys, passwords, JWT secrets) to the repository.**

1. Copy the example environments:
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   cp rag/.env.example rag/.env
   ```
2. Edit the `.env` files to include your local Supabase database URLs, JWT secret, and API keys. The `RAG_SERVICE_URL` in the backend should point to `http://localhost:8001`.

## Dataset Setup
The platform requires the MANAK PDF datasets to serve handbook generation and UI rendering.

1. Obtain the `Datasets-manak.zip` archive.
2. Run the dataset setup script from the project root:
   ```bash
   ./scripts/setup_datasets.sh /path/to/Datasets-manak.zip
   ```
This will extract the datasets into the `Datasets/` directory which the backend will serve.

## Running the Application
Open three separate terminal windows to run the services.

1. **RAG Service** (Port 8001)
   ```bash
   cd rag
   source .venv/bin/activate
   uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

2. **Backend API** (Port 4000)
   ```bash
   cd backend
   npm run build
   npm start
   ```

3. **Frontend UI** (Port 5173)
   ```bash
   cd frontend
   npm run dev
   ```

## Verification
You can verify the health of the application by running:
- **Frontend/Backend Linters**: `npm run lint && npm run build` (inside both directories)
- **RAG Healthcheck**: `curl http://localhost:8001/health` (Should return `{"status":"ok"}`)

