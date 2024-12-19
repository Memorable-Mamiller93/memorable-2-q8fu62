# External imports with version specifications
import pytest  # version: 7.3.1
import pytest_asyncio  # version: 0.21.0
from httpx import AsyncClient  # version: 0.24.1
from unittest.mock import MagicMock, AsyncMock, patch  # built-in
import time
import asyncio
from PIL import Image
import io

# Internal imports
from ..src.models.illustration_request import IllustrationRequest
from ..src.services.stable_diffusion_service import StableDiffusionService
from ..src.utils.error_handler import AIServiceError

# Test data constants
TEST_ILLUSTRATION_REQUESTS = {
    'valid_request': {
        'prompt': 'A happy child playing in a garden',
        'style': "children's book",
        'size': [512, 512],
        'enhance_faces': True,
        'quality_preferences': {
            'min_resolution': [512, 512],
            'color_depth': 24,
            'format': 'PNG'
        }
    },
    'invalid_prompt': {
        'prompt': '',
        'style': "children's book",
        'size': [512, 512],
        'enhance_faces': True
    },
    'invalid_style': {
        'prompt': 'A happy child playing',
        'style': 'invalid_style',
        'size': [512, 512],
        'enhance_faces': True
    },
    'invalid_size': {
        'prompt': 'A happy child playing',
        'style': "children's book",
        'size': [100, 100],
        'enhance_faces': True
    }
}

@pytest.fixture
def mock_stable_diffusion_service():
    """Fixture for mocked Stable Diffusion service with timing simulation."""
    service = AsyncMock(spec=StableDiffusionService)
    
    # Create a mock image for testing
    img = Image.new('RGB', (512, 512), color='white')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    async def mock_generate(*args, **kwargs):
        await asyncio.sleep(0.5)  # Simulate API latency
        return img_bytes
    
    service.generate_illustration.side_effect = mock_generate
    return service

@pytest.mark.asyncio
@pytest.mark.illustration
async def test_valid_illustration_generation(client: AsyncClient, mock_stable_diffusion_service):
    """Tests successful illustration generation with valid parameters and quality metrics."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['valid_request']
    
    with patch('src.services.stable_diffusion_service.StableDiffusionService', 
               return_value=mock_stable_diffusion_service):
        # Act
        start_time = time.time()
        response = await client.post("/api/v1/illustrations/generate", json=request_data)
        generation_time = time.time() - start_time
        
        # Assert
        assert response.status_code == 200
        assert response.headers['content-type'] == 'image/png'
        assert len(response.content) > 0
        
        # Verify performance requirements
        assert generation_time < 45, "Generation time exceeded 45s limit"
        
        # Verify service call
        mock_stable_diffusion_service.generate_illustration.assert_called_once()
        call_args = mock_stable_diffusion_service.generate_illustration.call_args[0][0]
        assert isinstance(call_args, IllustrationRequest)
        assert call_args.prompt == request_data['prompt']
        assert call_args.style == request_data['style']
        assert call_args.size == tuple(request_data['size'])

@pytest.mark.asyncio
@pytest.mark.illustration
async def test_invalid_prompt(client: AsyncClient):
    """Tests error handling for invalid prompt with detailed validation."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['invalid_prompt']
    
    # Act
    response = await client.post("/api/v1/illustrations/generate", json=request_data)
    
    # Assert
    assert response.status_code == 400
    error_data = response.json()
    assert 'error' in error_data
    assert 'message' in error_data['error']
    assert 'prompt' in error_data['error']['message'].lower()
    assert 'request_id' in error_data['error']

@pytest.mark.asyncio
@pytest.mark.illustration
async def test_invalid_style(client: AsyncClient):
    """Tests error handling for invalid illustration style."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['invalid_style']
    
    # Act
    response = await client.post("/api/v1/illustrations/generate", json=request_data)
    
    # Assert
    assert response.status_code == 400
    error_data = response.json()
    assert 'error' in error_data
    assert 'supported_styles' in error_data['error']['details']

@pytest.mark.asyncio
@pytest.mark.illustration
@pytest.mark.performance
async def test_performance_requirements(client: AsyncClient, mock_stable_diffusion_service):
    """Tests illustration generation performance requirements with detailed metrics."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['valid_request']
    performance_metrics = []
    
    with patch('src.services.stable_diffusion_service.StableDiffusionService', 
               return_value=mock_stable_diffusion_service):
        # Act
        for _ in range(3):  # Test multiple generations for consistency
            start_time = time.perf_counter()
            response = await client.post("/api/v1/illustrations/generate", json=request_data)
            generation_time = time.perf_counter() - start_time
            performance_metrics.append(generation_time)
            
            # Assert individual request
            assert response.status_code == 200
            assert generation_time < 45, f"Generation time {generation_time}s exceeded 45s limit"
            
            # Add cooldown between requests
            await asyncio.sleep(1)
        
        # Assert overall performance
        avg_generation_time = sum(performance_metrics) / len(performance_metrics)
        assert avg_generation_time < 30, f"Average generation time {avg_generation_time}s exceeded target"
        
        # Verify consistent performance
        time_variance = max(performance_metrics) - min(performance_metrics)
        assert time_variance < 10, f"High performance variance detected: {time_variance}s"

@pytest.mark.asyncio
@pytest.mark.illustration
async def test_invalid_size(client: AsyncClient):
    """Tests error handling for invalid image dimensions."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['invalid_size']
    
    # Act
    response = await client.post("/api/v1/illustrations/generate", json=request_data)
    
    # Assert
    assert response.status_code == 400
    error_data = response.json()
    assert 'error' in error_data
    assert 'dimensions' in error_data['error']['details']
    assert 'size' in error_data['error']['message'].lower()

@pytest.mark.asyncio
@pytest.mark.illustration
async def test_service_timeout(client: AsyncClient):
    """Tests handling of service timeout scenarios."""
    # Arrange
    request_data = TEST_ILLUSTRATION_REQUESTS['valid_request']
    
    with patch('src.services.stable_diffusion_service.StableDiffusionService') as mock_service:
        mock_service.return_value.generate_illustration.side_effect = asyncio.TimeoutError()
        
        # Act
        response = await client.post("/api/v1/illustrations/generate", json=request_data)
        
        # Assert
        assert response.status_code == 504
        error_data = response.json()
        assert 'error' in error_data
        assert 'timeout' in error_data['error']['message'].lower()