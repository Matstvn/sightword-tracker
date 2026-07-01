from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# ======== Learner Schemas ========
class LearnerBase(BaseModel):
    lrn: Optional[str] = None
    first_name: str
    last_name: str
    grade_level: Optional[str] = None
    section: Optional[str] = None

class LearnerCreate(LearnerBase):
    pass

class LearnerResponse(LearnerBase):
    id: int
    created_at: datetime
    current_level: Optional[str] = 'Pre-Primer'  # <-- ADDED

    class Config:
        orm_mode = True

# ======== SightWord Schemas ========
class SightWordBase(BaseModel):
    word: str
    level: str
    is_active: bool = True

class SightWordResponse(SightWordBase):
    id: int

    class Config:
        orm_mode = True

# ======== WordResult Schemas ========
class WordResultBase(BaseModel):
    word_id: int
    is_correct: bool
    response_time_ms: Optional[int] = None

class WordResultResponse(WordResultBase):
    id: int
    assessment_id: int
    word: Optional[SightWordResponse] = None

    class Config:
        orm_mode = True


class PracticeWordBase(BaseModel):
    learner_id: int
    word_id: int
    incorrect_count: int = 1


class PracticeWordResponse(PracticeWordBase):
    id: int
    last_practiced_at: datetime
    created_at: datetime
    word: Optional[SightWordResponse] = None

    class Config:
        orm_mode = True

# ======== Assessment Schemas ========
class AssessmentBase(BaseModel):
    learner_id: int
    level_tested: Optional[str] = None
    total_words: int = 0
    correct_count: int = 0
    mastery_percentage: float = 0.0

class AssessmentCreate(AssessmentBase):
    word_results: List[WordResultBase]

class AssessmentResponse(AssessmentBase):
    id: int
    created_at: datetime
    word_results: List[WordResultResponse] = []

    class Config:
        orm_mode = True