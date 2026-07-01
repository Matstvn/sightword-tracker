from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings


# Create the SQLAlchemy engine using validated settings
DATABASE_URL = settings.database_url

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=bool(settings.DEBUG),
    future=True,
)

# Create a SessionLocal class to interact with the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our ORM models (will be used in models.py)
Base = declarative_base()

# Dependency: This function will be used in our API routes to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()