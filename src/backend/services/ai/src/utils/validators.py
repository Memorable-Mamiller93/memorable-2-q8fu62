"""
AI Service Validation Module

Provides comprehensive validation and sanitization for AI service requests,
ensuring content safety, performance requirements, and technical compliance.

Version: 1.0.0
"""

import re
from typing import Dict, Any, List, Tuple, Optional, Pattern
from functools import wraps
import time
from dataclasses import dataclass
import unicodedata

from .error_handler import AIServiceError
from ..config import OPENAI_CONFIG, STABLE_DIFFUSION_CONFIG

# Content Safety Constants
NSFW_KEYWORDS: List[str] = [
    # Redacted for brevity - implement comprehensive NSFW keyword list
]

UNSAFE_PATTERNS: List[str] = [
    r'(?i)(violence|weapon|drug)',
    r'(?i)(explicit|mature|adult)',
    # Additional patterns for content safety
]

AGE_INAPPROPRIATE_CONTENT: List[str] = [
    r'(?i)(fear|horror|scary)',
    r'(?i)(complex|advanced|difficult)',
    # Age-specific inappropriate content patterns
]

# Validation Constants
MAX_PROMPT_LENGTH: int = OPENAI_CONFIG['max_tokens']
MIN_PROMPT_LENGTH: int = 10
NAME_PATTERN: Pattern = re.compile(r'^[a-zA-Z0-9\s-]{1,50}$')
AGE_RANGE: Tuple[int, int] = (3, 12)
VALIDATION_TIMEOUT: int = 5000  # milliseconds

def timeout(ms: int):
    """Decorator to enforce validation timeout limits."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            if (time.time() - start_time) * 1000 > ms:
                raise AIServiceError(
                    message="Validation timeout exceeded",
                    details={"timeout": ms},
                    request_id=str(time.time())
                )
            return result
        return wrapper
    return decorator

@dataclass
class ValidationResult:
    """Structured validation result with detailed feedback."""
    is_valid: bool
    message: str
    details: Optional[Dict[str, Any]] = None

class ContentValidator:
    """Enhanced content validation with comprehensive safety checks."""
    
    def __init__(self):
        """Initialize validation patterns and content filters."""
        self._unsafe_patterns = [re.compile(pattern) for pattern in UNSAFE_PATTERNS]
        self._age_patterns = [re.compile(pattern) for pattern in AGE_INAPPROPRIATE_CONTENT]
        self._name_pattern = NAME_PATTERN
    
    def _normalize_text(self, text: str) -> str:
        """Normalize unicode characters and remove control characters."""
        return unicodedata.normalize('NFKC', text)
    
    def _check_content_safety(self, text: str) -> ValidationResult:
        """Comprehensive content safety validation."""
        normalized_text = self._normalize_text(text.lower())
        
        # Check NSFW keywords
        for keyword in NSFW_KEYWORDS:
            if keyword in normalized_text:
                return ValidationResult(
                    is_valid=False,
                    message="Content contains inappropriate keywords",
                    details={"keyword": keyword}
                )
        
        # Check unsafe patterns
        for pattern in self._unsafe_patterns:
            if pattern.search(normalized_text):
                return ValidationResult(
                    is_valid=False,
                    message="Content contains unsafe patterns",
                    details={"pattern": pattern.pattern}
                )
        
        # Check age-inappropriate content
        for pattern in self._age_patterns:
            if pattern.search(normalized_text):
                return ValidationResult(
                    is_valid=False,
                    message="Content not suitable for target age group",
                    details={"pattern": pattern.pattern}
                )
        
        return ValidationResult(is_valid=True, message="Content passed safety checks")

    def validate_story_prompt(self, prompt: str) -> ValidationResult:
        """Validate story generation prompt."""
        if not isinstance(prompt, str):
            return ValidationResult(
                is_valid=False,
                message="Invalid prompt type",
                details={"expected": "string", "received": type(prompt).__name__}
            )
        
        prompt = prompt.strip()
        
        # Length validation
        if len(prompt) < MIN_PROMPT_LENGTH:
            return ValidationResult(
                is_valid=False,
                message="Prompt too short",
                details={"min_length": MIN_PROMPT_LENGTH}
            )
        
        if len(prompt) > MAX_PROMPT_LENGTH:
            return ValidationResult(
                is_valid=False,
                message="Prompt exceeds maximum length",
                details={"max_length": MAX_PROMPT_LENGTH}
            )
        
        # Content safety validation
        safety_result = self._check_content_safety(prompt)
        if not safety_result.is_valid:
            return safety_result
        
        return ValidationResult(is_valid=True, message="Prompt validation successful")

@timeout(VALIDATION_TIMEOUT)
def validate_string(value: str, min_length: int = 1, max_length: int = MAX_PROMPT_LENGTH,
                   allow_special_chars: bool = False) -> str:
    """Validate and sanitize string input."""
    if not isinstance(value, str):
        raise AIServiceError(
            message="Invalid input type",
            details={"expected": "string", "received": type(value).__name__},
            request_id=str(time.time())
        )
    
    value = value.strip()
    normalized_value = unicodedata.normalize('NFKC', value)
    
    if len(normalized_value) < min_length or len(normalized_value) > max_length:
        raise AIServiceError(
            message="Invalid string length",
            details={"min": min_length, "max": max_length, "received": len(normalized_value)},
            request_id=str(time.time())
        )
    
    if not allow_special_chars:
        if not NAME_PATTERN.match(normalized_value):
            raise AIServiceError(
                message="String contains invalid characters",
                details={"pattern": NAME_PATTERN.pattern},
                request_id=str(time.time())
            )
    
    return normalized_value

@timeout(VALIDATION_TIMEOUT)
def validate_age(age: int) -> int:
    """Validate age input for story generation."""
    if not isinstance(age, int):
        raise AIServiceError(
            message="Invalid age type",
            details={"expected": "integer", "received": type(age).__name__},
            request_id=str(time.time())
        )
    
    min_age, max_age = AGE_RANGE
    if age < min_age or age > max_age:
        raise AIServiceError(
            message="Age out of acceptable range",
            details={"min": min_age, "max": max_age, "received": age},
            request_id=str(time.time())
        )
    
    return age

@timeout(VALIDATION_TIMEOUT)
def validate_image_dimensions(dimensions: Tuple[int, int]) -> Tuple[int, int]:
    """Validate image dimensions for Stable Diffusion."""
    if not isinstance(dimensions, tuple) or len(dimensions) != 2:
        raise AIServiceError(
            message="Invalid dimensions format",
            details={"expected": "tuple(int, int)", "received": str(dimensions)},
            request_id=str(time.time())
        )
    
    width, height = dimensions
    base_width, base_height = STABLE_DIFFUSION_CONFIG['base_resolution']
    
    if width % base_width != 0 or height % base_height != 0:
        raise AIServiceError(
            message="Dimensions must be multiples of base resolution",
            details={"base_width": base_width, "base_height": base_height},
            request_id=str(time.time())
        )
    
    max_dimension = 2048  # Maximum supported dimension
    if width > max_dimension or height > max_dimension:
        raise AIServiceError(
            message="Dimensions exceed maximum supported size",
            details={"max_dimension": max_dimension},
            request_id=str(time.time())
        )
    
    return (width, height)

# Export validation utilities
__all__ = [
    'validate_string',
    'validate_age',
    'validate_image_dimensions',
    'ContentValidator',
    'ValidationResult'
]