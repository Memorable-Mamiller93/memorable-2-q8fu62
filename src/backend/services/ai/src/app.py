"""
AI Service Main Application

FastAPI application entry point orchestrating story and illustration generation endpoints
with comprehensive error handling, monitoring, and performance optimization.

Version: 1.0.0
"""

# External imports with version specifications
from fastapi import FastAPI  # version: 0.95.0
from fastapi.middleware.cors import CORSMiddleware  # version: 0.95.0
from fastapi.responses import JSONResponse  # version: 0.95.0
import logging  # built-in
import uvicorn  # version: 0.21.1
from prometheus_client import Counter, Histogram, generate_latest  # version: 0.16.0
import structlog  # version: 23.1.0
import time
from typing import Dict, Any

# Internal imports
from .controllers.story_controller import router as story_router
from .controllers.illustration_controller import router as illustration_router
from .utils.error_handler import handle_openai_error, handle_stable_diffusion_error
from .config import AIServiceConfig

# Initialize FastAPI app with metadata
app = FastAPI(
    title='Memorable AI Service',
    version='1.0.0',
    docs_url='/api/docs',
    redoc_url='/api/redoc'
)

# Initialize structured logging
logger = structlog.get_logger(__name__)

# Initialize configuration
config = AIServiceConfig()

# Initialize metrics
REQUEST_COUNT = Counter('ai_service_requests_total', 'Total requests processed')
REQUEST_LATENCY = Histogram('ai_service_request_latency_seconds', 'Request latency')
ERROR_COUNT = Counter('ai_service_errors_total', 'Total errors encountered')

def configure_logging() -> None:
    """Configure structured logging with correlation IDs and performance tracking."""
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

def configure_middleware() -> None:
    """Configure comprehensive middleware stack for the application."""
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure based on environment
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request, call_next):
        request_id = request.headers.get("X-Request-ID", str(time.time()))
        with structlog.contextvars.bound_contextvars(request_id=request_id):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

    # Performance monitoring middleware
    @app.middleware("http")
    async def monitor_requests(request, call_next):
        REQUEST_COUNT.inc()
        start_time = time.time()
        try:
            response = await call_next(request)
            REQUEST_LATENCY.observe(time.time() - start_time)
            return response
        except Exception as e:
            ERROR_COUNT.inc()
            raise e

def configure_routes() -> None:
    """Configure API routes with versioning and documentation."""
    # Mount routers with version prefix
    app.include_router(
        story_router,
        prefix="/api/v1",
        tags=["stories"]
    )
    app.include_router(
        illustration_router,
        prefix="/api/v1",
        tags=["illustrations"]
    )

    # Add metrics endpoint
    @app.get("/metrics")
    async def metrics():
        return Response(
            content=generate_latest(),
            media_type="text/plain"
        )

@app.get("/health")
async def health_check() -> JSONResponse:
    """
    Comprehensive health check endpoint for the AI service.
    
    Returns:
        JSONResponse: Detailed service health status
    """
    try:
        # Check OpenAI service
        openai_status = await story_router.get_story_status("test")
        
        # Check Stable Diffusion service
        sd_status = await illustration_router.health_check()
        
        health_status = {
            "status": "healthy",
            "version": app.version,
            "services": {
                "openai": openai_status.get("status", "unknown"),
                "stable_diffusion": sd_status.get("status", "unknown")
            },
            "performance": {
                "request_count": REQUEST_COUNT._value.get(),
                "error_rate": (ERROR_COUNT._value.get() / REQUEST_COUNT._value.get()) 
                if REQUEST_COUNT._value.get() > 0 else 0,
                "average_latency": REQUEST_LATENCY._sum.get() / REQUEST_LATENCY._count.get()
                if REQUEST_LATENCY._count.get() > 0 else 0
            }
        }
        
        return JSONResponse(
            content=health_status,
            status_code=200
        )
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e)
            },
            status_code=503
        )

def start_application() -> None:
    """Initialize and configure the FastAPI application."""
    configure_logging()
    configure_middleware()
    configure_routes()
    logger.info("AI Service initialized successfully", version=app.version)

# Initialize application on import
start_application()

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=config.get_config().get("debug", False)
    )