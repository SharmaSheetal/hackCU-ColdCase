import logging
from google import genai
from google.genai.errors import ClientError
from backend.config import settings

log = logging.getLogger(__name__)

# Pre-initialize clients for all available keys
_clients = [genai.Client(api_key=key) for key in settings.gemini_api_keys if key]
_current_client_index = 0

def get_current_client() -> genai.Client:
    """Returns the currently active Gemini client."""
    if not _clients:
        raise ValueError("No Gemini API keys found in configuration.")
    return _clients[_current_client_index]

def rotate_client():
    """Shifts to the next available API key in the pool, wrapping around."""
    global _current_client_index
    if len(_clients) > 1:
        _current_client_index = (_current_client_index + 1) % len(_clients)
        log.warning(f" Rate limit hit. Rotating Gemini API Key to fallback slot [{_current_client_index + 1}/{len(_clients)}].")
    else:
        log.error(" Rate limit hit, but no fallback Gemini keys are configured! Waiting out the throttle...")

def execute_with_fallback(func, *args, **kwargs):
    """
    Executes a Google GenAI function, automatically rotating keys and retrying 
    if a ResourceExhausted (429) error occurs.
    """
    from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

    def is_rate_limit(exception):
        return isinstance(exception, ClientError) and getattr(exception, 'code', None) == 429

    # We use tenacity for backoff on the overall execution, BUT we inject our manual rotation
    # immediately when a 429 happens.
    
    max_attempts = 15 if len(_clients) > 1 else 6 # Higher tolerance if we have multiple keys
    
    @retry(
        wait=wait_exponential(multiplier=1.5, min=2, max=60),
        stop=stop_after_attempt(max_attempts),
        retry=retry_if_exception_type(ClientError)
    )
    def _run_with_retry():
        client = get_current_client()
        try:
            return func(client, *args, **kwargs)
        except ClientError as e:
            if getattr(e, 'code', None) == 429:
                rotate_client() # Immediately swap to the next key for the subsequent Tenacity retry
            raise # Let Tenacity catch it and retry the function call

    return _run_with_retry()
