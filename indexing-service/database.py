import hashlib
import logging
import time
from uuid import UUID as PyUUID

import sqlalchemy
from sqlalchemy import text
from sqlalchemy.engine.url import URL
from sqlalchemy.exc import SQLAlchemyError

from models import Candidate, Education, Internship, JobExperience, Project

logger = logging.getLogger(__name__)


def stable_hash_to_int(value: str) -> int:
    return int(hashlib.md5(value.encode()).hexdigest(), 16) % (2**31 - 1)


class DatabaseService:
    def __init__(
        self,
        db_user: str,
        db_pass: str,
        db_name: str,
        db_host: str,
        db_conn_name: str | None = None,
        db_port: int | None = None,
    ):
        self.db_user: str = (db_user or "").strip().strip("\r\n\t\x00")
        self.db_pass: str = (db_pass or "").strip().strip("\r\n\t\x00")
        self.db_name: str = (db_name or "").strip().strip("\r\n\t\x00")
        self.db_host: str = db_host
        self.db_port: int = db_port if db_port else 5432

        if db_conn_name:
            self.db_conn_query = f"/cloudsql/{db_conn_name}/.s.PGSQL.5432"

        logger.debug(
            f"Initializing database: {self.db_user}@{self.db_host}:{self.db_port}/{self.db_name}"
        )

        try:
            if self.db_conn_query:
                url = URL.create(
                    drivername="postgresql+pg8000",
                    username=self.db_user,
                    password=self.db_pass,
                    database=self.db_name,
                    query={"unix_sock": self.db_conn_query},
                )
            else:
                url = URL.create(
                    drivername="postgresql+pg8000",
                    username=self.db_user,
                    password=self.db_pass,
                    host=self.db_host,
                    port=self.db_port,
                    database=self.db_name,
                )

            self.db_pool: sqlalchemy.Engine = sqlalchemy.create_engine(
                url,
                pool_size=5,
                max_overflow=2,
                pool_timeout=30,
                pool_recycle=1800,
                pool_pre_ping=True,
            )

            logger.info("Database connection pool initialized successfully.")
        except Exception as e:
            logger.critical(
                f"Failed to initialize database connection pool: {e}", exc_info=True
            )
            raise

    def check_event_processed(self, event_id: str) -> tuple[bool, str | None]:
        """
        Check if an event has already been processed.
        Returns (is_processed, status)
        """
        stmt = text("""
            SELECT status FROM event_logs
            WHERE event_id = :event_id
        """)

        try:
            with self.db_pool.connect() as conn:
                result = conn.execute(stmt, {"event_id": event_id}).fetchone()

                if result:
                    logger.debug(f"Event {event_id} found with status: {result[0]}")
                    return (True, result[0])

                logger.debug(f"Event {event_id} not found in event_logs")
                return (False, None)

        except SQLAlchemyError as e:
            logger.error(f"Error checking event {event_id}: {e}", exc_info=True)
            raise

    def record_event_start(
        self,
        event_id: str,
        event_type: str,
        source: str,
        bucket_name: str,
        file_path: str,
    ) -> bool:
        """
        Record that an event has started processing.
        Returns True if successfully inserted, False if already exists.
        """
        stmt = text("""
            INSERT INTO event_logs (event_id, event_type, source, bucket_name, file_path, status)
            VALUES (:event_id, :event_type, :source, :bucket_name, :file_path, 'PROCESSING')
            ON CONFLICT (event_id) DO NOTHING
            RETURNING event_id
        """)

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    result = conn.execute(
                        stmt,
                        {
                            "event_id": event_id,
                            "event_type": event_type,
                            "source": source,
                            "bucket_name": bucket_name,
                            "file_path": file_path,
                        },
                    ).fetchone()

                    if result:
                        logger.info(
                            f"✅ Event {event_id} recorded and claimed for processing"
                        )
                        return True

                    logger.warning(
                        f"⚠️ Event {event_id} already claimed by another instance"
                    )
                    return False

        except SQLAlchemyError as e:
            logger.error(
                f"Error recording event start for {event_id}: {e}", exc_info=True
            )
            raise

    def update_event_status(
        self, event_id: str, status: str, error_message: str | None = None
    ):
        """
        Update the status of an event to track processing progress.
        """
        stmt = text("""
            UPDATE event_logs
            SET status = :status,
                completed_at = CASE WHEN :status IN ('COMPLETED', 'FAILED') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                error_message = :error_message
            WHERE event_id = :event_id
        """)

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        stmt,
                        {
                            "status": status,
                            "error_message": error_message,
                            "event_id": event_id,
                        },
                    )
                    logger.debug(f"Updated event {event_id} status to {status}")

        except SQLAlchemyError as e:
            logger.error(f"Error updating event {event_id} status: {e}", exc_info=True)
            raise

    def check_existing_candidate(
        self, conn, email: str
    ) -> tuple[PyUUID | None, PyUUID | None]:
        """
        Checks if a candidate with the given email already exists.
        Returns: (candidate_id, latest_resume_id) or (None, None) if not found.
        """
        stmt = text("""
            SELECT candidate_id, latest_resume_id
            FROM public.candidates
            WHERE email = :email
        """)

        try:
            result = conn.execute(stmt, {"email": email}).fetchone()
            if result:
                return result[0], result[1]
            return None, None
        except SQLAlchemyError as e:
            logger.error(
                f"Error checking existing candidate for {email}: {e}", exc_info=True
            )
            raise

    def upsert_candidate_and_resume(
        self,
        candidate_data: Candidate,
        gcs_bucket: str,
        gcs_file_path: str,
        existing_resume_id: PyUUID | None = None,
    ) -> tuple[PyUUID, PyUUID, PyUUID | None]:
        """
        Inserts or updates a candidate and creates/updates a resume entry.
        Uses atomic ON CONFLICT to prevent race conditions.

        CRITICAL FIX: Changed from SELECT-then-INSERT to atomic INSERT ON CONFLICT.
        This prevents IntegrityError when multiple instances process same candidate.

        Args:
            candidate_data: Parsed candidate information
            gcs_bucket: GCS bucket name
            gcs_file_path: Path to the file in GCS
            existing_resume_id: Optional UUID of existing PROCESSING resume to update

        Returns: (candidate_id, new_resume_id, old_resume_id)
        """
        start_time = time.time()
        logger.debug("=" * 80)
        logger.debug(f"UPSERT STARTED at {time.strftime('%H:%M:%S')}")
        logger.debug("=" * 80)

        try:
            logger.debug(f"[{time.time() - start_time:.2f}s] Acquiring connection...")

            with self.db_pool.connect() as conn:
                logger.debug(
                    f"[{time.time() - start_time:.2f}s] ✅ Connection acquired"
                )

                trans = conn.begin()
                logger.debug(
                    f"[{time.time() - start_time:.2f}s] ✅ Transaction started"
                )

                try:
                    # Set constraints to deferred
                    conn.execute(text("SET CONSTRAINTS ALL DEFERRED"))
                    logger.debug(
                        f"[{time.time() - start_time:.2f}s] ✅ Constraints deferred"
                    )

                    # ATOMIC UPSERT using INSERT ... ON CONFLICT
                    # This prevents race conditions when multiple instances process same email
                    candidate_upsert_stmt = text("""
                        INSERT INTO public.candidates (
                            first_name, last_name, email, phone_number, location,
                            skills, career_path_summary, total_years_experience,
                            key_domains, achievements, hobbies, academic_summary
                        ) VALUES (
                            :first_name, :last_name, :email, :phone_number, :location,
                            :skills, :career_path_summary, :total_years_experience,
                            :key_domains, :achievements, :hobbies, :academic_summary
                        )
                        ON CONFLICT (email) DO UPDATE SET
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name,
                            phone_number = EXCLUDED.phone_number,
                            location = EXCLUDED.location,
                            skills = EXCLUDED.skills,
                            career_path_summary = EXCLUDED.career_path_summary,
                            total_years_experience = EXCLUDED.total_years_experience,
                            key_domains = EXCLUDED.key_domains,
                            achievements = EXCLUDED.achievements,
                            hobbies = EXCLUDED.hobbies,
                            academic_summary = EXCLUDED.academic_summary,
                            updated_at = NOW()
                        RETURNING candidate_id, latest_resume_id
                    """)

                    result = conn.execute(
                        candidate_upsert_stmt,
                        {
                            "first_name": candidate_data.first_name,
                            "last_name": candidate_data.last_name,
                            "email": candidate_data.email,
                            "phone_number": candidate_data.phone_number,
                            "location": candidate_data.location,
                            "skills": candidate_data.skills or [],
                            "career_path_summary": candidate_data.career_path_summary,
                            "total_years_experience": candidate_data.total_years_experience,
                            "key_domains": candidate_data.key_domains or [],
                            "achievements": candidate_data.achievements or [],
                            "hobbies": candidate_data.hobbies or [],
                            "academic_summary": candidate_data.academic_summary,
                        },
                    )

                    candidate_id, old_resume_id = result.fetchone()
                    logger.debug(
                        f"[{time.time() - start_time:.2f}s] ✅ Upserted candidate: {candidate_id}"
                    )

                    # Handle resume creation/update
                    if existing_resume_id:
                        # UPDATE existing PROCESSING resume with candidate_id
                        logger.info(f"Updating existing resume {existing_resume_id}...")
                        update_resume_stmt = text("""
                            UPDATE public.resumes
                            SET
                                candidate_id = :candidate_id,
                                status = CAST('PROCESSING' AS resume_status),
                                updated_at = NOW()
                            WHERE resume_id = :resume_id
                            RETURNING resume_id
                        """)

                        result = conn.execute(
                            update_resume_stmt,
                            {
                                "candidate_id": candidate_id,
                                "resume_id": existing_resume_id,
                            },
                        )

                        new_resume_id = result.scalar_one()
                        logger.debug(
                            f"[{time.time() - start_time:.2f}s] ✅ Updated existing resume: {new_resume_id}"
                        )
                    else:
                        # INSERT new resume (fallback for edge cases)
                        logger.info("Creating new resume record...")
                        resume_stmt = text("""
                            INSERT INTO public.resumes (
                                candidate_id, gcs_bucket, gcs_file_path, status, is_paid
                            ) VALUES (
                                :candidate_id, :gcs_bucket, :gcs_file_path,
                                CAST('PROCESSING' AS resume_status), FALSE
                            ) RETURNING resume_id
                        """)

                        result = conn.execute(
                            resume_stmt,
                            {
                                "candidate_id": candidate_id,
                                "gcs_bucket": gcs_bucket,
                                "gcs_file_path": gcs_file_path,
                            },
                        )

                        new_resume_id = result.scalar_one()
                        logger.debug(
                            f"[{time.time() - start_time:.2f}s] ✅ Inserted new resume: {new_resume_id}"
                        )

                    # UPDATE candidate's latest_resume_id
                    update_resume_link = text("""
                        UPDATE public.candidates
                        SET latest_resume_id = :resume_id
                        WHERE candidate_id = :candidate_id
                    """)

                    conn.execute(
                        update_resume_link,
                        {
                            "resume_id": new_resume_id,
                            "candidate_id": candidate_id,
                        },
                    )
                    logger.debug(
                        f"[{time.time() - start_time:.2f}s] ✅ Linked resume to candidate"
                    )

                    # If there was an old resume, mark it as ARCHIVED
                    if old_resume_id and old_resume_id != new_resume_id:
                        archive_stmt = text("""
                            UPDATE public.resumes
                            SET status = CAST('ARCHIVED' AS resume_status),
                                updated_at = NOW()
                            WHERE resume_id = :resume_id
                        """)
                        conn.execute(archive_stmt, {"resume_id": old_resume_id})
                        logger.debug(f"Archived old resume: {old_resume_id}")

                    # Commit transaction
                    trans.commit()
                    logger.debug(
                        f"[{time.time() - start_time:.2f}s] ✅✅✅ TRANSACTION COMMITTED"
                    )
                    logger.info(
                        f"Successfully upserted candidate {candidate_id} with resume {new_resume_id}"
                    )

                    return candidate_id, new_resume_id, old_resume_id

                except Exception as e:
                    trans.rollback()
                    logger.error(
                        f"Transaction failed, rolling back: {e}", exc_info=True
                    )
                    raise

        except SQLAlchemyError as e:
            logger.error(f"Error in upsert_candidate_and_resume: {e}", exc_info=True)
            raise

    def insert_education(self, candidate_id: PyUUID, education_list: list[Education]):
        """Inserts education records for a candidate (replaces old ones)."""
        if not education_list:
            logger.info("No education records to insert")
            return

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    # Delete old education records
                    delete_stmt = text(
                        "DELETE FROM public.education WHERE candidate_id = :candidate_id"
                    )
                    conn.execute(delete_stmt, {"candidate_id": candidate_id})

                    # Insert new education records
                    insert_stmt = text("""
                        INSERT INTO public.education (
                            candidate_id, level, institution_name, degree_or_certificate,
                            major_or_specialization, year_of_passing, score, summary
                        ) VALUES (
                            :candidate_id, :level, :institution_name, :degree_or_certificate,
                            :major_or_specialization, :year_of_passing, :score, :summary
                        )
                    """)

                    for edu in education_list:
                        conn.execute(
                            insert_stmt,
                            {
                                "candidate_id": candidate_id,
                                "level": edu.level.value
                                if hasattr(edu.level, "value")
                                else str(edu.level),
                                "institution_name": edu.institution_name,
                                "degree_or_certificate": edu.degree_or_certificate,
                                "major_or_specialization": edu.major_or_specialization,
                                "year_of_passing": edu.year_of_passing,
                                "score": edu.score,
                                "summary": edu.summary,
                            },
                        )

                    logger.info(
                        f"Inserted {len(education_list)} education records for candidate {candidate_id}"
                    )

        except SQLAlchemyError as e:
            logger.error(
                f"Error inserting education for {candidate_id}: {e}", exc_info=True
            )
            raise

    def insert_job_experiences(self, candidate_id: PyUUID, jobs: list[JobExperience]):
        """
        Inserts job experience records with field truncation.

        CRITICAL FIX: Truncates long field values to fit VARCHAR(255) constraints.
        """
        if not jobs:
            logger.info("No job experiences to insert")
            return

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        text(
                            "DELETE FROM public.jobs WHERE candidate_id = :candidate_id"
                        ),
                        {"candidate_id": candidate_id},
                    )

                    insert_stmt = text("""
                        INSERT INTO public.jobs (
                            candidate_id, company_name, company_description, company_tags,
                            role_title, role_description, role_tags, duration_months,
                            domain_tags, achievements_summary, start_date, end_date
                        ) VALUES (
                            :candidate_id, :company_name, :company_description, :company_tags,
                            :role_title, :role_description, :role_tags, :duration_months,
                            :domain_tags, :achievements_summary, :start_date, :end_date
                        )
                    """)

                    for job in jobs:
                        conn.execute(
                            insert_stmt,
                            {
                                "candidate_id": candidate_id,
                                "company_name": (job.company_name or "")[
                                    :255
                                ],  # TRUNCATE
                                "company_description": job.company_description,  # TEXT field
                                "company_tags": job.company_tags or [],
                                "role_title": (job.role_title or "")[:255],  # TRUNCATE
                                "role_description": job.role_description,  # TEXT field
                                "role_tags": job.role_tags or [],
                                "duration_months": job.duration_months,
                                "domain_tags": job.domain_tags or [],
                                "achievements_summary": job.achievements_summary,  # TEXT field
                                "start_date": job.start_date,
                                "end_date": job.end_date,
                            },
                        )

                    logger.info(
                        f"Inserted {len(jobs)} job records for candidate {candidate_id}"
                    )

        except SQLAlchemyError as e:
            logger.error(f"Error inserting jobs: {e}", exc_info=True)
            raise

    def insert_internships(self, candidate_id: PyUUID, internships: list[Internship]):
        """
        Inserts internship records with field truncation.

        CRITICAL FIX: Truncates long field values to fit VARCHAR(255) constraints.
        """
        if not internships:
            logger.info("No internships to insert")
            return

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        text(
                            "DELETE FROM public.internships WHERE candidate_id = :candidate_id"
                        ),
                        {"candidate_id": candidate_id},
                    )

                    insert_stmt = text("""
                        INSERT INTO public.internships (
                            candidate_id, company_name, company_description, company_tags,
                            role_title, role_description, role_tags, duration_months,
                            start_date, end_date
                        ) VALUES (
                            :candidate_id, :company_name, :company_description, :company_tags,
                            :role_title, :role_description, :role_tags, :duration_months,
                            :start_date, :end_date
                        )
                    """)

                    for internship in internships:
                        conn.execute(
                            insert_stmt,
                            {
                                "candidate_id": candidate_id,
                                "company_name": (internship.company_name or "")[
                                    :255
                                ],  # TRUNCATE
                                "company_description": internship.company_description,  # TEXT field
                                "company_tags": internship.company_tags or [],
                                "role_title": (internship.role_title or "")[
                                    :255
                                ],  # TRUNCATE
                                "role_description": internship.role_description,  # TEXT field
                                "role_tags": internship.role_tags or [],
                                "duration_months": internship.duration_months,
                                "start_date": internship.start_date,
                                "end_date": internship.end_date,
                            },
                        )

                    logger.info(f"Inserted {len(internships)} internship records")

        except SQLAlchemyError as e:
            logger.error(f"Error inserting internships: {e}", exc_info=True)
            raise

    def insert_projects(self, candidate_id: PyUUID, projects: list[Project]):
        """
        Inserts project records with field truncation to prevent VARCHAR overflow.

        CRITICAL FIX: Truncates long field values to fit VARCHAR(255) constraints.
        """
        if not projects:
            logger.info("No projects to insert")
            return

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        text(
                            "DELETE FROM public.projects WHERE candidate_id = :candidate_id"
                        ),
                        {"candidate_id": candidate_id},
                    )

                    insert_stmt = text("""
                        INSERT INTO public.projects (
                            candidate_id, project_name, project_description,
                            technologies_used, role_in_project, tags, duration_months
                        ) VALUES (
                            :candidate_id, :project_name, :project_description,
                            :technologies_used, :role_in_project, :tags, :duration_months
                        )
                    """)

                    for project in projects:
                        conn.execute(
                            insert_stmt,
                            {
                                "candidate_id": candidate_id,
                                "project_name": (project.project_name or "")[
                                    :255
                                ],  # TRUNCATE
                                "project_description": project.project_description,  # TEXT field - no limit
                                "technologies_used": project.technologies_used or [],
                                "role_in_project": (project.role_in_project or "")[
                                    :255
                                ],  # TRUNCATE
                                "tags": project.tags or [],
                                "duration_months": project.duration_months,
                            },
                        )

                    logger.info(f"Inserted {len(projects)} project records")

        except SQLAlchemyError as e:
            logger.error(f"Error inserting projects: {e}", exc_info=True)
            raise

    def update_resume_status(
        self, resume_id: PyUUID, status: str, error_message: str | None = None
    ):
        """Updates resume status and timestamps."""
        stmt = text("""
            UPDATE public.resumes
                SET
                    status = CAST(:status AS resume_status),
                    error_message = :error,
                    processed_at = CASE WHEN :status = 'COMPLETED' THEN NOW() ELSE processed_at END,
                    failed_at = CASE WHEN :status = 'FAILED' THEN NOW() ELSE failed_at END,
                    updated_at = NOW()
            WHERE resume_id = :id
        """)

        try:
            with self.db_pool.connect() as conn:
                with conn.begin():
                    conn.execute(
                        stmt,
                        {
                            "status": status,
                            "error": error_message,
                            "id": resume_id,
                        },
                    )
                    logger.debug(f"Updated resume {resume_id} to status {status}")

        except SQLAlchemyError as e:
            logger.error(f"Error updating resume status: {e}", exc_info=True)
            raise
