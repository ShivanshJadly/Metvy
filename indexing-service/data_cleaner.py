"""
Data cleaning utilities for LLM output.
Handles common validation errors before Pydantic model creation.
"""

import logging

logger = logging.getLogger(__name__)


def clean_llm_output(raw_data: dict) -> dict:
    """Clean and normalize LLM output before Pydantic validation."""

    # 1. Convert string "null" and empty strings to actual None (EXCEPT location)
    null_optional_fields = ["email", "phone_number"]  # Removed location
    for key in null_optional_fields:
        if raw_data.get(key) in ("null", "", None):
            raw_data[key] = None

    # 2. Handle REQUIRED fields with fallbacks
    # Last name fallback
    if not raw_data.get("last_name") or raw_data.get("last_name") in ("null", ""):
        raw_data["last_name"] = raw_data.get("first_name", "Unknown")
        logger.warning("Missing last_name, using first_name as fallback")

    # Location fallback (REQUIRED field)
    if not raw_data.get("location") or raw_data.get("location") in ("null", ""):
        raw_data["location"] = "Not Specified"
        logger.warning("Missing location, using fallback 'Not Specified'")

    # Email fallback (REQUIRED field)
    if not raw_data.get("email") or raw_data.get("email") in ("null", ""):
        # Generate placeholder email from name
        first = raw_data.get("first_name", "unknown").lower().replace(" ", "")
        last = raw_data.get("last_name", "candidate").lower().replace(" ", "")
        raw_data["email"] = f"{first}.{last}@placeholder.local"
        logger.warning(f"Missing email, generated placeholder: {raw_data['email']}")

    # 3. Clean internships dates
    for internship in raw_data.get("internships", []):
        internship["start_date"] = parse_date_field(internship.get("start_date"))
        internship["end_date"] = parse_date_field(internship.get("end_date"))

    # 4. Clean job_experiences dates
    for job in raw_data.get("job_experiences", []):
        job["start_date"] = parse_date_field(job.get("start_date"))
        job["end_date"] = parse_date_field(job.get("end_date"))

    # 5. Clean education records
    for edu in raw_data.get("education", []):
        # Convert level to uppercase if it's a string
        if "level" in edu and isinstance(edu["level"], str):
            # Try to map common variations
            level_mapping = {
                "10TH": "10th Grade",
                "10": "10th Grade",
                "TENTH": "10th Grade",
                "12TH": "12th Grade",
                "12": "12th Grade",
                "TWELFTH": "12th Grade",
                "UG": "Undergraduate",
                "BACHELOR": "Undergraduate",
                "PG": "Postgraduate",
                "MASTER": "Postgraduate",
                "POSTGRADUATE": "Postgraduate",
                "PHD": "PhD",
                "DOCTORATE": "PhD",
            }

            level_upper = edu["level"].upper().strip()
            edu["level"] = level_mapping.get(level_upper, edu["level"])

    # 6. Ensure arrays are not None
    array_fields = [
        "skills",
        "key_domains",
        "achievements",
        "hobbies",
        "education",
        "job_experiences",
        "internships",
        "projects",
    ]
    for field in array_fields:
        if raw_data.get(field) is None:
            raw_data[field] = []

    return raw_data
