# External imports with version specifications
from fastapi import FastAPI, HTTPException, Response, Depends  # version: 0.95.0
from fastapi.responses import JSONResponse, StreamingResponse  # version: 0.95.0
from fastapi import APIRouter  # version: 0.95.0
import logging
import uuid
import time
from typing import Dict, Any

# Internal imports
from ..models.illustration_request import IllustrationRequest
from ..services.stable_diffusion_service import StableDiffusionService
from ..utils.error_handler import handle_stable_diffusion_error, AIServiceError
from ..config import get_stable_diffusion_config, STABLE_DIFFUSION_CONFIG

# Initialize router with prefix and tags
router = APIRouter(prefix='/api/v1/illustrations', tags=['illustrations'])

# Configure logging
logger = logging.getLogger(__name__)

# Initialize services
stable_diffusion_service = StableDiffusionService(get_stable_diffusion_config())

# Constants
CACHE_CONTROL = {'public': True, 'max-age': 3600}
CONTENT_TYPE = 'image/png'
PERFORMANCE_THRESHOLD = 45.0  # seconds, per technical spec

@router.post('/generate')
@handle_stable_diffusion_error
async def generate_illustration(request: IllustrationRequest) -> Response:
    """
    Generate a book illustration using Stable Diffusion XL with performance monitoring.
    
    Args:
        request (IllustrationRequest): Validated illustration request
        
    Returns:
        Response: Generated image with appropriate headers
        
    Raises:
        HTTPException: On generation failure or timeout
    """
    correlation_id = str(uuid.uuid4())
    start_time = time.time()
    
    logger.info(f"Processing illustration request", extra={
        'correlation_id': correlation_id,
        'prompt_length': len(request.prompt),
        'style': request.style,
        'size': request.size
    })
    
    try:
        # Generate illustration
        image_data = await stable_diffusion_service.generate_illustration(request)
        
        # Calculate and log performance metrics
        generation_time = time.time() - start_time
        logger.info(f"Illustration generated successfully", extra={
            'correlation_id': correlation_id,
            'generation_time': generation_time,
            'image_size': len(image_data)
        })
        
        # Check performance threshold
        if generation_time > PERFORMANCE_THRESHOLD:
            logger.warning(f"Generation time exceeded threshold", extra={
                'correlation_id': correlation_id,
                'generation_time': generation_time,
                'threshold': PERFORMANCE_THRESHOLD
            })
        
        # Prepare response headers
        headers = {
            'Cache-Control': f"public, max-age={CACHE_CONTROL['max-age']}",
            'X-Correlation-ID': correlation_id,
            'X-Generation-Time': f"{generation_time:.2f}s"
        }
        
        return Response(
            content=image_data,
            media_type=CONTENT_TYPE,
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Illustration generation failed", extra={
            'correlation_id': correlation_id,
            'error': str(e),
            'elapsed_time': time.time() - start_time
        })
        raise handle_stable_diffusion_error(e, {
            'correlation_id': correlation_id,
            'start_time': start_time
        })

@router.get('/styles')
@handle_stable_diffusion_error
async def get_supported_styles() -> JSONResponse:
    """
    Retrieve supported illustration styles with detailed information.
    
    Returns:
        JSONResponse: List of supported styles with examples and parameters
    """
    try:
        styles_info = {
            "children's book": {
                "description": "Whimsical and engaging illustrations suitable for children",
                "parameters": {
                    "base_resolution": STABLE_DIFFUSION_CONFIG['base_resolution'],
                    "guidance_scale": STABLE_DIFFUSION_CONFIG['guidance_scale']
                },
                "example_prompt": "A friendly dragon reading books to forest animals"
            },
            "watercolor": {
                "description": "Soft, artistic watercolor painting style",
                "parameters": {
                    "base_resolution": STABLE_DIFFUSION_CONFIG['base_resolution'],
                    "guidance_scale": STABLE_DIFFUSION_CONFIG['guidance_scale']
                },
                "example_prompt": "A serene forest scene with gentle watercolor effects"
            },
            "digital art": {
                "description": "Modern digital art with clean lines and vibrant colors",
                "parameters": {
                    "base_resolution": STABLE_DIFFUSION_CONFIG['base_resolution'],
                    "guidance_scale": STABLE_DIFFUSION_CONFIG['guidance_scale']
                },
                "example_prompt": "A futuristic cityscape with neon accents"
            },
            "cartoon": {
                "description": "Bold, expressive cartoon style illustrations",
                "parameters": {
                    "base_resolution": STABLE_DIFFUSION_CONFIG['base_resolution'],
                    "guidance_scale": STABLE_DIFFUSION_CONFIG['guidance_scale']
                },
                "example_prompt": "A playful cartoon character jumping with joy"
            },
            "realistic": {
                "description": "Photorealistic style with natural details",
                "parameters": {
                    "base_resolution": STABLE_DIFFUSION_CONFIG['base_resolution'],
                    "guidance_scale": STABLE_DIFFUSION_CONFIG['guidance_scale']
                },
                "example_prompt": "A detailed portrait with natural lighting"
            }
        }
        
        headers = {
            'Cache-Control': f"public, max-age={CACHE_CONTROL['max-age']}",
            'X-Version': STABLE_DIFFUSION_CONFIG['model']
        }
        
        return JSONResponse(
            content={'styles': styles_info},
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Failed to retrieve styles: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve illustration styles"
        )

@router.get('/health')
@handle_stable_diffusion_error
async def health_check() -> JSONResponse:
    """
    Check illustration service health with detailed metrics.
    
    Returns:
        JSONResponse: Service health status and performance metrics
    """
    try:
        # Get service status and metrics
        service_status = await stable_diffusion_service.get_service_status()
        
        health_info = {
            'status': 'healthy' if service_status['available'] else 'degraded',
            'model': STABLE_DIFFUSION_CONFIG['model'],
            'version': STABLE_DIFFUSION_CONFIG.get('version', '1.0.0'),
            'metrics': {
                'average_response_time': service_status.get('avg_response_time', 0),
                'requests_per_minute': service_status.get('requests_per_minute', 0),
                'error_rate': service_status.get('error_rate', 0)
            },
            'limits': {
                'max_resolution': f"{STABLE_DIFFUSION_CONFIG['base_resolution'][0]}x{STABLE_DIFFUSION_CONFIG['base_resolution'][1]}",
                'timeout': STABLE_DIFFUSION_CONFIG['timeout']
            }
        }
        
        return JSONResponse(
            content=health_info,
            headers={'Cache-Control': 'no-cache'}
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Service health check failed"
        )

# Export router for FastAPI application
__all__ = ['router']