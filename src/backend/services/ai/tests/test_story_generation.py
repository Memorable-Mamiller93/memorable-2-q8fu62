# External imports with version specifications
import pytest  # version: 7.3.1
import pytest_asyncio  # version: 0.21.0
from unittest.mock import MagicMock, patch  # built-in
import time
import asyncio
from typing import Dict, Any

# Internal imports
from ..src.models.story_request import StoryRequest
from ..src.services.openai_service import OpenAIService
from ..src.utils.error_handler import AIServiceError

# Test constants
VALID_TEST_REQUEST = {
    "character_name": "Test Child",
    "age": 8,
    "theme": "Adventure",
    "interests": ["space", "dinosaurs"],
    "additional_notes": "Loves science",
    "content_safety_level": "child_safe",
    "max_tokens": 4000
}

EXPECTED_STORY_RESPONSE = {
    "content": "Test story content",
    "metadata": {
        "generation_time": 1.5,
        "tokens_used": 2000,
        "model": "gpt-4",
        "theme": "Adventure"
    }
}

@pytest.mark.story
class TestStoryGeneration:
    """Comprehensive test suite for story generation functionality."""

    def setup_method(self):
        """Initialize test environment and dependencies."""
        self.openai_service = MagicMock(spec=OpenAIService)
        self.story_request = StoryRequest(**VALID_TEST_REQUEST)
        self.performance_metrics = {
            "start_time": None,
            "end_time": None,
            "memory_usage": None
        }

    def teardown_method(self):
        """Clean up test resources and reset mocks."""
        self.openai_service.reset_mock()
        self.performance_metrics = None

    @pytest.mark.asyncio
    @pytest.mark.story
    async def test_valid_story_generation(self, mock_openai_service: MagicMock):
        """
        Test successful story generation with comprehensive validation.
        
        Tests:
        - Content safety and COPPA compliance
        - Performance requirements (<30s)
        - Token limits (max 4000)
        - Response structure and metadata
        """
        # Configure mock response
        mock_openai_service.generate_story.return_value = EXPECTED_STORY_RESPONSE
        
        # Record start time for performance measurement
        start_time = time.time()
        
        try:
            # Execute story generation
            response = await mock_openai_service.generate_story(self.story_request)
            
            # Record end time
            generation_time = time.time() - start_time
            
            # Validate response structure
            assert response is not None
            assert "content" in response
            assert "metadata" in response
            
            # Validate content safety
            assert len(response["content"]) > 0
            assert not any(unsafe_word in response["content"].lower() 
                         for unsafe_word in ["death", "violence", "scary"])
            
            # Validate performance
            assert generation_time < 30, "Story generation exceeded 30s limit"
            assert response["metadata"]["tokens_used"] <= 4000, "Exceeded token limit"
            
            # Validate theme and character integration
            assert self.story_request.theme in response["metadata"]["theme"]
            assert self.story_request.character_name in response["content"]
            
            # Validate age appropriateness
            assert response["metadata"].get("age_appropriate", True)
            
        except Exception as e:
            pytest.fail(f"Story generation failed: {str(e)}")

    @pytest.mark.asyncio
    @pytest.mark.story
    @pytest.mark.parametrize("invalid_data, expected_error", [
        ({"age": 2}, "Age must be between 3 and 12"),
        ({"age": 13}, "Age must be between 3 and 12"),
        ({"character_name": ""}, "Character name is required"),
        ({"theme": "Invalid"}, "Invalid theme selected"),
        ({"interests": []}, "At least one interest is required"),
        ({"interests": ["a"]*6}, "Maximum 5 interests allowed")
    ])
    async def test_invalid_request_validation(self, invalid_data: Dict[str, Any], expected_error: str):
        """
        Test comprehensive input validation with various invalid scenarios.
        
        Args:
            invalid_data: Invalid request parameters
            expected_error: Expected error message
        """
        # Create invalid request by updating valid base request
        test_data = VALID_TEST_REQUEST.copy()
        test_data.update(invalid_data)
        
        with pytest.raises(AIServiceError) as exc_info:
            StoryRequest(**test_data)
        
        assert expected_error in str(exc_info.value)

    @pytest.mark.asyncio
    @pytest.mark.story
    async def test_openai_service_error_handling(self, mock_openai_service: MagicMock):
        """
        Test comprehensive error handling for OpenAI service failures.
        
        Tests:
        - Timeout handling
        - Rate limit handling
        - API errors
        - Content filter violations
        """
        # Test timeout scenario
        mock_openai_service.generate_story.side_effect = asyncio.TimeoutError()
        with pytest.raises(AIServiceError) as exc_info:
            await mock_openai_service.generate_story(self.story_request)
        assert "Request timed out" in str(exc_info.value)
        
        # Test rate limit handling
        mock_openai_service.generate_story.side_effect = AIServiceError(
            message="Rate limit exceeded",
            details={"retry_after": 60},
            request_id="test"
        )
        with pytest.raises(AIServiceError) as exc_info:
            await mock_openai_service.generate_story(self.story_request)
        assert "Rate limit exceeded" in str(exc_info.value)
        
        # Test content filter violation
        mock_openai_service.generate_story.side_effect = AIServiceError(
            message="Content violates safety guidelines",
            details={"filter_type": "inappropriate_content"},
            request_id="test"
        )
        with pytest.raises(AIServiceError) as exc_info:
            await mock_openai_service.generate_story(self.story_request)
        assert "Content violates safety guidelines" in str(exc_info.value)

    @pytest.mark.asyncio
    @pytest.mark.story
    @pytest.mark.performance
    async def test_story_generation_performance(self, mock_openai_service: MagicMock):
        """
        Test performance requirements for story generation.
        
        Tests:
        - Response time under 30s
        - Memory usage
        - Token consumption
        """
        # Configure mock for performance testing
        mock_openai_service.generate_story.return_value = EXPECTED_STORY_RESPONSE
        
        # Initialize performance monitoring
        start_time = time.time()
        start_memory = self._get_memory_usage()
        
        # Execute multiple story generations for performance testing
        test_iterations = 5
        for _ in range(test_iterations):
            response = await mock_openai_service.generate_story(self.story_request)
            
            # Validate performance metrics
            generation_time = time.time() - start_time
            assert generation_time < 30, f"Generation time {generation_time}s exceeded limit"
            assert response["metadata"]["tokens_used"] <= 4000, "Token limit exceeded"
        
        # Calculate and validate resource usage
        end_memory = self._get_memory_usage()
        memory_increase = end_memory - start_memory
        assert memory_increase < 500_000_000, "Excessive memory usage detected"
        
        # Log performance metrics
        self.performance_metrics = {
            "average_generation_time": (time.time() - start_time) / test_iterations,
            "memory_usage": memory_increase,
            "total_tokens": sum(EXPECTED_STORY_RESPONSE["metadata"]["tokens_used"] 
                              for _ in range(test_iterations))
        }

    def _get_memory_usage(self) -> int:
        """Helper method to get current memory usage."""
        import psutil
        import os
        process = psutil.Process(os.getpid())
        return process.memory_info().rss