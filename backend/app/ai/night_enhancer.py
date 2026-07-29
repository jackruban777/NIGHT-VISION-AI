import cv2
import numpy as np

class NightEnhancer:
    def __init__(self, clip_limit: float = 2.5, tile_grid_size: tuple = (8, 8), brightness_threshold: float = 85.0):
        self.clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        self.brightness_threshold = brightness_threshold

    def enhance_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Fast Conditional Night Enhancer for DMS & Cabin Night Driver Stream:
        Checks average frame brightness in Grayscale.
        If scene is dark (< 85 brightness), applies adaptive CLAHE on Luminance (LAB channel)
        and auto-gamma correction to bring out dark eye/mouth facial landmarks.
        """
        if frame is None or frame.size == 0:
            return frame

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray))

        # Skip enhancement if ambient light is sufficient
        if mean_brightness >= self.brightness_threshold:
            return frame

        # 1. Apply fast CLAHE to L-channel in LAB space for dark/night frames
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        enhanced_l = self.clahe.apply(l_channel)
        enhanced_lab = cv2.merge((enhanced_l, a_channel, b_channel))
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        # 2. Apply light Adaptive Gamma Adjustment for ultra-dark regions
        if mean_brightness < 45.0:
            gamma = 1.35
            inv_gamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
            enhanced_bgr = cv2.LUT(enhanced_bgr, table)

        return enhanced_bgr

night_enhancer = NightEnhancer()
