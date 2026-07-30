import cv2
import numpy as np

def apply_clahe(frame, clip_limit=3.0, grid_size=(8, 8)):
    """
    Applies CLAHE on the L channel of LAB color space to enhance contrast
    without shifting colors.
    """
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=grid_size)
    cl = clahe.apply(l)
    
    limg = cv2.merge((cl, a, b))
    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    return enhanced

def apply_gamma(frame, gamma=1.5):
    """
    Applies Gamma Correction to brighten (gamma > 1) or darken (gamma < 1) the frame.
    """
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    return cv2.lookUpTable(frame, table)

def apply_noise_reduction(frame, d=5, sigma_color=75, sigma_space=75):
    """
    Applies Bilateral Filter to reduce noise while preserving edge boundaries.
    """
    return cv2.bilateralFilter(frame, d, sigma_color, sigma_space)

def apply_dehaze(frame):
    """
    A simple and fast dehazing approximation:
    Enhance local contrast (CLAHE) + Unsharp Masking + Bilateral Filter
    """
    # 1. Contrast adjustment
    enhanced = apply_clahe(frame, clip_limit=2.0)
    
    # 2. Unsharp Masking to restore sharpness lost in fog
    gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
    sharpened = cv2.addWeighted(enhanced, 1.5, gaussian, -0.5, 0)
    
    # 3. Smooth out noise
    final = apply_noise_reduction(sharpened, d=5, sigma_color=50, sigma_space=50)
    return final

def enhance_frame(frame, method="CLAHE", gamma_value=1.5):
    """
    Main enhancement entry point.
    method options: 'None', 'CLAHE', 'Gamma', 'Dehaze', 'Hybrid'
    """
    if method is None or method == "None":
        return frame
        
    if method == "CLAHE":
        return apply_clahe(frame)
    elif method == "Gamma":
        return apply_gamma(frame, gamma=gamma_value)
    elif method == "Dehaze":
        return apply_dehaze(frame)
    elif method == "Hybrid":
        # First brighten using Gamma, then improve contrast using CLAHE
        brightened = apply_gamma(frame, gamma=gamma_value)
        enhanced = apply_clahe(brightened, clip_limit=2.0)
        return apply_noise_reduction(enhanced, d=3)
    
    return frame
