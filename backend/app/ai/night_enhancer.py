import cv2
import numpy as np

class NightEnhancer:
    def __init__(self, clip_limit: float = 3.0, tile_grid_size: tuple = (8, 8)):
        self.clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    def enhance_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Enhances low-light night driving video frames using CLAHE in LAB color space.
        """
        if frame is None or frame.size == 0:
            return frame

        # Convert RGB to LAB color space
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # Apply CLAHE to L-channel (Luminance)
        enhanced_l = self.clahe.apply(l_channel)

        # Merge channels back
        enhanced_lab = cv2.merge((enhanced_l, a_channel, b_channel))
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        return enhanced_bgr

night_enhancer = NightEnhancer()
