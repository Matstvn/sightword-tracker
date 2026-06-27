from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Learner(Base):
    __tablename__ = "learners"

    id = Column(Integer, primary_key=True, index=True)
    lrn = Column(String(20), unique=True, index=True, nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    grade_level = Column(String(10), nullable=True)
    section = Column(String(50), nullable=True)
    current_level = Column(String(20), default='Pre-Primer')  # <-- ADD THIS LINE
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assessments = relationship("Assessment", back_populates="learner", cascade="all, delete-orphan")


class SightWord(Base):
    __tablename__ = "sight_words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(50), unique=True, index=True, nullable=False)
    level = Column(String(20), nullable=False)  # e.g., Pre-Primer, Primer, Grade 1
    is_active = Column(Boolean, default=True)

    # Relationship: A word can be in many word results
    word_results = relationship("WordResult", back_populates="word")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    learner_id = Column(Integer, ForeignKey("learners.id", ondelete="CASCADE"), nullable=False)
    level_tested = Column(String(20), nullable=True)
    total_words = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    mastery_percentage = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    learner = relationship("Learner", back_populates="assessments")
    word_results = relationship("WordResult", back_populates="assessment", cascade="all, delete-orphan")


class WordResult(Base):
    __tablename__ = "word_results"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    word_id = Column(Integer, ForeignKey("sight_words.id", ondelete="CASCADE"), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=True)  # Future use for fluency tracking

    # Relationships
    assessment = relationship("Assessment", back_populates="word_results")
    word = relationship("SightWord", back_populates="word_results")