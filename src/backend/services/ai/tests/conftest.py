"""
Pytest Configuration and Fixtures

Provides comprehensive test configuration and fixtures for AI service testing,
including mock services, test data, and performance monitoring.

Version: 1.0.0
"""

# External imports with version specifications
import pytest  # version: 7.3.1
import pytest_asyncio  # version: 0.21.0
from httpx import AsyncClient  # version: 0.24.1
from unittest.mock import MagicMock, AsyncMock, patch  # built-in
import time
import logging
from typing import Dict, Any, AsyncGenerator

# Internal imports
from ..src.app import app
from ..src.services.openai_service import OpenAIService
from ..src.services.stable_diffusion_service import StableDiffusionService

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test data constants
TEST_STORY_RESPONSE = {
    "content": "Test story content",
    "metadata": {
        "tokens": 100,
        "processing_time": "1.5s",
        "model": "gpt-4",
        "version": "latest",
        "performance_metrics": {
            "token_processing_rate": "66.67 tokens/s",
            "total_latency": "1.5s",
            "api_overhead": "0.2s"
        }
    }
}

TEST_ILLUSTRATION_RESPONSE = {
    "image_data": bytes("test_image_data", "utf-8"),
    "metadata": {
        "model": "stable-diffusion-xl",
        "version": "latest",
        "resolution": "512x512",
        "performance_metrics": {
            "generation_time": "2.5s",
            "processing_overhead": "0.3s"
        }
    }
}

def pytest_configure(config):
    """
    Configure pytest with comprehensive test settings and custom markers.
    
    Args:
        config: pytest configuration object
    """
    # Register custom markers
    config.addinivalue_line(
        "markers",
        "story_generation: marks tests for story generation functionality"
    )
    config.addinivalue_line(
        "markers",
        "illustration_generation: marks tests for illustration generation"
    )
    config.addinivalue_line(
        "markers",
        "performance: marks tests that validate performance requirements"
    )
    
    # Configure test timeouts based on SLA requirements
    config.addinivalue_line(
        "timeout",
        "story_generation: 30 seconds"  # Per technical spec
    )
    config.addinivalue_line(
        "timeout",
        "illustration_generation: 45 seconds"  # Per technical spec
    )

@pytest.fixture
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Provides an async test client with performance monitoring.
    
    Yields:
        AsyncClient: Configured test client
    """
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Configure client timeout based on SLA
        client.timeout = 45.0  # Maximum SLA requirement
        
        # Add performance monitoring headers
        client.headers.update({
            "X-Test-ID": str(time.time()),
            "X-Performance-Monitor": "enabled"
        })
        
        yield client

@pytest.fixture
def mock_openai_service() -> MagicMock:
    """
    Provides a mocked OpenAI service with performance tracking.
    
    Returns:
        MagicMock: Configured mock service
    """
    mock_service = MagicMock(spec=OpenAIService)
    
    async def mock_generate_story(*args, **kwargs):
        # Simulate realistic processing time
        await asyncio.sleep(1.5)
        return TEST_STORY_RESPONSE
    
    # Configure mock methods with performance tracking
    mock_service.generate_story = AsyncMock(side_effect=mock_generate_story)
    mock_service.validate_response = MagicMock(return_value=TEST_STORY_RESPONSE["content"])
    
    return mock_service

@pytest.fixture
def mock_stable_diffusion_service() -> MagicMock:
    """
    Provides a mocked Stable Diffusion service with performance tracking.
    
    Returns:
        MagicMock: Configured mock service
    """
    mock_service = MagicMock(spec=StableDiffusionService)
    
    async def mock_generate_illustration(*args, **kwargs):
        # Simulate realistic processing time
        await asyncio.sleep(2.5)
        return TEST_ILLUSTRATION_RESPONSE["image_data"]
    
    # Configure mock methods with performance tracking
    mock_service.generate_illustration = AsyncMock(side_effect=mock_generate_illustration)
    mock_service.enhance_image = MagicMock(return_value=TEST_ILLUSTRATION_RESPONSE["image_data"])
    
    return mock_service

@pytest.fixture
def performance_monitor():
    """
    Provides performance monitoring utilities for tests.
    
    Returns:
        Dict: Performance monitoring tools and metrics
    """
    class PerformanceMonitor:
        def __init__(self):
            self.start_time = None
            self.metrics = {}
        
        def start(self):
            self.start_time = time.time()
            
        def stop(self) -> float:
            if not self.start_time:
                raise ValueError("Monitor not started")
            duration = time.time() - self.start_time
            self.metrics["duration"] = duration
            return duration
        
        def validate_sla(self, sla_limit: float) -> bool:
            return self.metrics.get("duration", float("inf")) <= sla_limit
    
    return PerformanceMonitor()

@pytest.fixture
def test_data():
    """
    Provides test data for AI service testing.
    
    Returns:
        Dict: Test data and expected results
    """
    return {
        "story_request": {
            "character_name": "Test Character",
            "age": 8,
            "theme": "Adventure",
            "interests": ["reading", "science"],
            "additional_notes": "Test story context"
        },
        "illustration_request": {
            "prompt": "A friendly dragon reading books",
            "style": "children's book",
            "size": (512, 512),
            "enhance_faces": True
        },
        "expected_responses": {
            "story": TEST_STORY_RESPONSE,
            "illustration": TEST_ILLUSTRATION_RESPONSE
        }
    }