import datetime
import re
from enum import Enum
from typing import Annotated

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)


def normalize_date_string(date_str: str | None) -> str | datetime.date | None:
    """
    Tries to convert a variety of common date strings into 'YYYY-MM-DD' format.
    Returns None if the input is None or empty.
    """
    # Handle None or empty strings
    if date_str is None or date_str == "":
        return None

    # Handle non-string types (safety check)
    if not isinstance(date_str, str):
        return None

    clean_str = date_str.strip().lower()

    # Handle empty strings after stripping
    if not clean_str:
        return None

    # Handle current/present dates
    if clean_str in ["present", "current", "till date", "now", "ongoing"]:
        return datetime.date.today()

    # Try various date formats
    formats_to_try = [
        "%b %Y",  # Jan 2023
        "%B %Y",  # January 2023
        "%m/%Y",  # 01/2023
        "%Y",  # 2023 (will default to Jan 1st)
        "%Y-%m-%d",  # 2023-01-15
        "%m/%d/%Y",  # 01/15/2023
        "%d/%m/%Y",  # 15/01/2023
        "%Y/%m/%d",  # 2023/01/15
    ]

    for fmt in formats_to_try:
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except (ValueError, TypeError):
            continue

    # If all parsing fails, return None (field is optional anyway)
    return None


ParsableDate = Annotated[datetime.date | None, BeforeValidator(normalize_date_string)]


class WorkExperienceBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    company_name: str = Field(..., description="Name of the company")
    company_description: str | None = Field(
        None, description="A brief description of the company"
    )
    company_tags: list[str] = Field(
        default_factory=list, description="Tags associated with the company"
    )
    role_title: str = Field(..., description="The title of the role")
    role_description: str | None = Field(
        None, description="Description of the role and responsibilities"
    )
    role_tags: list[str] = Field(
        default_factory=list, description="Tags associated with the role"
    )
    start_date: ParsableDate = Field(None, description="Start date of the role")
    end_date: ParsableDate = Field(None, description="End date of the role")
    duration_months: (
        Annotated[float, Field(ge=0, description="Duration in months")] | None
    ) = None

    @model_validator(mode="before")
    @classmethod
    def calculate_duration_if_missing(cls, data: dict):
        try:
            if data.get("duration_months") is None:
                start = data.get("start_date")
                end = data.get("end_date")
                if start and end:
                    start_date = normalize_date_string(start)
                    end_date = normalize_date_string(end)
                    if isinstance(start_date, datetime.date) and isinstance(
                        end_date, datetime.date
                    ):
                        duration_days = (end_date - start_date).days
                        data["duration_months"] = max(0, duration_days / 30.44)
            return data
        except Exception:
            return data


class Internship(WorkExperienceBase):
    pass


class JobExperience(WorkExperienceBase):
    domain_tags: list[str] = Field(
        default_factory=list, description="Domain tags for the job"
    )
    achievements_summary: str | None = Field(
        None, description="A summary of key achievements"
    )


class Project(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    project_name: str = Field(..., description="The name of the project")
    project_description: str | None = Field(
        None, description="A brief description of the project"
    )
    technologies_used: list[str] = Field(
        default_factory=list, description="Technologies used in the project"
    )
    role_in_project: str | None = Field(
        None, description="The role played in the project"
    )
    tags: list[str] = Field(default_factory=list, description="Tags for the project")
    duration_months: (
        Annotated[float, Field(ge=0, description="Duration in months")] | None
    ) = None


class EducationLevel(str, Enum):
    TENTH_GRADE = "10th Grade"
    TWELFTH_GRADE = "12th Grade"
    DIPLOMA = "Diploma"
    UNDERGRADUATE = "Undergraduate"
    POSTGRADUATE = "Postgraduate"
    PHD = "PhD"
    OTHER = "Other"


class Education(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    level: EducationLevel = Field(..., description="Level of study")
    institution_name: str = Field(..., description="Name of the institution")
    degree_or_certificate: str = Field(
        ..., description="Name of the degree or certificate"
    )
    major_or_specialization: str | None = Field(
        None, description="Major or specialization"
    )
    year_of_passing: Annotated[int, Field(gt=1950, description="Year of graduation")]
    score: Annotated[
        float | None,
        Field(ge=0, le=100, default=None, description="Percentage or CGPA"),
    ] = None
    summary: str | None = Field(
        None, description="Brief summary for this qualification"
    )


class Candidate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_number: str | None = Field(
        None, pattern=r"^\+?[1-9]\d{1,14}$", description="E.164 format"
    )
    email: EmailStr = Field(..., description="The candidate's email address")
    location: str = Field(
        ..., description="Current city or state (location) of the candidate"
    )
    education: list[Education] = Field(
        default_factory=list, description="List of educational qualifications"
    )
    academic_summary: str | None = Field(
        None, description="General academic background summary"
    )
    internships: list[Internship] = Field(
        default_factory=list, description="List of internships"
    )
    projects: list[Project] = Field(
        default_factory=list, description="List of projects"
    )
    job_experiences: list[JobExperience] = Field(
        default_factory=list, description="List of job experiences"
    )
    skills: list[str] | None = Field(default_factory=list, description="List of skills")
    career_path_summary: str | None = Field(None, description="Summary of career path")
    total_years_experience: (
        Annotated[
            float, Field(ge=0, default=None, description="Total years of experience")
        ]
        | None
    ) = None
    key_domains: list[str] | None = Field(
        default_factory=list, description="Key domains of experience"
    )
    achievements: list[str] | None = Field(
        default_factory=list, description="List of achievements"
    )
    hobbies: list[str] | None = Field(
        default_factory=list, description="List of hobbies"
    )

    def to_text(self) -> str:
        """Converts candidate data into ANONYMIZED text for vector store."""
        pii_to_scrub = set()
        if self.first_name:
            pii_to_scrub.add(self.first_name)
        if self.last_name:
            pii_to_scrub.add(self.last_name)
        if self.first_name and self.last_name:
            pii_to_scrub.add(f"{self.first_name} {self.last_name}")
        if self.email:
            pii_to_scrub.add(self.email)
            pii_to_scrub.add(self.email.split("@")[0])
        if self.phone_number:
            pii_to_scrub.add(self.phone_number)

        # Filter out trivial strings and sort by length (desc)
        # This ensures "John Doe" is replaced before "John".
        pii_list = sorted(
            [pii for pii in pii_to_scrub if pii and len(pii) > 2], key=len, reverse=True
        )

        def _scrub(text: str | None) -> str | None:
            """Replaces all PII occurrences in a string."""
            if not text or not pii_list:
                return text

            scrubbed_text = text
            for pii in pii_list:
                # Use regex for case-insensitive, whole-word replacement
                try:
                    pattern = re.compile(r"\b" + re.escape(pii) + r"\b", re.IGNORECASE)
                    scrubbed_text = pattern.sub("[REDACTED]", scrubbed_text)
                except re.error:
                    # Fallback for complex PII strings that break regex (e.g., weird symbols)
                    pass
            return scrubbed_text

        def _scrub_list(items: list[str] | None) -> list[str]:
            """Scrubs a list of strings and filters out empty results."""
            if not items:
                return []
            scrubbed_list = []
            for item in items:
                scrubbed_item = _scrub(item)
                if scrubbed_item:  # Only add if not None or empty
                    scrubbed_list.append(scrubbed_item)
            return scrubbed_list

        sections = []

        # Career Summary
        if career_summary := _scrub(self.career_path_summary):
            sections.append(f"Career Summary: {career_summary}")

        # Experience
        if self.total_years_experience is not None:
            sections.append(
                f"Total Years of Experience: {self.total_years_experience:.1f}"
            )

        # Skills & Domains
        if self.skills:
            sections.append(f"Skills: {', '.join(self.skills)}")
        if self.key_domains:
            sections.append(f"Key Domains: {', '.join(self.key_domains)}")

        # Education (FIXED: Handle list of Education objects)
        if self.education:
            edu_parts = []
            for edu in self.education:
                # Scrub all string fields
                level = edu.level.value  # Enum value is safe
                degree = _scrub(edu.degree_or_certificate) or "[REDACTED DEGREE]"
                major = _scrub(edu.major_or_specialization)
                institution = _scrub(edu.institution_name) or "[REDACTED INSTITUTION]"

                edu_text = f"- {level}: {degree}"
                if major:
                    edu_text += f" in {major}"
                edu_text += f" from {institution}"
                if edu.score:
                    edu_text += f" (Score: {edu.score}%)"
                edu_text += f" - Graduated {edu.year_of_passing}"

                if edu_summary := _scrub(edu.summary):
                    edu_text += f"\n  Summary: {edu_summary}"
                edu_parts.append(edu_text)
            sections.append("Education:\n" + "\n".join(edu_parts))

        # Academic Summary
        if acad_summary := _scrub(self.academic_summary):
            sections.append(f"Academic Background: {acad_summary}")

        # Job Experience
        if self.job_experiences:
            job_texts = []
            for job in self.job_experiences:
                # Scrub all string fields
                role_title = _scrub(job.role_title) or "[REDACTED ROLE]"
                company_name = _scrub(job.company_name) or "[REDACTED COMPANY]"

                job_text = f"- {role_title} at {company_name}"
                if job.duration_months:
                    job_text += f" ({job.duration_months:.1f} months)"

                if role_desc := _scrub(job.role_description):
                    job_text += f"\n  Description: {role_desc}"
                if ach_summary := _scrub(job.achievements_summary):
                    job_text += f"\n  Achievements: {ach_summary}"

                if domain_tags := _scrub_list(job.domain_tags):
                    job_text += f"\n  Domains: {', '.join(domain_tags)}"
                job_texts.append(job_text)
            sections.append("Job Experience:\n" + "\n\n".join(job_texts))

        # Internships
        if self.internships:
            intern_texts = []
            for intern in self.internships:
                # Scrub all string fields
                role_title = _scrub(intern.role_title) or "[REDACTED ROLE]"
                company_name = _scrub(intern.company_name) or "[REDACTED COMPANY]"

                intern_text = f"- {role_title} at {company_name}"
                if intern.duration_months:
                    intern_text += f" ({intern.duration_months:.1f} months)"

                if intern_desc := _scrub(intern.role_description):
                    intern_text += f"\n  Description: {intern_desc}"
                intern_texts.append(intern_text)
            sections.append("Internship Experience:\n" + "\n".join(intern_texts))

        # Projects
        if self.projects:
            proj_texts = []
            for proj in self.projects:
                # Scrub all string fields
                project_name = _scrub(proj.project_name) or "[REDACTED PROJECT]"

                proj_text = f"- {project_name}"

                if proj_desc := _scrub(proj.project_description):
                    proj_text += f"\n  Description: {proj_desc}"
                if tech_used := _scrub_list(proj.technologies_used):
                    proj_text += f"\n  Technologies: {', '.join(tech_used)}"
                if proj_role := _scrub(proj.role_in_project):
                    proj_text += f"\n  Role: {proj_role}"
                proj_texts.append(proj_text)
            sections.append("Projects:\n" + "\n".join(proj_texts))

        # Achievements (Scrubbed)
        if scrubbed_achievements := _scrub_list(self.achievements):
            sections.append(
                "Key Achievements:\n"
                + "\n".join(f"- {ach}" for ach in scrubbed_achievements)
            )

        # Hobbies (Scrubbed)
        if scrubbed_hobbies := _scrub_list(self.hobbies):
            sections.append(f"Hobbies & Interests: {', '.join(scrubbed_hobbies)}")

        return "\n\n".join([sec for sec in sections if sec])
