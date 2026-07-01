from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from math import ceil

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/words", tags=["Sight Words"])


@router.get("/", response_model=List[schemas.SightWordResponse])
def get_words(
    response: Response,
    level: Optional[str] = Query(None, description="Filter by level (e.g., Pre-Primer, Grade 1)"),
    ids: Optional[str] = Query(None, description="Comma-separated list of word IDs"),
    search: Optional[str] = Query(None, description="Case-insensitive substring search on the word text"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    per_page: int = Query(20, ge=1, le=200, description="Items per page (max 200)"),
    order_by: Optional[str] = Query(None, description="Order by field: id, word, level"),
    order_dir: str = Query("asc", description="Order direction: asc or desc"),
    db: Session = Depends(get_db),
):
    """Fetch sight words with pagination, deterministic ordering, and stronger filters."""

    # Base query and filtering
    query = db.query(models.SightWord)

    if is_active is not None:
        query = query.filter(models.SightWord.is_active == is_active)

    if level:
        query = query.filter(models.SightWord.level == level)

    if ids:
        id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
        if id_list:
            query = query.filter(models.SightWord.id.in_(id_list))

    if search:
        # simple case-insensitive contains
        query = query.filter(models.SightWord.word.ilike(f"%{search}%"))

    # Deterministic ordering: default by id asc
    allowed_order_fields = {
        "id": models.SightWord.id,
        "word": models.SightWord.word,
        "level": models.SightWord.level,
    }

    order_column = allowed_order_fields.get((order_by or "id").lower(), models.SightWord.id)
    order_dir = (order_dir or "asc").lower()
    if order_dir == "desc":
        order_column = order_column.desc()

    query = query.order_by(order_column, models.SightWord.id)

    # Pagination calculation
    total = query.count()
    total_pages = ceil(total / per_page) if per_page else 1
    offset = (page - 1) * per_page

    items = query.offset(offset).limit(per_page).all()

    # Set pagination headers
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Total-Pages"] = str(total_pages)
    response.headers["X-Page"] = str(page)
    response.headers["X-Per-Page"] = str(per_page)

    return items