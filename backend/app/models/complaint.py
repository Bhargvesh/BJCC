from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ComplaintStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class ComplaintCategory(str, enum.Enum):
    ROADS = "roads"
    WATER_SUPPLY = "water_supply"
    ELECTRICITY = "electricity"
    SANITATION = "sanitation"
    HOSPITAL = "hospital"
    TRAFFIC = "traffic"
    EDUCATION = "education"
    PUBLIC_TRANSPORT = "public_transport"
    OTHER = "other"

class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Complaint(Base):
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String(20), unique=True, nullable=False)
    
    # Citizen info
    citizen_name = Column(String(100), nullable=False)
    citizen_phone = Column(String(15), nullable=False)
    citizen_email = Column(String(100))
    
    # Complaint details
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(ComplaintCategory), nullable=False)
    
    # AI-generated fields
    ai_category = Column(Enum(ComplaintCategory))
    severity = Column(Enum(SeverityLevel), default=SeverityLevel.MEDIUM)
    severity_score = Column(Float, default=0.5)
    
    # Location
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)
    address = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Status tracking
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.PENDING)
    assigned_to = Column(Integer, ForeignKey("admins.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)
    
    # Media
    attachments = Column(Text)  # JSON string of file URLs
    
    # Relationships
    district = relationship("District", backref="complaints")
    
    # Language of original complaint
    original_language = Column(String(10), default="en")
