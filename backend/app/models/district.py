from sqlalchemy import Column, Integer, String, Float, Enum
from app.database import Base
import enum

class Division(str, enum.Enum):
    JAMMU = "jammu"
    KASHMIR = "kashmir"

class District(Base):
    __tablename__ = "districts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    division = Column(Enum(Division), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    area_sqkm = Column(Float)
    population = Column(Integer)
    headquarters = Column(String(100))

# District data for all 20 districts
DISTRICTS_DATA = {
    "jammu_division": [
        {"name": "Jammu", "lat": 32.7266, "lng": 74.8570, "area": 2342, "population": 1526406},
        {"name": "Kathua", "lat": 32.3840, "lng": 75.5167, "area": 2502, "population": 615711},
        {"name": "Samba", "lat": 32.5522, "lng": 75.1192, "area": 904, "population": 318611},
        {"name": "Udhampur", "lat": 32.9160, "lng": 75.1419, "area": 2637, "population": 555357},
        {"name": "Reasi", "lat": 33.0800, "lng": 74.8300, "area": 1719, "population": 314714},
        {"name": "Rajouri", "lat": 33.3778, "lng": 74.3108, "area": 2630, "population": 619266},
        {"name": "Poonch", "lat": 33.7667, "lng": 74.0931, "area": 1674, "population": 476820},
        {"name": "Doda", "lat": 33.1500, "lng": 75.5500, "area": 8912, "population": 409576},
        {"name": "Ramban", "lat": 33.2453, "lng": 75.2356, "area": 1329, "population": 283313},
        {"name": "Kishtwar", "lat": 33.3167, "lng": 75.7667, "area": 1644, "population": 231037},
    ],
    "kashmir_division": [
        {"name": "Srinagar", "lat": 34.0837, "lng": 74.7973, "area": 1979, "population": 1269751},
        {"name": "Anantnag", "lat": 33.7311, "lng": 75.1547, "area": 3574, "population": 1070144},
        {"name": "Kulgam", "lat": 33.6447, "lng": 75.0194, "area": 410, "population": 422786},
        {"name": "Pulwama", "lat": 33.8742, "lng": 74.8942, "area": 1086, "population": 570060},
        {"name": "Shopian", "lat": 33.7167, "lng": 74.8333, "area": 312, "population": 265960},
        {"name": "Budgam", "lat": 33.9933, "lng": 74.7089, "area": 1361, "population": 735753},
        {"name": "Ganderbal", "lat": 34.2267, "lng": 74.7772, "area": 1049, "population": 297003},
        {"name": "Bandipora", "lat": 34.4167, "lng": 74.6500, "area": 345, "population": 385099},
        {"name": "Baramulla", "lat": 34.1980, "lng": 74.3636, "area": 4243, "population": 1015503},
        {"name": "Kupwara", "lat": 34.5267, "lng": 74.2542, "area": 2379, "population": 875564},
    ]
}
