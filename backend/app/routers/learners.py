from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io

from .. import models, schemas
from ..database import get_db
from ..utils.import_helpers import (
    find_sf1_data_sheet,
    find_header_row_idx,
    build_column_map,
    extract_grade_section_metadata,
    parse_learner_row,
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/learners", tags=["Learners"])

# ============================================================
# SCHEMAS
# ============================================================

class LevelUpdate(BaseModel):
    level: str

class BulkLearnerCreate(BaseModel):
    lrn: Optional[str] = None
    first_name: str
    last_name: str
    grade_level: Optional[str] = None
    section: Optional[str] = None
    sex: Optional[str] = None

# ============================================================
# PUT /{learner_id}/level - UPDATE LEARNER LEVEL
# ============================================================

@router.put("/{learner_id}/level")
def update_learner_level(
    learner_id: int,
    level_update: LevelUpdate,
    db: Session = Depends(get_db)
):
    print(f"🔵 Received PUT request for learner {learner_id}")
    print(f"🔵 New level: {level_update.level}")
    """Update a learner's current level."""
    learner = db.query(models.Learner).filter(models.Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    print(f"🔵 Current level in DB: {learner.current_level}")
    # Validate the level exists in our list
    valid_levels = ['Pre-Primer', 'Primer', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']
    if level_update.level not in valid_levels:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid level. Must be one of: {valid_levels}"
        )
    
    learner.current_level = level_update.level
    db.commit()
    db.refresh(learner)
    
    return {
        "message": "Level updated successfully",
        "learner_id": learner_id,
        "current_level": learner.current_level
    }

# ============================================================
# GET / - FETCH ALL LEARNERS
# ============================================================

@router.get("/", response_model=List[schemas.LearnerResponse])
def get_learners(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search by name or LRN"),
    db: Session = Depends(get_db)
):
    """Fetch a list of learners. Optionally search by name or LRN."""
    query = db.query(models.Learner)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.Learner.first_name.like(search_term)) |
            (models.Learner.last_name.like(search_term)) |
            (models.Learner.lrn.like(search_term))
        )
    
    learners = query.offset(skip).limit(limit).all()
    return learners
@router.delete("/{learner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learner(
    learner_id: int,
    db: Session = Depends(get_db)
):
    """Delete a learner by ID."""
    learner = db.query(models.Learner).filter(models.Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    
    db.delete(learner)
    db.commit()
    return None
# ============================================================
# GET /{learner_id} - FETCH SINGLE LEARNER
# ============================================================

@router.get("/{learner_id}", response_model=schemas.LearnerResponse)
def get_learner(learner_id: int, db: Session = Depends(get_db)):
    """Fetch a single learner by ID."""
    learner = db.query(models.Learner).filter(models.Learner.id == learner_id).first()
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    return learner

# ============================================================
# POST / - CREATE A SINGLE LEARNER
# ============================================================

@router.post("/", response_model=schemas.LearnerResponse)
def create_learner(learner: schemas.LearnerCreate, db: Session = Depends(get_db)):
    """Add a new learner to the database."""
    db_learner = models.Learner(**learner.dict())
    db.add(db_learner)
    db.commit()
    db.refresh(db_learner)
    return db_learner

# ============================================================
# POST /bulk - BULK IMPORT LEARNERS
# ============================================================

@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def bulk_import_learners(
    learners: List[BulkLearnerCreate],
    db: Session = Depends(get_db)
):
    """
    Accept an array of learner objects and insert them all.
    Skips duplicates based on LRN.
    """
    imported = 0
    skipped = 0
    errors = []

    for learner_data in learners:
        # Skip if LRN is missing or invalid
        if not learner_data.lrn:
            skipped += 1
            continue

        # Check for duplicate LRN
        existing = db.query(models.Learner).filter(models.Learner.lrn == learner_data.lrn).first()
        if existing:
            skipped += 1
            continue

        try:
            new_learner = models.Learner(
                lrn=learner_data.lrn,
                first_name=learner_data.first_name,
                last_name=learner_data.last_name,
                grade_level=learner_data.grade_level,
                section=learner_data.section,
                # current_level will default to 'Pre-Primer'
            )
            db.add(new_learner)
            imported += 1
        except Exception as e:
            errors.append(f"LRN {learner_data.lrn}: {str(e)}")
            skipped += 1

    db.commit()

    return {
        "message": "Bulk import completed",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
    }

# ============================================================
# POST /import/sf1 - SF1 FILE IMPORT
# ============================================================

@router.post("/import/sf1", status_code=status.HTTP_201_CREATED)
async def import_sf1(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import learners from an SF1 Excel file (DepEd LIS format).
    Handles the official SF1 template with multi-row headers and merged cells.
    """
    # 1. Validate file extension
    filename = file.filename or ""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    if ext not in ['xlsx', 'xls']:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload .xlsx or .xls files."
        )

    # 2. Read the file into a pandas DataFrame
    try:
        contents = await file.read()
        xl = pd.ExcelFile(io.BytesIO(contents))
        data_sheet = find_sf1_data_sheet(xl)
        if not data_sheet:
            raise HTTPException(status_code=400, detail="No data sheet found in the file.")

        df_raw = pd.read_excel(xl, sheet_name=data_sheet, header=None)

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse file: {str(e)}"
        )

    header_row_idx = find_header_row_idx(df_raw)
    if header_row_idx is None:
        raise HTTPException(
            status_code=400,
            detail="Could not find header row containing 'LRN' and 'NAME'. Please ensure this is a valid SF1 file."
        )

    header_row = df_raw.iloc[header_row_idx]
    col_map = build_column_map(header_row)
    if 'lrn' not in col_map or 'name' not in col_map:
        raise HTTPException(
            status_code=400,
            detail=f"Could not find LRN and NAME columns. Found: {list(col_map.keys())}. Header row: {header_row.tolist()}"
        )

    grade_level, section = extract_grade_section_metadata(df_raw, header_row_idx)

    learners_to_add = []
    errors = []
    success_count = 0
    skipped_count = 0

    for idx in range(header_row_idx + 1, len(df_raw)):
        parsed = parse_learner_row(df_raw.iloc[idx], col_map)
        if not parsed:
            skipped_count += 1
            continue

        existing = db.query(models.Learner).filter(models.Learner.lrn == parsed['lrn']).first()
        if existing:
            skipped_count += 1
            continue

        learners_to_add.append(models.Learner(
            lrn=parsed['lrn'],
            first_name=parsed['first_name'],
            last_name=parsed['last_name'],
            grade_level=grade_level,
            section=section
        ))
        success_count += 1

    # 8. Bulk insert
    if learners_to_add:
        try:
            db.bulk_save_objects(learners_to_add)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Database error while importing: {str(e)}"
            )

    # 9. Return summary
    return {
        "message": "Import completed",
        "total_rows_in_file": len(df_raw) - header_row_idx - 1,
        "successfully_imported": success_count,
        "skipped_rows": skipped_count,
        "errors": errors[:10],
        "grade_level": grade_level,
        "section": section,
        "column_mapping_used": col_map,
    }