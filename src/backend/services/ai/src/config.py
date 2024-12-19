"""
AI Services Configuration Module

This module provides comprehensive configuration management for AI services including
OpenAI GPT-4 and Stable Diffusion XL settings. It ensures type safety, environment-specific
configurations, and adherence to performance requirements.

Version: 1.0.0
"""

import os
from typing import Dict, Any, Optional, Union, Literal
from dotenv import load_dotenv  # version: 1.0.0

# Load environment variables
load_dotenv()

# Global Configuration Settings
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
STABLE_DIFFUSION_API_KEY = os.getenv('STABLE_DIFFUSION_API_KEY', '')
ENVIRONMENT: Literal['development', 'staging', 'production'] = os.getenv('ENVIRONMENT', 'development')
CONFIG_VERSION = '1.0.0'

# OpenAI Configuration Constants
OPENAI_CONFIG: Dict[str, Any] = {
    'model': 'gpt-4',
    'max_tokens': 4000,
    'temperature': 0.7,
    'timeout': 30,  # 30 second timeout per technical spec
    'retry_attempts': 3,
    'retry_delay': 1.0,
    'streaming': False,
    'presence_penalty': 0.0,
    'frequency_penalty': 0.0
}

# Stable Diffusion Configuration Constants
STABLE_DIFFUSION_CONFIG: Dict[str, Any] = {
    'model': 'stable-diffusion-xl-1.0',
    'base_resolution': [512, 512],  # Base resolution per technical spec
    'guidance_scale': 7.5,
    'num_inference_steps': 50,
    'timeout': 45,  # 45 second timeout per technical spec
    'retry_attempts': 3,
    'retry_delay': 1.0,
    'safety_checker': True,
    'optimization_level': 'memory'
}

# Environment-specific Configuration
ENVIRONMENT_CONFIG: Dict[str, Dict[str, Any]] = {
    'development': {
        'debug': True,
        'log_level': 'DEBUG',
        'performance_monitoring': True,
        'request_timeout': 60
    },
    'staging': {
        'debug': False,
        'log_level': 'INFO',
        'performance_monitoring': True,
        'request_timeout': 45
    },
    'production': {
        'debug': False,
        'log_level': 'WARNING',
        'performance_monitoring': True,
        'request_timeout': 30
    }
}

class ConfigurationError(Exception):
    """Custom exception for configuration-related errors."""
    pass

def validate_config(func):
    """
    Decorator to validate configuration before returning.
    Ensures all required parameters are present and valid.
    """
    def wrapper(*args, **kwargs):
        if not validate_environment():
            raise ConfigurationError("Invalid environment configuration")
        config = func(*args, **kwargs)
        if not config:
            raise ConfigurationError(f"Invalid configuration returned from {func.__name__}")
        return config
    return wrapper

def validate_environment() -> bool:
    """
    Validates the environment configuration and required API keys.
    
    Returns:
        bool: True if environment is valid, raises ConfigurationError otherwise
    """
    # Validate API Keys
    if not OPENAI_API_KEY:
        raise ConfigurationError("OpenAI API key is not configured")
    if not STABLE_DIFFUSION_API_KEY:
        raise ConfigurationError("Stable Diffusion API key is not configured")
    
    # Validate Environment
    if ENVIRONMENT not in ENVIRONMENT_CONFIG:
        raise ConfigurationError(f"Invalid environment: {ENVIRONMENT}")
    
    # Validate Configuration Version
    if not CONFIG_VERSION:
        raise ConfigurationError("Configuration version is not set")
    
    # Validate Performance Parameters
    if OPENAI_CONFIG['timeout'] > 30:
        raise ConfigurationError("OpenAI timeout exceeds maximum allowed (30s)")
    if STABLE_DIFFUSION_CONFIG['timeout'] > 45:
        raise ConfigurationError("Stable Diffusion timeout exceeds maximum allowed (45s)")
    
    return True

@validate_config
def get_openai_config(env: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves environment-specific OpenAI configuration settings.
    
    Args:
        env: Optional environment override
    
    Returns:
        Dict[str, Any]: Validated OpenAI configuration dictionary
    """
    environment = env or ENVIRONMENT
    env_config = ENVIRONMENT_CONFIG[environment]
    
    config = OPENAI_CONFIG.copy()
    config.update({
        'api_key': OPENAI_API_KEY,
        'debug': env_config['debug'],
        'log_level': env_config['log_level'],
        'request_timeout': env_config['request_timeout'],
        'performance_monitoring': env_config['performance_monitoring']
    })
    
    return config

@validate_config
def get_stable_diffusion_config(env: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves environment-specific Stable Diffusion configuration.
    
    Args:
        env: Optional environment override
    
    Returns:
        Dict[str, Any]: Validated Stable Diffusion configuration dictionary
    """
    environment = env or ENVIRONMENT
    env_config = ENVIRONMENT_CONFIG[environment]
    
    config = STABLE_DIFFUSION_CONFIG.copy()
    config.update({
        'api_key': STABLE_DIFFUSION_API_KEY,
        'debug': env_config['debug'],
        'log_level': env_config['log_level'],
        'request_timeout': env_config['request_timeout'],
        'performance_monitoring': env_config['performance_monitoring']
    })
    
    return config

# Export configuration functions for service use
__all__ = [
    'get_openai_config',
    'get_stable_diffusion_config',
    'validate_environment',
    'ConfigurationError'
]