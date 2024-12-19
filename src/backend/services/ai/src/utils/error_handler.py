# External imports with version specifications
from fastapi import HTTPException  # version: 0.95.0
import openai  # version: 1.3.0
from stability_sdk import exceptions as stability_exceptions  # version: 0.8.0
import logging
import time
import uuid
from functools import wraps
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
MAX_RETRIES = 3
RETRY_DELAY = 1.5

# Standardized error messages
ERROR_MESSAGES = {
    'RATE_LIMIT': 'API rate limit exceeded. Please try again later.',
    'INVALID_REQUEST': 'Invalid request parameters provided.',
    'API_ERROR': 'External API error occurred.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'CONTENT_FILTER': 'Content violates safety guidelines.',
    'RETRY_FAILED': 'Maximum retry attempts exceeded.',
    'PERFORMANCE_DEGRADED': 'Service performance degraded.',
    'RESOURCE_EXHAUSTED': 'AI resource quota exhausted.'
}

def retry(max_attempts: int = MAX_RETRIES, delay: float = RETRY_DELAY):
    """
    Retry decorator with exponential backoff for handling transient errors.
    
    Args:
        max_attempts (int): Maximum number of retry attempts
        delay (float): Base delay between retries in seconds
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if not _is_retryable_error(e):
                        raise
                    wait_time = delay * (2 ** attempt)
                    logger.warning(f"Retry attempt {attempt + 1}/{max_attempts} after {wait_time}s delay")
                    time.sleep(wait_time)
            raise AIServiceError(
                message=ERROR_MESSAGES['RETRY_FAILED'],
                details={'original_error': str(last_exception)},
                request_id=str(uuid.uuid4())
            )
        return wrapper
    return decorator

class AIServiceError(Exception):
    """Enhanced custom exception class for AI service errors with telemetry."""
    
    def __init__(self, message: str, details: Dict[str, Any], request_id: str):
        """
        Initialize AI service error with tracking capabilities.
        
        Args:
            message (str): Error message
            details (dict): Additional error context
            request_id (str): Unique request identifier
        """
        super().__init__(message)
        self.message = message
        self.details = details
        self.request_id = request_id
        self.timestamp = time.time()
        self.performance_metrics = {
            'timestamp': self.timestamp,
            'latency': details.get('latency', 0),
            'retry_count': details.get('retry_count', 0)
        }
        logger.error(f"AIServiceError: {message}", extra={
            'request_id': request_id,
            'details': details,
            'metrics': self.performance_metrics
        })

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to detailed dictionary format with telemetry."""
        return {
            'error': {
                'message': self.message,
                'type': self.__class__.__name__,
                'request_id': self.request_id,
                'timestamp': self.timestamp,
                'details': self.details,
                'performance_metrics': self.performance_metrics
            }
        }

def _is_retryable_error(error: Exception) -> bool:
    """
    Determine if an error is retryable based on its type and context.
    
    Args:
        error (Exception): The error to evaluate
    
    Returns:
        bool: True if error is retryable, False otherwise
    """
    retryable_errors = (
        openai.error.RateLimitError,
        openai.error.ServiceUnavailableError,
        openai.error.APIConnectionError,
        stability_exceptions.RateLimitError,
        stability_exceptions.ServerError
    )
    return isinstance(error, retryable_errors)

@retry()
def handle_openai_error(error: Exception, context: Dict[str, Any]) -> HTTPException:
    """
    Handle OpenAI API specific errors with retry mechanism and performance monitoring.
    
    Args:
        error (Exception): The OpenAI API error
        context (dict): Additional context about the request
    
    Returns:
        HTTPException: Standardized HTTP exception with detailed error information
    """
    request_id = str(uuid.uuid4())
    start_time = context.get('start_time', time.time())
    latency = time.time() - start_time

    error_mapping = {
        openai.error.RateLimitError: (429, ERROR_MESSAGES['RATE_LIMIT']),
        openai.error.InvalidRequestError: (400, ERROR_MESSAGES['INVALID_REQUEST']),
        openai.error.APIError: (500, ERROR_MESSAGES['API_ERROR']),
        openai.error.Timeout: (504, ERROR_MESSAGES['TIMEOUT']),
        openai.error.ContentFilterError: (422, ERROR_MESSAGES['CONTENT_FILTER'])
    }

    status_code, message = error_mapping.get(
        type(error),
        (500, ERROR_MESSAGES['API_ERROR'])
    )

    error_details = format_error_response(
        message=message,
        details={
            'original_error': str(error),
            'latency': latency,
            'model': context.get('model', 'unknown'),
            'tokens': context.get('tokens', 0)
        },
        request_id=request_id
    )

    logger.error(f"OpenAI API Error: {message}", extra={
        'request_id': request_id,
        'error_details': error_details,
        'status_code': status_code
    })

    return HTTPException(
        status_code=status_code,
        detail=error_details
    )

@retry()
def handle_stable_diffusion_error(error: Exception, context: Dict[str, Any]) -> HTTPException:
    """
    Handle Stable Diffusion API errors with performance tracking and retry logic.
    
    Args:
        error (Exception): The Stable Diffusion API error
        context (dict): Additional context about the request
    
    Returns:
        HTTPException: Standardized HTTP exception with performance metrics
    """
    request_id = str(uuid.uuid4())
    start_time = context.get('start_time', time.time())
    latency = time.time() - start_time

    error_mapping = {
        stability_exceptions.RateLimitError: (429, ERROR_MESSAGES['RATE_LIMIT']),
        stability_exceptions.InvalidRequestError: (400, ERROR_MESSAGES['INVALID_REQUEST']),
        stability_exceptions.ServerError: (500, ERROR_MESSAGES['API_ERROR']),
        stability_exceptions.ResourceExhaustedError: (429, ERROR_MESSAGES['RESOURCE_EXHAUSTED'])
    }

    status_code, message = error_mapping.get(
        type(error),
        (500, ERROR_MESSAGES['API_ERROR'])
    )

    error_details = format_error_response(
        message=message,
        details={
            'original_error': str(error),
            'latency': latency,
            'image_size': context.get('image_size', '512x512'),
            'engine': context.get('engine', 'unknown')
        },
        request_id=request_id
    )

    logger.error(f"Stable Diffusion API Error: {message}", extra={
        'request_id': request_id,
        'error_details': error_details,
        'status_code': status_code
    })

    return HTTPException(
        status_code=status_code,
        detail=error_details
    )

def format_error_response(message: str, details: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    """
    Format error details into a comprehensive response structure with telemetry.
    
    Args:
        message (str): Error message
        details (dict): Additional error details
        request_id (str): Unique request identifier
    
    Returns:
        dict: Detailed error response with telemetry data
    """
    return {
        'error': {
            'message': message,
            'request_id': request_id,
            'timestamp': time.time(),
            'details': details,
            'performance_metrics': {
                'latency': details.get('latency', 0),
                'retry_count': details.get('retry_count', 0)
            }
        }
    }