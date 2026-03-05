# resume_agent.py

import logging
import time

from dotenv import main
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError

from data_cleaner import clean_llm_output
from models import Candidate

logger = logging.getLogger(__name__)

main.load_dotenv()


class ResumeAgent:
    """
    An agent that takes in parsed text from a resume and extracts structured information. Tries upto :max_retries times.
    """

    def __init__(
        self,
        gemini_api_key: str,
        llm_name: str = "gemini-2.5-flash",
        retry_llm_name: str = "gemini-2.5-pro",
        max_retries: int = 7,
    ):
        # logger.info(f"API key repr: {repr(gemini_api_key)}")  # Shows hidden characters
        if not gemini_api_key or not gemini_api_key.strip():
            raise ValueError("Gemini API key is empty or invalid")

        cleaned_key = gemini_api_key.strip()

        self._llm: ChatGoogleGenerativeAI = ChatGoogleGenerativeAI(
            model=llm_name,
            temperature=0.4,
            disable_streaming=True,
            google_api_key=cleaned_key,
        )
        self._retry_llm: ChatGoogleGenerativeAI = ChatGoogleGenerativeAI(
            model=retry_llm_name,
            temperature=0.7,
            disable_streaming=True,
            google_api_key=cleaned_key,
        )
        self._max_retries = max_retries

        self._prompt_template: str = """You are an expert resume parser. Your task is to accurately extract structured information from the resume text provided.
- **Contact Information**: Parse phone numbers (E.164 format if possible), email addresses, and names.
- **Dates**: Normalize all dates into a consistent YYYY-MM-DD format.
- **Required Fields**: You must extract `first_name`, `last_name`, and all required education fields.
- **Output Format**: Provide the output strictly in JSON format adhering to the Candidate schema. Ensure all required fields are present and correctly formatted.

# IMPORTANT:
- Do Not, under any circumstances, mention or include personal information like name, phone, email in the summary or description fields.
- Personal information should only appear in the designated fields.
- be descriptive and detailed in descriptions and summaries, but avoid redundancy.
"""

    def parse(self, resume_text: str) -> Candidate:
        """
        Parses resume text and retries with a better model if validation fails.
        """
        attempt: int = 0
        last_error: ValidationError | None = None
        last_raw_output = None  # Track for error logging

        while attempt < self._max_retries:
            try:
                attempt += 1

                if attempt == 1:
                    logger.debug(
                        f"Attempt {attempt}/{self._max_retries}: Using 2.5-flash"
                    )
                    chain = self._llm.with_structured_output(
                        Candidate, method="json_schema"
                    )
                    prompt = f"{self._prompt_template}\n\nResume Text:\n{resume_text}"
                else:
                    logger.debug(
                        f"Attempt {attempt}/{self._max_retries}: Using 2.5-pro with error feedback"
                    )
                    chain = self._retry_llm.with_structured_output(
                        Candidate, method="json_schema"
                    )
                    prompt = (
                        f"{self._prompt_template}\n\n"
                        f"A previous attempt to parse this resume failed (Attempt {attempt - 1}). "
                        "Please analyze the following validation errors and the resume text carefully "
                        "to provide a corrected, valid output. Pay close attention to required fields "
                        "and date formats.\n\n"
                        f"VALIDATION ERRORS FROM LAST ATTEMPT:\n{last_error}\n\n"
                        f"ORIGINAL RESUME TEXT:\n{resume_text}"
                    )
                raw_output = chain.invoke(prompt)
                last_raw_output = raw_output  # Store for potential error logging

                if isinstance(raw_output, Candidate):
                    logger.info(f"Successfully parsed on attempt {attempt}")
                    return raw_output

                # If chain returns dict, clean then validate
                cleaned_data = clean_llm_output(raw_output)
                candidate = Candidate.model_validate(cleaned_data)

                logger.info(f"Successfully parsed on attempt {attempt} after cleaning.")
                return candidate

            except ValidationError as e:
                last_error = e
                logger.warning(
                    f"Attempt {attempt}/{self._max_retries} failed with validation error: {e}"
                )

                if attempt >= self._max_retries:
                    logger.error(
                        f"All {self._max_retries} attempts exhausted. Final error: {e}"
                    )
                    if last_raw_output:
                        logger.error(f"Raw LLM output: {last_raw_output}")
                    raise e

                import random

                backoff_time = 2 ** (attempt - 1) + random.uniform(0, 1)
                logger.debug(f"Waiting {backoff_time:.2f} seconds before retry...")
                time.sleep(backoff_time)

            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt}: {e}")
                raise e

        # Worst case scenario, should not reach here
        logger.error("Exited retry loop without success or exception")
        raise RuntimeError("Failed to parse resume after all retry attempts")
