# parser.py
import logging
import os

import textract
from google.cloud import documentai, storage

logger = logging.getLogger(__name__)


class ParsingService:
    """
    A service to get clean, high-quality text from a resume.
    - Uses Google Cloud Document AI OCR processor for PDFs.
    - Uses 'textract' library for .doc and .docx files.
    """

    def __init__(self, project_id: str, location: str, processor_id: str):
        self.project_id: str = project_id
        self.location: str = location
        self.processor_id: str = processor_id

        # --- Document AI Client (for PDFs) ---
        doc_ai_opts = {"api_endpoint": f"{location}-documentai.googleapis.com"}
        self.doc_ai_client = documentai.DocumentProcessorServiceClient(
            client_options=doc_ai_opts
        )
        self.processor_name = self.doc_ai_client.processor_path(
            project_id, location, processor_id
        )
        logger.info(f"Initialized Document AI OCR Parser for: {self.processor_name}")

        # --- Storage Client (for downloading Word docs) ---
        self.storage_client = storage.Client()
        logger.info("Initialized Google Cloud Storage client.")

    def get_text_from_gcs(self, gcs_bucket: str, gcs_file_path: str) -> str:
        """
        Processes a resume from GCS and returns the full extracted text.
        Chooses the extraction method based on file extension.
        """
        file_name = os.path.basename(gcs_file_path)
        file_ext = os.path.splitext(file_name)[1].lower()
        gcs_uri = f"gs://{gcs_bucket}/{gcs_file_path}"

        # --- 1. Handle PDF ---
        if file_ext == ".pdf":
            logger.info(f"Processing PDF with Document AI OCR: {gcs_uri}")
            try:
                # Create a GCS document object
                gcs_document = documentai.GcsDocument(
                    gcs_uri=gcs_uri, mime_type="application/pdf"
                )

                # Configure the request
                request = documentai.ProcessRequest(
                    name=self.processor_name,
                    gcs_document=gcs_document,
                    skip_human_review=True,
                )

                # Call the API
                result = self.doc_ai_client.process_document(request=request)
                logger.info(f"Document AI OCR successful for {gcs_uri}")
                return result.document.text
            except Exception as e:
                logger.error(
                    f"Document AI OCR failed for {gcs_uri}: {e}", exc_info=True
                )
                raise  # Re-raise the exception to signal failure

        # --- 2. Handle DOCX/DOC ---
        elif file_ext in [".docx", ".doc"]:
            logger.info(f"Processing Word doc with textract: {gcs_uri}")
            local_doc_path = f"/tmp/{file_name}"  # Use temporary storage

            try:
                # Download the file
                source_bucket = self.storage_client.bucket(gcs_bucket)
                source_blob = source_bucket.blob(gcs_file_path)
                source_blob.download_to_filename(local_doc_path)
                logger.debug(f"Downloaded {gcs_uri} to {local_doc_path}")

                # Extract text using textract
                text_bytes = textract.process(local_doc_path)
                text = text_bytes.decode("utf-8")
                logger.info(f"Text extraction successful for {gcs_uri}")
                return text

            except Exception as e:
                logger.error(
                    f"Textract processing failed for {gcs_uri}: {e}", exc_info=True
                )
                raise  # Re-raise the exception

            finally:
                # Clean up the downloaded file
                if os.path.exists(local_doc_path):
                    try:
                        os.remove(local_doc_path)
                        logger.debug(f"Cleaned up temporary file: {local_doc_path}")
                    except OSError as e:
                        logger.warning(
                            f"Could not remove temporary file {local_doc_path}: {e}"
                        )

        # --- 3. Handle Unsupported Types ---
        else:
            logger.error(f"Unsupported file type '{file_ext}' for {gcs_uri}")
            raise ValueError(
                f"Unsupported file type: {file_ext}. Only .pdf, .doc, .docx allowed."
            )
