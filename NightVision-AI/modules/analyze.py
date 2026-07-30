# Distance Estimation and Risk Analysis

# Approximate real-world heights (in meters) of standard classes
REAL_WORLD_HEIGHTS = {
    'Pedestrian': 1.7,
    'Stray Cow': 1.4,
    'Stray Animal': 0.8,
    'Vehicle': 1.5,
    'Bike': 1.4,
    'Pothole': 0.3 # Potholes are shallow, we estimate distance differently for road surface
}

# Focal length approximation in pixels for a standard webcam/camera (assuming 640x480 resolution)
FOCAL_LENGTH = 550.0 

def estimate_distance(detection, frame_height):
    """
    Estimates distance (in meters) to the object using standard monocular depth approximation.
    For road objects, distance is: (Real Height * Focal Length) / Bbox Height in Pixels.
    For potholes, distance is approximated based on y-coordinate position relative to the horizon.
    """
    label = detection['label']
    box = detection['box'] # [x1, y1, x2, y2]
    
    bbox_height = max(1, box[3] - box[1])
    y_bottom = box[3]
    
    # 1. Road Surface (Pothole) Distance Estimation
    # Potholes are located on the ground. The closer the bottom of the box is to the bottom
    # of the frame, the closer it is to the vehicle.
    if label == 'Pothole':
        # Let's assume horizon is at 50% of the screen (height * 0.5)
        horizon = frame_height * 0.5
        denom = max(1.0, y_bottom - horizon)
        # Empirical distance calculation for ground surface objects
        distance = (frame_height * 0.4) / denom
        return round(max(0.5, distance), 1)

    # 2. Vertical Objects (Pedestrians, Vehicles, Animals)
    real_height = REAL_WORLD_HEIGHTS.get(label, 1.5)
    
    # Distance formula: (Real Height * Focal Length) / Bbox Height
    distance = (real_height * FOCAL_LENGTH) / bbox_height
    return round(max(0.5, distance), 1)

def evaluate_risk(distance, high_threshold=8.0, med_threshold=15.0):
    """
    Evaluates collision risk level.
    """
    if distance <= high_threshold:
        return "High"
    elif distance <= med_threshold:
        return "Medium"
    else:
        return "Low"

def analyze_hazards(detections, frame_shape, high_threshold=8.0, med_threshold=15.0):
    """
    Takes a list of detections, estimates distance and risk for each.
    Returns the list with 'distance' and 'risk' added.
    """
    h, w, _ = frame_shape
    
    for det in detections:
        dist = estimate_distance(det, h)
        risk = evaluate_risk(dist, high_threshold, med_threshold)
        
        det['distance'] = dist
        det['risk'] = risk
        
    # Sort detections so closest hazards are processed first
    detections.sort(key=lambda x: x['distance'])
    return detections
