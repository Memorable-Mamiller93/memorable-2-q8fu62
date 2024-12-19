# External imports with version specifications
from dataclasses import dataclass  # built-in
from typing import List, Optional  # built-in
import re  # built-in
import unicodedata

# Internal imports
from ..utils.error_handler import AIServiceError

# Global constants for validation
SUPPORTED_THEMES = [
    'Magical', 'Adventure', 'Educational', 'Fantasy',
    'Nature', 'Science', 'Space', 'Ocean',
    'Friendship', 'Family'
]

MAX_CHARACTER_NAME_LENGTH = 50
MIN_AGE = 3  # COPPA compliance
MAX_AGE = 12
MAX_INTERESTS = 5
MAX_ADDITIONAL_NOTES_LENGTH = 500

# Unicode-aware patterns for validation
NAME_PATTERN = re.compile(r'^[\p{L}\s-]{1,50}$', re.UNICODE)
INTEREST_PATTERN = re.compile(r'^[\p{L}\s-]{1,30}$', re.UNICODE)

@dataclass
class StoryRequest:
    """
    Data model for story generation requests with comprehensive validation.
    
    Attributes:
        character_name (str): Main character's name (1-50 Unicode characters)
        age (int): Character's age (3-12 years, COPPA compliant)
        theme (str): Story theme from supported themes list
        interests (List[str]): Character's interests (max 5)
        additional_notes (Optional[str]): Optional story context (max 500 chars)
    """
    character_name: str
    age: int
    theme: str
    interests: List[str]
    additional_notes: Optional[str] = None

    def __post_init__(self):
        """
        Post-initialization validation and sanitization of all fields.
        
        Raises:
            AIServiceError: If any validation fails with detailed error messages
        """
        # Sanitize string inputs
        self.character_name = self.sanitize_input(self.character_name)
        self.theme = self.sanitize_input(self.theme)
        self.interests = [self.sanitize_input(interest) for interest in self.interests]
        if self.additional_notes:
            self.additional_notes = self.sanitize_input(self.additional_notes)
        
        # Validate all fields
        self.validate()

    @staticmethod
    def sanitize_input(input_string: str) -> str:
        """
        Sanitize and normalize input strings.
        
        Args:
            input_string (str): Raw input string
            
        Returns:
            str: Sanitized and normalized string
        """
        if not isinstance(input_string, str):
            return str(input_string)
        
        # Normalize Unicode characters
        normalized = unicodedata.normalize('NFKC', input_string)
        # Remove control characters
        sanitized = ''.join(char for char in normalized if unicodedata.category(char)[0] != 'C')
        # Strip whitespace and normalize spaces
        return ' '.join(sanitized.split())

    def validate_character_name(self) -> bool:
        """
        Validate character name with Unicode support.
        
        Raises:
            AIServiceError: If name validation fails
        """
        if not self.character_name:
            raise AIServiceError(
                message="Character name is required",
                details={"field": "character_name"},
                request_id="validate_name"
            )
        
        if not NAME_PATTERN.match(self.character_name):
            raise AIServiceError(
                message="Character name must contain only letters, spaces, and hyphens",
                details={"field": "character_name", "value": self.character_name},
                request_id="validate_name"
            )
        
        if len(self.character_name) > MAX_CHARACTER_NAME_LENGTH:
            raise AIServiceError(
                message=f"Character name must not exceed {MAX_CHARACTER_NAME_LENGTH} characters",
                details={"field": "character_name", "length": len(self.character_name)},
                request_id="validate_name"
            )
        
        return True

    def validate_age(self) -> bool:
        """
        Validate age for COPPA compliance.
        
        Raises:
            AIServiceError: If age validation fails
        """
        if not isinstance(self.age, int):
            raise AIServiceError(
                message="Age must be a number",
                details={"field": "age", "type": type(self.age).__name__},
                request_id="validate_age"
            )
        
        if not MIN_AGE <= self.age <= MAX_AGE:
            raise AIServiceError(
                message=f"Age must be between {MIN_AGE} and {MAX_AGE} years",
                details={"field": "age", "value": self.age},
                request_id="validate_age"
            )
        
        return True

    def validate_theme(self) -> bool:
        """
        Validate theme against supported themes list.
        
        Raises:
            AIServiceError: If theme validation fails
        """
        if not self.theme:
            raise AIServiceError(
                message="Theme is required",
                details={"field": "theme"},
                request_id="validate_theme"
            )
        
        if self.theme not in SUPPORTED_THEMES:
            raise AIServiceError(
                message="Invalid theme selected",
                details={
                    "field": "theme",
                    "value": self.theme,
                    "supported_themes": SUPPORTED_THEMES
                },
                request_id="validate_theme"
            )
        
        return True

    def validate_interests(self) -> bool:
        """
        Validate interests list with comprehensive checks.
        
        Raises:
            AIServiceError: If interests validation fails
        """
        if not isinstance(self.interests, list):
            raise AIServiceError(
                message="Interests must be a list",
                details={"field": "interests", "type": type(self.interests).__name__},
                request_id="validate_interests"
            )
        
        if not self.interests:
            raise AIServiceError(
                message="At least one interest is required",
                details={"field": "interests"},
                request_id="validate_interests"
            )
        
        if len(self.interests) > MAX_INTERESTS:
            raise AIServiceError(
                message=f"Maximum {MAX_INTERESTS} interests allowed",
                details={"field": "interests", "count": len(self.interests)},
                request_id="validate_interests"
            )
        
        # Validate each interest
        for interest in self.interests:
            if not INTEREST_PATTERN.match(interest):
                raise AIServiceError(
                    message="Interest must contain only letters, spaces, and hyphens",
                    details={"field": "interests", "invalid_value": interest},
                    request_id="validate_interests"
                )
        
        # Remove duplicates while preserving order
        self.interests = list(dict.fromkeys(self.interests))
        return True

    def validate_additional_notes(self) -> bool:
        """
        Validate optional additional notes.
        
        Raises:
            AIServiceError: If additional notes validation fails
        """
        if self.additional_notes is None:
            return True
        
        if len(self.additional_notes) > MAX_ADDITIONAL_NOTES_LENGTH:
            raise AIServiceError(
                message=f"Additional notes must not exceed {MAX_ADDITIONAL_NOTES_LENGTH} characters",
                details={
                    "field": "additional_notes",
                    "length": len(self.additional_notes)
                },
                request_id="validate_notes"
            )
        
        return True

    def validate(self) -> bool:
        """
        Validate all request fields with comprehensive error collection.
        
        Returns:
            bool: True if all validations pass
            
        Raises:
            AIServiceError: If any validation fails
        """
        self.validate_character_name()
        self.validate_age()
        self.validate_theme()
        self.validate_interests()
        self.validate_additional_notes()
        return True

    def to_dict(self) -> dict:
        """
        Convert request to API-compatible dictionary format.
        
        Returns:
            dict: Dictionary representation of the request
        """
        request_dict = {
            "character_name": self.character_name,
            "age": self.age,
            "theme": self.theme,
            "interests": self.interests
        }
        
        if self.additional_notes:
            request_dict["additional_notes"] = self.additional_notes
            
        return request_dict