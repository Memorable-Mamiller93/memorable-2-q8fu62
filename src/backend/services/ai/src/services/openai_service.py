"""
OpenAI Service Module

Implements OpenAI GPT-4 integration for story generation with comprehensive content safety,
COPPA compliance, performance monitoring, and robust error handling.

Version: 1.0.0
"""

# External imports with version specifications
import openai  # version: 1.3.0
import asyncio  # built-in
from typing import Dict, Any, Optional, List
import logging
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0
import time

# Internal imports
from ..config import get_openai_config
from ..utils.error_handler import handle_openai_error
from ..utils.validators import validate_string
from ..models.story_request import StoryRequest

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
STORY_PROMPT_TEMPLATE = """
Create an engaging, educational, and age-appropriate children's story with the following specifications:

Main Character: {character_name}
Age: {age} years old
Theme: {theme}
Interests: {interests}
Additional Context: {notes}

Requirements:
- Story must be safe and appropriate for children aged {age}
- Include educational elements about: {educational_focus}
- Maintain a positive and encouraging tone
- Use age-appropriate vocabulary and concepts
- Length: {max_length} words
- Reading level: Suitable for {age}-year-olds

Focus on creating a story that:
1. Engages and entertains while educating
2. Promotes positive values and learning
3. Incorporates the character's interests naturally
4. Maintains COPPA compliance and content safety
"""

MAX_RETRIES = 3
TIMEOUT_SECONDS = 25  # Below 30s requirement
MAX_TOKENS = 4000

class OpenAIService:
    """
    Service class for handling OpenAI GPT-4 API interactions with content safety,
    performance monitoring, and error handling.
    """

    def __init__(self):
        """Initialize OpenAI service with configuration and dependencies."""
        self._config = get_openai_config()
        self._client = openai.Client(
            api_key=self._config['api_key'],
            timeout=TIMEOUT_SECONDS
        )
        logger.info("OpenAI service initialized with configuration", extra={
            "timeout": TIMEOUT_SECONDS,
            "model": self._config['model']
        })

    @handle_openai_error
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_story(self, request: StoryRequest) -> Dict[str, str]:
        """
        Generates a child-safe story based on provided request parameters.
        
        Args:
            request (StoryRequest): Validated story generation request
            
        Returns:
            Dict[str, str]: Generated story content with metadata
            
        Raises:
            AIServiceError: If story generation fails or content safety checks fail
        """
        start_time = time.time()
        
        try:
            # Validate request
            request.validate()
            
            # Format prompt with enhanced parameters
            prompt = self.format_prompt(request)
            
            # Call OpenAI API with monitoring
            response = await self._client.chat.completions.create(
                model=self._config['model'],
                messages=[
                    {"role": "system", "content": "You are a children's story writer creating safe, educational content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=MAX_TOKENS,
                temperature=0.7,
                presence_penalty=0.0,
                frequency_penalty=0.0
            )
            
            # Validate and process response
            story_content = self.validate_response(response)
            
            # Log performance metrics
            generation_time = time.time() - start_time
            logger.info("Story generation completed", extra={
                "generation_time": generation_time,
                "tokens_used": response.usage.total_tokens,
                "theme": request.theme,
                "age": request.age
            })
            
            return {
                "content": story_content,
                "metadata": {
                    "generation_time": generation_time,
                    "tokens_used": response.usage.total_tokens,
                    "model": self._config['model'],
                    "theme": request.theme
                }
            }
            
        except Exception as e:
            logger.error("Story generation failed", extra={
                "error": str(e),
                "generation_time": time.time() - start_time,
                "theme": request.theme,
                "age": request.age
            })
            raise

    def format_prompt(self, request: StoryRequest) -> str:
        """
        Formats the story generation prompt with enhanced parameters.
        
        Args:
            request (StoryRequest): Validated story request
            
        Returns:
            str: Formatted prompt string
        """
        # Calculate age-appropriate parameters
        max_length = min(300 + (request.age * 50), 1000)  # Scale length with age
        educational_focus = self._get_educational_focus(request.age, request.theme)
        
        return STORY_PROMPT_TEMPLATE.format(
            character_name=request.character_name,
            age=request.age,
            theme=request.theme,
            interests=", ".join(request.interests),
            notes=request.additional_notes or "None provided",
            educational_focus=", ".join(educational_focus),
            max_length=max_length
        )

    def validate_response(self, response: Dict[str, Any]) -> str:
        """
        Validates OpenAI API response for quality and safety.
        
        Args:
            response (Dict[str, Any]): API response
            
        Returns:
            str: Validated story content
            
        Raises:
            AIServiceError: If response validation fails
        """
        if not response.choices or not response.choices[0].message.content:
            raise ValueError("Invalid response structure from OpenAI API")
        
        content = response.choices[0].message.content.strip()
        
        # Validate content length
        if len(content.split()) < 100:
            raise ValueError("Generated content too short")
        
        # Basic content safety check
        unsafe_words = ["death", "violence", "scary", "blood", "weapon"]
        if any(word in content.lower() for word in unsafe_words):
            raise ValueError("Generated content contains unsafe elements")
        
        return content

    def _get_educational_focus(self, age: int, theme: str) -> List[str]:
        """
        Determines age-appropriate educational focus areas.
        
        Args:
            age (int): Target age
            theme (str): Story theme
            
        Returns:
            List[str]: Educational focus areas
        """
        base_focus = ["vocabulary", "reading comprehension"]
        
        if age <= 5:
            return base_focus + ["basic concepts", "colors", "shapes"]
        elif age <= 8:
            return base_focus + ["problem solving", "social skills", "basic science"]
        else:
            return base_focus + ["critical thinking", "advanced concepts", "STEM topics"]