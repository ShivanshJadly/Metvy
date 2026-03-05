# test_local.py
import base64
import json
import os
from unittest.mock import Mock

os.environ["DB_USER"] = "ankt"
os.environ["DB_PASS"] = "[;rNf9h]glVU1Rq{"
os.environ["DB_NAME"] = "resumes_db"
os.environ["DB_HOST"] = "127.0.0.1"
os.environ["DB_CONNECTION_NAME"] = (
    "keen-scion-475112-c5:asia-south2:metvy-intelligence-resume-db"
)
os.environ["GCP_PROJECT_ID"] = "keen-scion-475112-c5"
os.environ["DOC_AI_OCR_PROCESSOR_ID"] = "3b340b40079d7716"
os.environ["DOC_AI_LOCATION"] = "eu"
os.environ["GEMINI_API_KEY"] = "AIzaSyDzUzHLFpV1JDKntXtahTc9eRlr2PwUCVg"

# Import your main function
from main import process_resume

# Create a mock CloudEvent
mock_event = Mock()
mock_event.get_data = lambda: {
    "message": {
        "data": base64.b64encode(
            json.dumps(
                {
                    "bucket": "metvy-intelligence-resumes",
                    "name": "resumes/Siyaa Deshmukh_Resume.pdf",
                    "contentType": "application/pdf",
                }
            ).encode()
        ).decode()
    }
}

# Run the function
try:
    result = process_resume(mock_event)
    print(f"\n✅ Function completed: {result}")
except Exception as e:
    print(f"\n❌ Function failed: {e}")
    import traceback

    traceback.print_exc()
