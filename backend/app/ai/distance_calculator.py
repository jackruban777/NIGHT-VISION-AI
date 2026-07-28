from app.config import settings

class DistanceCalculator:
    def estimate_distance(self, bbox_height_px: float, object_class: str) -> float:
        """
        Estimates distance in meters using pinhole camera formula:
        distance = (focal_length_px * real_height_m) / bbox_height_px
        """
        if bbox_height_px <= 0:
            return 999.0

        real_height = settings.AVERAGE_CAR_HEIGHT_M
        if object_class.lower() in ["pedestrian", "person", "dog", "deer"]:
            real_height = settings.AVERAGE_PEDESTRIAN_HEIGHT_M
        elif object_class.lower() in ["truck", "bus"]:
            real_height = 3.2
        elif object_class.lower() in ["pothole", "speed breaker", "traffic cone"]:
            real_height = 0.5

        distance = (settings.CAMERA_FOCAL_LENGTH_PX * real_height) / bbox_height_px
        return round(float(distance), 1)

distance_calculator = DistanceCalculator()
