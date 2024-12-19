# External imports with version specifications
from pydantic import BaseModel, Field, validator  # version: 1.10.0
from typing import Tuple, List, Optional
import re

# Internal imports
from ..utils.error_handler import AIServiceError

# Constants for validation and configuration
SUPPORTED_STYLES: List[str] = [
    "children's book",
    "watercolor", 
    "digital art",
    "cartoon",
    "realistic"
]

MAX_PROMPT_LENGTH: int = 1000
MIN_PROMPT_LENGTH: int = 10
DEFAULT_SIZE: Tuple[int, int] = (512, 512)
MIN_IMAGE_DIMENSION: int = 256
MAX_IMAGE_DIMENSION: int = 1024
UNSAFE_PATTERN: str = r'[<>&;{}\[\]\\]'

def validate_string_length(value: str, min_length: int, max_length: int) -> str:
    """
    Validates string length with enhanced security checks.
    
    Args:
        value (str): Input string to validate
        min_length (int): Minimum allowed length
        max_length (int): Maximum allowed length
        
    Returns:
        str: Validated and sanitized string
        
    Raises:
        AIServiceError: If validation fails
    """
    if not value or not isinstance(value, str):
        raise AIServiceError(
            message="Invalid string input",
            details={"value": str(value)},
            request_id="validation_error"
        )
    
    value = value.strip()
    if not min_length <= len(value) <= max_length:
        raise AIServiceError(
            message=f"String length must be between {min_length} and {max_length} characters",
            details={"value_length": len(value)},
            request_id="validation_error"
        )
    
    return sanitize_string(value)

def sanitize_string(value: str) -> str:
    """
    Sanitizes input string by removing unsafe characters and potential XSS vectors.
    
    Args:
        value (str): Input string to sanitize
        
    Returns:
        str: Sanitized string
    """
    # Remove unsafe characters
    sanitized = re.sub(UNSAFE_PATTERN, '', value)
    # Replace multiple spaces with single space
    sanitized = ' '.join(sanitized.split())
    # HTML encode special characters
    sanitized = (
        sanitized.replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&#x27;')
    )
    return sanitized.strip()

def validate_image_dimensions(dimensions: Tuple[int, int]) -> Tuple[int, int]:
    """
    Validates image dimensions with aspect ratio constraints.
    
    Args:
        dimensions (Tuple[int, int]): Width and height tuple
        
    Returns:
        Tuple[int, int]: Validated dimensions
        
    Raises:
        AIServiceError: If dimensions are invalid
    """
    if not dimensions or not isinstance(dimensions, tuple) or len(dimensions) != 2:
        raise AIServiceError(
            message="Invalid image dimensions format",
            details={"dimensions": str(dimensions)},
            request_id="validation_error"
        )
    
    width, height = dimensions
    
    # Validate dimension bounds
    if not (MIN_IMAGE_DIMENSION <= width <= MAX_IMAGE_DIMENSION and 
            MIN_IMAGE_DIMENSION <= height <= MAX_IMAGE_DIMENSION):
        raise AIServiceError(
            message=f"Image dimensions must be between {MIN_IMAGE_DIMENSION} and {MAX_IMAGE_DIMENSION} pixels",
            details={"width": width, "height": height},
            request_id="validation_error"
        )
    
    # Validate aspect ratio (max 2:1 in either direction)
    aspect_ratio = width / height
    if not 0.5 <= aspect_ratio <= 2.0:
        raise AIServiceError(
            message="Image aspect ratio must be between 1:2 and 2:1",
            details={"aspect_ratio": aspect_ratio},
            request_id="validation_error"
        )
    
    return (width, height)

class IllustrationRequest(BaseModel):
    """
    Pydantic model for illustration generation requests with comprehensive validation.
    
    Attributes:
        prompt (str): Text description for image generation
        style (str): Illustration style from supported options
        size (Tuple[int, int]): Image dimensions (width, height)
        enhance_faces (bool): Flag for face enhancement processing
    """
    prompt: str = Field(
        ...,
        description="Text description for image generation",
        min_length=MIN_PROMPT_LENGTH,
        max_length=MAX_PROMPT_LENGTH
    )
    
    style: str = Field(
        ...,
        description="Illustration style selection"
    )
    
    size: Tuple[int, int] = Field(
        default=DEFAULT_SIZE,
        description="Image dimensions (width, height)"
    )
    
    enhance_faces: bool = Field(
        default=True,
        description="Enable face enhancement processing"
    )

    @validator('prompt')
    def validate_prompt(cls, value: str) -> str:
        """
        Validates and sanitizes the prompt text with content safety checks.
        
        Args:
            value (str): Input prompt text
            
        Returns:
            str: Validated and sanitized prompt
        """
        # Validate length and sanitize
        value = validate_string_length(value, MIN_PROMPT_LENGTH, MAX_PROMPT_LENGTH)
        
        # Additional content safety checks could be added here
        return value

    @validator('style')
    def validate_style(cls, value: str) -> str:
        """
        Validates the illustration style with case-insensitive matching.
        
        Args:
            value (str): Input style selection
            
        Returns:
            str: Validated style
        """
        if not value or value.lower() not in [s.lower() for s in SUPPORTED_STYLES]:
            raise AIServiceError(
                message="Invalid illustration style",
                details={
                    "provided_style": value,
                    "supported_styles": SUPPORTED_STYLES
                },
                request_id="validation_error"
            )
        
        # Return the correctly cased version
        return next(s for s in SUPPORTED_STYLES if s.lower() == value.lower())

    @validator('size')
    def validate_size(cls, value: Tuple[int, int]) -> Tuple[int, int]:
        """
        Validates image dimensions with SDXL-specific constraints.
        
        Args:
            value (Tuple[int, int]): Input dimensions
            
        Returns:
            Tuple[int, int]: Validated dimensions
        """
        # Validate basic dimensions
        dimensions = validate_image_dimensions(value)
        
        # Ensure dimensions are multiples of 8 for SDXL
        width, height = dimensions
        if width % 8 != 0 or height % 8 != 0:
            raise AIServiceError(
                message="Image dimensions must be multiples of 8",
                details={"width": width, "height": height},
                request_id="validation_error"
            )
        
        return dimensions