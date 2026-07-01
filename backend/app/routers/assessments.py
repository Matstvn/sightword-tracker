from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

@router.get("/", response_model=List[schemas.AssessmentResponse])
def get_assessments(db: Session = Depends(get_db)):
    """Fetch all assessments for dashboard analytics."""
    return (
        db.query(models.Assessment)
        .order_by(models.Assessment.created_at.desc())
        .all()
    )

@router.post("/", response_model=schemas.AssessmentResponse)
def create_assessment(assessment: schemas.AssessmentCreate, db: Session = Depends(get_db)):
    """
    Save a completed assessment.
    This saves the overall assessment record AND all the individual word results.
    """
    # 1. Create the Assessment record
    db_assessment = models.Assessment(
        learner_id=assessment.learner_id,
        level_tested=assessment.level_tested,
        total_words=assessment.total_words,
        correct_count=assessment.correct_count,
        mastery_percentage=assessment.mastery_percentage
    )
    db.add(db_assessment)
    db.flush()  # This gets the assessment.id without committing fully yet

    # 2. Create all the WordResult records
    for word_result in assessment.word_results:
        db_word_result = models.WordResult(
            assessment_id=db_assessment.id,
            word_id=word_result.word_id,
            is_correct=word_result.is_correct,
            response_time_ms=word_result.response_time_ms
        )
        db.add(db_word_result)

    # 3. Commit everything to the database
    db.commit()
    db.refresh(db_assessment)
    return db_assessment

@router.post("/practice-words", response_model=List[schemas.PracticeWordResponse])
def save_practice_words(payload: schemas.PracticeWordBase, db: Session = Depends(get_db)):
    """Save or update incorrect words that should be practiced later."""
    learner = db.query(models.Learner).filter(models.Learner.id == payload.learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    existing = (
        db.query(models.PracticeWord)
        .filter(models.PracticeWord.learner_id == payload.learner_id, models.PracticeWord.word_id == payload.word_id)
        .first()
    )

    if existing:
        existing.incorrect_count += payload.incorrect_count
        existing.last_practiced_at = datetime.now(timezone.utc)
    else:
        db.add(models.PracticeWord(
            learner_id=payload.learner_id,
            word_id=payload.word_id,
            incorrect_count=payload.incorrect_count,
        ))

    db.commit()
    return (
        db.query(models.PracticeWord)
        .filter(models.PracticeWord.learner_id == payload.learner_id)
        .order_by(models.PracticeWord.last_practiced_at.desc(), models.PracticeWord.created_at.desc())
        .all()
    )


@router.get("/learner/{learner_id}/practice-words", response_model=List[schemas.PracticeWordResponse])
def get_practice_words(learner_id: int, db: Session = Depends(get_db)):
    """Fetch words queued for later practice for a learner."""
    learner = db.query(models.Learner).filter(models.Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    return (
        db.query(models.PracticeWord)
        .filter(models.PracticeWord.learner_id == learner_id)
        .order_by(models.PracticeWord.last_practiced_at.desc(), models.PracticeWord.created_at.desc())
        .all()
    )


@router.get("/learner/{learner_id}", response_model=List[schemas.AssessmentResponse])
def get_learner_assessments(learner_id: int, db: Session = Depends(get_db)):
    """Fetch all assessment history for a specific learner."""
    assessments = db.query(models.Assessment).filter(
        models.Assessment.learner_id == learner_id
    ).order_by(models.Assessment.created_at.desc()).all()
    return assessments

@router.get("/{assessment_id}", response_model=schemas.AssessmentResponse)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Fetch a single assessment by ID with all word results."""
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment