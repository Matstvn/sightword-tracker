from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/words", tags=["Sight Words"])

@router.get("/", response_model=List[schemas.SightWordResponse])
def get_words(
    level: Optional[str] = Query(None, description="Filter by level (e.g., Pre-Primer, Grade 1)"),
    ids: Optional[str] = Query(None, description="Comma-separated list of word IDs"),
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Fetch sight words. Optionally filter by level or by a list of IDs."""
    query = db.query(models.SightWord).filter(models.SightWord.is_active == True)
    
    if level:
        query = query.filter(models.SightWord.level == level)
    
    if ids:
        id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
        if id_list:
            query = query.filter(models.SightWord.id.in_(id_list))
    
    words = query.limit(limit).all()
    return words