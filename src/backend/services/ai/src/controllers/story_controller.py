"""
Story Generation Controller

FastAPI controller handling story generation endpoints with OpenAI GPT-4 integration,
providing comprehensive request validation, error handling, and performance monitoring.

Version: 1.0.0
"""

# External imports with version specifications
from fastapi import APIRouter, HTTPException, Depends  # version: 0.95.0
from fastapi.responses import JSONResponse
import logging
import time
from typing import Dict, Any, Optional
from functools import wraps
import uuid

# Internal imports
from ..models.story_request import StoryRequest
from ..services.openai_service import OpenAIService
from ..utils.error_handler import AIServiceError, handle_openai_error
from ..utils.validators import validate_string, ContentValidator
from ..config import get_openai_config

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix='/api/v1/stories', tags=['stories'])

# Initialize content validator
content_validator = ContentValidator()

def monitor_performance(func):
    """Decorator for monitoring endpoint performance."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            
            # Log performance metrics
            execution_time = time.time() - start_time
            logger.info("Story generation completed", extra={
                "request_id": request_id,
                "execution_time": execution_time,
                "endpoint": func.__name__
            })
            
            return result
        except Exception as e:
            # Log error metrics
            execution_time = time.time() - start_time
            logger.error("Story generation failed", extra={
                "request_id": request_id,
                "execution_time": execution_time,
                "endpoint": func.__name__,
                "error": str(e)
            })
            raise
            
    return wrapper

def validate_request(func):
    """Decorator for comprehensive request validation."""
    @wraps(func)
    async def wrapper(request: StoryRequest, *args, **kwargs):
        try:
            # Validate request using StoryRequest model
            request.validate()
            
            # Additional content safety validation
            safety_result = content_validator.validate_story_prompt(
                f"{request.character_name} {request.theme} {' '.join(request.interests)}"
            )
            if not safety_result.is_valid:
                raise AIServiceError(
                    message="Content safety check failed",
                    details=safety_result.details,
                    request_id=str(uuid.uuid4())
                )
            
            return await func(request, *args, **kwargs)
        except AIServiceError as e:
            logger.error("Request validation failed", extra={
                "error": str(e),
                "details": e.details
            })
            raise HTTPException(
                status_code=400,
                detail=e.to_dict()
            )
            
    return wrapper

class StoryController:
    """Controller handling story generation endpoints."""
    
    def __init__(self):
        """Initialize controller with dependencies."""
        self._openai_service = OpenAIService()
        self._config = get_openai_config()
        self._logger = logging.getLogger(__name__)

    async def format_response(self, story_content: Dict[str, Any]) -> Dict[str, Any]:
        """Format story generation response with metadata."""
        return {
            "status": "success",
            "data": {
                "story": story_content["content"],
                "metadata": {
                    "generation_time": story_content["metadata"]["generation_time"],
                    "tokens_used": story_content["metadata"]["tokens_used"],
                    "model": story_content["metadata"]["model"],
                    "theme": story_content["metadata"]["theme"],
                    "timestamp": time.time()
                },
                "performance": {
                    "response_time": story_content["metadata"]["generation_time"],
                    "within_sla": story_content["metadata"]["generation_time"] < 30
                }
            }
        }

@router.post('/generate')
@monitor_performance
@validate_request
@handle_openai_error
async def generate_story(request: StoryRequest) -> JSONResponse:
    """
    Generate a personalized children's story based on provided parameters.
    
    Args:
        request (StoryRequest): Validated story generation request
        
    Returns:
        JSONResponse: Generated story with comprehensive metadata
        
    Raises:
        HTTPException: If story generation fails or validation errors occur
    """
    controller = StoryController()
    request_id = str(uuid.uuid4())
    
    try:
        logger.info("Starting story generation", extra={
            "request_id": request_id,
            "theme": request.theme,
            "age": request.age
        })
        
        # Generate story content
        story_content = await controller._openai_service.generate_story(request)
        
        # Format response with metadata
        response = await controller.format_response(story_content)
        
        logger.info("Story generation successful", extra={
            "request_id": request_id,
            "generation_time": story_content["metadata"]["generation_time"],
            "tokens_used": story_content["metadata"]["tokens_used"]
        })
        
        return JSONResponse(
            content=response,
            status_code=200
        )
        
    except Exception as e:
        logger.error("Story generation failed", extra={
            "request_id": request_id,
            "error": str(e)
        })
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Story generation failed",
                "message": str(e),
                "request_id": request_id
            }
        )

@router.get('/{story_id}/status')
@monitor_performance
async def get_story_status(story_id: str) -> JSONResponse:
    """
    Get the status of a story generation request.
    
    Args:
        story_id (str): Unique story generation request ID
        
    Returns:
        JSONResponse: Story generation status with progress information
    """
    try:
        # Validate story_id format
        validate_string(story_id, min_length=36, max_length=36)
        
        # Mock status response for now
        # In production, this would check a cache or database
        return JSONResponse(
            content={
                "status": "completed",
                "progress": 100,
                "story_id": story_id,
                "timestamp": time.time()
            },
            status_code=200
        )
        
    except AIServiceError as e:
        raise HTTPException(
            status_code=400,
            detail=e.to_dict()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to retrieve story status",
                "message": str(e),
                "story_id": story_id
            }
        )