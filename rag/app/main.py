from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.routes import documents, health, ingest, search

app = FastAPI(title="MANAK RAG", version="0.1.0", docs_url="/docs" )
app.include_router(health.router); app.include_router(ingest.router); app.include_router(search.router); app.include_router(documents.router)

@app.exception_handler(Exception)
async def unexpected_error(_request: Request, _error: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail":{"code":"INTERNAL_ERROR", "message":"An unexpected RAG service error occurred"}})
