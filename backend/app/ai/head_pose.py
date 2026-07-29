import cv2
import numpy as np
from typing import Dict, List, Tuple

class HeadPoseEstimator:
    def __init__(self):
        # Generic 3D Facial Model Reference Points (mm)
        self.model_points_3d = np.array([
            (0.0, 0.0, 0.0),             # Nose tip
            (0.0, -330.0, -65.0),        # Chin
            (-225.0, 170.0, -135.0),     # Left eye corner
            (225.0, 170.0, -135.0),      # Right eye corner
            (-150.0, -150.0, -125.0),    # Left mouth corner
            (150.0, -150.0, -125.0)      # Right mouth corner
        ], dtype=np.float64)

    def estimate_head_pose(self, landmark_points_2d: List[Tuple[int, int]], frame_shape: Tuple[int, int]) -> Dict:
        """
        Calculates 3D Head Pose Euler Angles (Pitch, Yaw, Roll) using OpenCV SolvePnP.
        
        Args:
          landmark_points_2d: List of 6 2D points corresponding to model_points_3d.
          frame_shape: (height, width) of video frame.
          
        Returns:
          Dict containing pitch, yaw, roll (in degrees), head_orientation string, and looking_away boolean.
        """
        if not landmark_points_2d or len(landmark_points_2d) < 6:
            return {
                "pitch": 0.0,
                "yaw": 0.0,
                "roll": 0.0,
                "orientation": "Centered / Normal",
                "looking_away": False,
                "head_down": False
            }

        h, w = frame_shape
        image_points_2d = np.array(landmark_points_2d[:6], dtype=np.float64)

        # Approximate Camera Intrinsic Matrix (Pinhole Model)
        focal_length = float(w)
        center = (w / 2.0, h / 2.0)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1), dtype=np.float64) # Assuming no lens distortion

        try:
            # Solve Perspective-n-Point Problem
            success, rvec, tvec = cv2.solvePnP(
                self.model_points_3d,
                image_points_2d,
                camera_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE
            )

            if not success:
                return self._default_pose()

            # Convert Rotation Vector to Rotation Matrix
            rotation_mat, _ = cv2.Rodrigues(rvec)
            
            # Combine into Projection Matrix to extract Euler Angles
            proj_matrix = np.hstack((rotation_mat, tvec))
            _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

            pitch = float(euler_angles[0][0])
            yaw = float(euler_angles[1][0])
            roll = float(euler_angles[2][0])

            # Classify Head Orientation
            orientations = []
            head_down = False
            looking_away = False

            if pitch < -15.0:
                orientations.append("Head Down / Nodding")
                head_down = True
            elif pitch > 20.0:
                orientations.append("Head Up / Distracted")

            if yaw < -20.0:
                orientations.append("Looking Left")
                looking_away = True
            elif yaw > 20.0:
                orientations.append("Looking Right")
                looking_away = True

            if abs(roll) > 22.0:
                orientations.append("Head Tilt")

            if abs(yaw) > 25.0 or pitch < -22.0 or pitch > 25.0:
                looking_away = True

            orientation_label = " / ".join(orientations) if orientations else "Centered / Road Focused"

            return {
                "pitch": round(pitch, 1),
                "yaw": round(yaw, 1),
                "roll": round(roll, 1),
                "orientation": orientation_label,
                "looking_away": looking_away,
                "head_down": head_down
            }

        except Exception as e:
            return self._default_pose()

    def _default_pose(self) -> Dict:
        return {
            "pitch": 0.0,
            "yaw": 0.0,
            "roll": 0.0,
            "orientation": "Centered / Road Focused",
            "looking_away": False,
            "head_down": False
        }

head_pose_estimator = HeadPoseEstimator()
