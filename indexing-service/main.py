import base64
import json
import logging
import os
import sys
import time
from uuid import UUID as PyUUID

import functions_framework
from cloudevents.http import CloudEvent

from database import DatabaseService
from models import Candidate
from parser import ParsingService
from resume_agent import ResumeAgent
from vector_store import VectorStoreService

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(lineno)d | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

required_env_vars = [
    "DB_USER",
    "DB_PASS",
    "DB_NAME",
    "DB_HOST",
    "DB_CONNECTION_NAME",
    "GCP_PROJECT_ID",
    "DOC_AI_OCR_PROCESSOR_ID",
    "GEMINI_API_KEY",
]

for var in required_env_vars:
    if var not in os.environ:
        logger.error(f"Missing required environment variable: {var}")
        raise EnvironmentError(f"Missing required environment variable: {var}")

# Initialize services
db_service = DatabaseService(
    db_user=os.environ.get("DB_USER"),
    db_pass=os.environ.get("DB_PASS"),
    db_name=os.environ.get("DB_NAME"),
    db_conn_name=os.environ.get("DB_CONNECTION_NAME"),
    db_host=os.environ.get("DB_HOST", ""),
)

parsing_service = ParsingService(
    project_id=os.environ.get("GCP_PROJECT_ID"),
    location=os.environ.get("DOC_AI_LOCATION", "us"),
    processor_id=os.environ.get("DOC_AI_OCR_PROCESSOR_ID"),
)

vector_store_service = VectorStoreService(
    db_service=db_service,
    google_api_key=os.environ.get("GEMINI_API_KEY"),
)

resume_agent = ResumeAgent(os.environ.get("GEMINI_API_KEY"))


def parse_cloud_event(cloud_event: CloudEvent) -> tuple[str, str, str] | None:
    event_type = cloud_event.get("type", "")
    # logger.info(f"Received event type: {event_type}")

    try:
        # CASE 1: Direct GCS Event (Eventarc native)
        if "google.cloud.storage.object" in event_type:
            logger.info("Parsing direct GCS event...")
            data = cloud_event.get_data()

            bucket_name = data.get("bucket")
            file_path = data.get("name")
            content_type = data.get("contentType")

            logger.debug(
                f"GCS Event Data: bucket={bucket_name}, name={file_path}, contentType={content_type}"
            )

            return bucket_name, file_path, content_type

        # CASE 2: Pub/Sub Event (GCS → Pub/Sub → Eventarc)
        elif "google.cloud.pubsub.topic" in event_type:
            logger.info("Parsing Pub/Sub event...")
            message_data = cloud_event.get_data()

            if not message_data or "message" not in message_data:
                logger.error("Invalid Pub/Sub event structure")
                return None

            # Decode Pub/Sub message
            message = message_data["message"]
            encoded_data = message.get("data", "")

            if not encoded_data:
                logger.error("No data in Pub/Sub message")
                return None

            # Base64 decode
            decoded_data = base64.b64decode(encoded_data).decode("utf-8")
            logger.debug(f"Decoded Pub/Sub data: {decoded_data}")

            # Parse JSON
            gcs_data = json.loads(decoded_data)

            bucket_name = gcs_data.get("bucket")
            file_path = gcs_data.get("name")
            content_type = gcs_data.get("contentType")

            logger.debug(
                f"Pub/Sub GCS Data: bucket={bucket_name}, name={file_path}, contentType={content_type}"
            )

            return bucket_name, file_path, content_type

        else:
            logger.error(f"Unsupported event type: {event_type}")
            return None

    except Exception as e:
        logger.error(f"Error parsing event: {e}", exc_info=True)
        return None


@functions_framework.cloud_event
def process_resume(cloud_event: CloudEvent):
    event_id = cloud_event.get("id")
    event_type = cloud_event.get("type", "")
    event_source = cloud_event.get("source", "")

    if not event_id:
        logger.error("CloudEvent missing 'id' field. Cannot ensure idempotency.")
        return ("Missing event ID", 400)

    logger.info(f"Received event ID: {event_id}")

    # IDEMPOTENCY CHECK: Has this event been processed before?
    try:
        is_processed, existing_status = db_service.check_event_processed(event_id)

        if is_processed:
            if existing_status == "COMPLETED":
                logger.info(
                    f"Event {event_id} already COMPLETED. Skipping (idempotent)."
                )
                return ("Event already processed", 200)
            elif existing_status == "PROCESSING":
                logger.warning(
                    f"Event {event_id} currently PROCESSING. Duplicate trigger."
                )
                return ("Event currently being processed", 200)
            elif existing_status == "FAILED":
                logger.info(f"Event {event_id} previously FAILED. Will retry.")
                # Continue processing to retry
            else:
                logger.warning(
                    f"Event {event_id} has unknown status: {existing_status}"
                )
                return (f"Event in unexpected state: {existing_status}", 200)
    except Exception as e:
        logger.error(f"Error checking event idempotency: {e}", exc_info=True)
        return (f"Idempotency check failed: {e}", 500)

    bucket_name: str | None = None
    file_path: str | None = None
    candidate_id: PyUUID | None = None
    new_resume_id: PyUUID | None = None
    old_resume_id: PyUUID | None = None

    # Parse Pub/Sub message
    try:
        parsed = parse_cloud_event(cloud_event)
        if not parsed:
            logger.error("Failed to parse CloudEvent")
            db_service.update_event_status(
                event_id, "FAILED", "Invalid event structure"
            )
            return ("Invalid event structure", 400)

        bucket_name, file_path, content_type = parsed

        if not all([bucket_name, file_path, content_type]):
            error_msg = f"Missing required fields: bucket={bucket_name}, path={file_path}, type={content_type}"
            logger.error(error_msg)
            db_service.update_event_status(event_id, "FAILED", error_msg)
            return ("Missing required fields", 400)

        logger.info(f"Processing file: gs://{bucket_name}/{file_path}")

        if content_type not in [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]:
            logger.warning(f"Skipping unsupported file type: {content_type}")
            db_service.update_event_status(
                event_id, "FAILED", f"Unsupported file type: {content_type}"
            )
            return (f"Unsupported file type: {content_type}", 200)
    except Exception as e:
        logger.error(f"Error parsing event: {e}", exc_info=True)
        db_service.update_event_status(
            event_id, "FAILED", f"Event parsing error: {str(e)[:500]}"
        )
        return (f"Event parsing error: {e}", 400)

    try:
        was_inserted = db_service.record_event_start(
            event_id=event_id,
            event_type=event_type,
            source=event_source,
            bucket_name=bucket_name,
            file_path=file_path,
        )

        if not was_inserted:
            logger.warning(
                f"⚠️ Event {event_id} already claimed. Race condition prevented by DB."
            )
            return ("Event already being processed by another instance", 200)

        logger.info(f"✅ Event {event_id} claimed successfully")
    except Exception as e:
        logger.error(f"Error claiming event: {e}", exc_info=True)
        return (f"Failed to claim event: {e}", 500)

    try:
        try:
            # extract text from pdf/doc
            logger.info("Extracting text from resume...")
            start_time = time.time()

            logger.debug("=" * 80)
            logger.debug(f"EXTRACTION STARTED at {time.strftime('%H:%M:%S')}")
            logger.debug("=" * 80)

            resume_text = parsing_service.get_text_from_gcs(bucket_name, file_path)

            logger.debug(f"[{time.time() - start_time:.2f}s] finished extracting...")
            logger.debug(f"GOT :: {len(resume_text)} characters of text")
            logger.debug("=" * 80)

            if not resume_text or len(resume_text.strip()) < 50:
                raise ValueError(f"Extracted text too short ({len(resume_text)} chars)")
        except Exception as e:
            logger.error(f"Text extraction failed: {e}", exc_info=True)
            db_service.update_event_status(
                event_id,
                "FAILED",
                f"Text extraction failed: {str(e)[:500]}",
            )
            return (f"Text extraction failed: {e}", 200)

        try:
            # parse text with LLM
            logger.info("Parsing resume with LLM...")
            start_time = time.time()
            logger.debug("=" * 80)
            logger.debug(f"PARSING STARTED at {time.strftime('%H:%M:%S')}")
            logger.debug("=" * 80)

            candidate_data: Candidate = resume_agent.parse(resume_text=resume_text)

            logger.debug(f"[{time.time() - start_time:.2f}s] finished parsing...")
            logger.debug(f"GOT :: {candidate_data}")
            logger.debug("=" * 80)

            if not candidate_data or not candidate_data.email:
                raise ValueError("LLM parsing failed or returned no email")

            logger.info(f"Successfully parsed resume for: {candidate_data.email}")
        except Exception as e:
            logger.error(f"LLM parsing failed: {e}", exc_info=True)
            db_service.update_event_status(
                event_id,
                "FAILED",
                f"LLM parsing failed: {str(e)[:500]}",
            )
            return (f"LLM parsing failed: {e}", 200)

        try:
            # Upsert candidate and resume (with atomic ON CONFLICT)
            logger.info("Upserting candidate and creating resume...")
            candidate_id, new_resume_id, old_resume_id = (
                db_service.upsert_candidate_and_resume(
                    candidate_data=candidate_data,
                    gcs_bucket=bucket_name,
                    gcs_file_path=file_path,
                    existing_resume_id=None,
                )
            )

            logger.info(f"Candidate ID: {candidate_id}, New Resume ID: {new_resume_id}")
        except Exception as e:
            logger.error(f"Database upsert failed: {e}", exc_info=True)
            if new_resume_id:
                db_service.update_event_status(
                    event_id,
                    "FAILED",
                    f"Database upsert failed: {str(e)[:500]}",
                )
            return (f"Database upsert failed: {e}", 200)

        # insert related records (non-critical - continue on failure)
        try:
            # Education records
            if candidate_data.education:
                logger.info(
                    f"Inserting {len(candidate_data.education)} education records..."
                )
                db_service.insert_education(candidate_id, candidate_data.education)
        except Exception as e:
            logger.error(f"Education insert failed (non-critical): {e}", exc_info=True)

        # Job experiences
        try:
            if candidate_data.job_experiences:
                logger.info(
                    f"Inserting {len(candidate_data.job_experiences)} job records..."
                )
                db_service.insert_job_experiences(
                    candidate_id, candidate_data.job_experiences
                )
        except Exception as e:
            logger.error(
                f"Job experiences insert failed (non-critical): {e}", exc_info=True
            )

        # Internships
        try:
            if candidate_data.internships:
                logger.info(
                    f"Inserting {len(candidate_data.internships)} internship records..."
                )
                db_service.insert_internships(candidate_id, candidate_data.internships)
        except Exception as e:
            logger.error(
                f"Internships insert failed (non-critical): {e}", exc_info=True
            )

        # Projects
        try:
            if candidate_data.projects:
                logger.info(
                    f"Inserting {len(candidate_data.projects)} project records..."
                )
                db_service.insert_projects(candidate_id, candidate_data.projects)
        except Exception as e:
            logger.error(f"Projects insert failed (non-critical): {e}", exc_info=True)

        if old_resume_id and old_resume_id != new_resume_id:
            # archive old resume and delete old embedding
            try:
                logger.info(f"Deleting old embedding for resume: {old_resume_id}")
                vector_store_service.delete_embedding(old_resume_id)
                logger.info(f"Deleted old embedding for resume {old_resume_id}")
            except Exception as e:
                logger.warning(f"Failed to delete old embedding (non-critical): {e}")

        try:
            # create embedding with validation
            logger.info("Creating embedding for new resume...")
            anonymized_text = candidate_data.to_text()

            # CRITICAL: Validate text before sending to Google API
            if (
                not anonymized_text
                or not anonymized_text.strip()
                or len(anonymized_text.strip()) < 10
            ):
                logger.warning(f"Empty anonymized text for candidate {candidate_id}. ")

                raise ValueError("Anonymized text is empty")

            logger.debug(f"Embedding text length: {len(anonymized_text)} chars")

            vector_metadata = {
                "candidate_id": str(candidate_id),
                "resume_id": str(new_resume_id),
                "total_years_experience": candidate_data.total_years_experience or 0.0,
                "key_domains": candidate_data.key_domains or [],
                "email": candidate_data.email,
                "location": candidate_data.location or "",
            }

            vector_store_service.add_embedding(
                candidate_id=candidate_id,
                resume_id=new_resume_id,
                text_content=anonymized_text,
                metadata=vector_metadata,
            )

            logger.info(f"Successfully created embedding for resume {new_resume_id}")
        except Exception as e:
            logger.error(f"Embedding creation failed: {e}", exc_info=True)
            db_service.update_event_status(
                resume_id=new_resume_id,
                status="FAILED",
                error_message=f"Embedding creation failed: {str(e)[:500]}",
            )
            return (f"Embedding creation failed: {str(e)[:200]}", 500)

        db_service.update_resume_status(resume_id=new_resume_id, status="COMPLETED")
        db_service.update_event_status(event_id, "COMPLETED")

        logger.info(
            f"Successfully processed event {event_id}, "
            f"resume {new_resume_id} for candidate {candidate_id}"
        )
        return ("Processing complete", 200)

    except Exception as e:
        logger.error(
            f"CRITICAL Error processing {file_path} (Resume ID: {new_resume_id}): {e}",
            exc_info=True,
        )

        if new_resume_id:
            try:
                db_service.update_resume_status(
                    resume_id=new_resume_id,
                    status="FAILED",
                    error_message=str(e)[:500],
                )
                logger.info(f"Marked resume {new_resume_id} as FAILED")
            except Exception as db_e:
                logger.error(f"Failed to mark resume as FAILED: {db_e}")

        try:
            db_service.update_event_status(event_id, "FAILED", str(e)[:500])
            logger.info(f"Marked event {event_id} as FAILED")
        except Exception as event_e:
            logger.error(f"Failed to mark event as FAILED: {event_e}")

        return (f"Processing failed: {str(e)[:200]}", 200)
