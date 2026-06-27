from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

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