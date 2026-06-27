from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
import re

from .. import models, schemas
from ..database import get_db
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
# HELPER: SF1 Column Mapping
# ============================================================

def normalize_column_name(col: str) -> str:
    """Clean up column names for matching."""
    if not isinstance(col, str):
        return ""
    return col.strip().upper().replace(" ", "_")

def map_sf1_columns(df_columns: List[str]) -> dict:
    """
    Maps SF1 Excel columns to our database fields.
    Returns a dict with keys: 'lrn', 'first_name', 'last_name', 'grade_level', 'section'
    """
    mapping = {
        'lrn': None,
        'first_name': None,
        'last_name': None,
        'grade_level': None,
        'section': None,
    }

    # Common aliases for each field (case-insensitive, spaces handled)
    aliases = {
        'lrn': ['LRN', 'LEARNER_REFERENCE_NUMBER', 'REFERENCE_NUMBER', 'ID'],
        'first_name': ['FIRST_NAME', 'FIRSTNAME', 'GIVEN_NAME', 'NAME_FIRST', 'FIRST'],
        'last_name': ['LAST_NAME', 'LASTNAME', 'SURNAME', 'FAMILY_NAME', 'NAME_LAST', 'LAST'],
        'grade_level': ['GRADE_LEVEL', 'GRADE', 'GRADE_LVL', 'LEVEL', 'YEAR_LEVEL'],
        'section': ['SECTION', 'CLASS', 'DIVISION', 'GROUP'],
    }

    # Normalize actual dataframe columns
    normalized_cols = [normalize_column_name(c) for c in df_columns]

    for field, field_aliases in aliases.items():
        for idx, norm_col in enumerate(normalized_cols):
            if norm_col in field_aliases:
                mapping[field] = df_columns[idx]
                break
            for alias in field_aliases:
                if alias in norm_col or norm_col in alias:
                    mapping[field] = df_columns[idx]
                    break
            if mapping[field]:
                break

    return mapping

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
        # Read the entire Excel file (all sheets) to find the data sheet
        xl = pd.ExcelFile(io.BytesIO(contents))
        sheet_names = xl.sheet_names
        data_sheet = None
        for sheet in sheet_names:
            df_temp = pd.read_excel(xl, sheet_name=sheet, header=None)
            if not df_temp.empty and df_temp.iloc[0, 0] == "School Form 1 (SF 1) School Register":
                data_sheet = sheet
                break
        if not data_sheet:
            # Fallback: use the first non-empty sheet
            for sheet in sheet_names:
                df_temp = pd.read_excel(xl, sheet_name=sheet, header=None)
                if not df_temp.empty:
                    data_sheet = sheet
                    break
        if not data_sheet:
            raise HTTPException(status_code=400, detail="No data sheet found in the file.")

        df_raw = pd.read_excel(xl, sheet_name=data_sheet, header=None)

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse file: {str(e)}"
        )

    # 3. Locate the column headers row (the one with "LRN" and "NAME")
    header_row_idx = None
    for idx, row in df_raw.iterrows():
        row_str = row.astype(str).str.upper().str.strip()
        if 'LRN' in row_str.values and 'NAME' in row_str.values:
            header_row_idx = idx
            break

    if header_row_idx is None:
        raise HTTPException(
            status_code=400,
            detail="Could not find header row containing 'LRN' and 'NAME'. Please ensure this is a valid SF1 file."
        )

    # 4. Extract column indices from the header row
    header_row = df_raw.iloc[header_row_idx]
    col_map = {}
    for idx, val in enumerate(header_row):
        if isinstance(val, str):
            val_clean = val.strip().upper()
            if 'LRN' in val_clean:
                col_map['lrn'] = idx
            elif 'NAME' in val_clean and 'LAST' in val_clean:
                col_map['name'] = idx
            elif 'SEX' in val_clean:
                col_map['sex'] = idx
            elif 'BIRTH' in val_clean and 'DATE' in val_clean:
                col_map['birthdate'] = idx
            elif 'AGE' in val_clean and 'FRIDAY' in val_clean:
                col_map['age'] = idx
            elif 'MOTHER TONGUE' in val_clean:
                col_map['mother_tongue'] = idx
            elif 'IP' in val_clean and 'ETHNIC' in val_clean:
                col_map['ip'] = idx
            elif 'RELIGION' in val_clean:
                col_map['religion'] = idx
            elif 'BARANGAY' in val_clean:
                col_map['barangay'] = idx
            elif 'MUNICIPALITY' in val_clean or 'CITY' in val_clean:
                col_map['municipality'] = idx
            elif 'PROVINCE' in val_clean:
                col_map['province'] = idx

    # 5. Validate we found at least LRN and NAME
    if 'lrn' not in col_map or 'name' not in col_map:
        raise HTTPException(
            status_code=400,
            detail=f"Could not find LRN and NAME columns. Found: {list(col_map.keys())}. Header row: {header_row.tolist()}"
        )

    # 6. Extract Grade Level and Section from metadata rows
    grade_level = None
    section = None
    for idx in range(0, header_row_idx):
        row = df_raw.iloc[idx].astype(str).str.strip()
        for j, val in enumerate(row):
            if 'GRADE LEVEL' in val.upper():
                if j + 1 < len(row):
                    grade_level = row[j+1]
                    if grade_level and grade_level != 'nan':
                        grade_level = grade_level.strip()
            elif 'SECTION' in val.upper():
                if j + 1 < len(row):
                    section = row[j+1]
                    if section and section != 'nan':
                        section = section.strip()

    # 7. Process data rows
    learners_to_add = []
    errors = []
    success_count = 0
    skipped_count = 0

    for idx in range(header_row_idx + 1, len(df_raw)):
        row = df_raw.iloc[idx]
        if row.isnull().all():
            continue

        lrn_val = row[col_map['lrn']] if col_map['lrn'] < len(row) else None
        if pd.isna(lrn_val) or not isinstance(lrn_val, (int, float, str)):
            skipped_count += 1
            continue

        lrn = str(lrn_val).strip()
        if not lrn.isdigit() or len(lrn) < 10:
            skipped_count += 1
            continue

        name_val = row[col_map['name']] if col_map['name'] < len(row) else None
        if pd.isna(name_val) or not isinstance(name_val, str):
            skipped_count += 1
            continue

        name_parts = name_val.strip().split(',')
        if len(name_parts) < 2:
            skipped_count += 1
            continue

        last_name = name_parts[0].strip()
        first_and_middle = name_parts[1].strip()
        first_name_parts = first_and_middle.split()
        first_name = first_name_parts[0] if first_name_parts else ""

        # Check duplicate LRN
        existing = db.query(models.Learner).filter(models.Learner.lrn == lrn).first()
        if existing:
            skipped_count += 1
            continue

        learner = models.Learner(
            lrn=lrn,
            first_name=first_name,
            last_name=last_name,
            grade_level=grade_level,
            section=section
        )
        learners_to_add.append(learner)
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