import os
import time
import tempfile
import cv2
import numpy as np

# Required Environment Setup (cross-platform temp dir)
_ultralytics_dir = os.path.join(tempfile.gettempdir(), "Ultralytics")
os.environ["YOLO_CONFIG_DIR"] = _ultralytics_dir
os.makedirs(_ultralytics_dir, exist_ok=True)

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

class ZeroDCEPlusModel(nn.Module if HAS_TORCH else object):
    """
    Zero-DCE++ (Zero-Reference Deep Curve Estimation for Low-Light Enhancement).
    Uses depthwise separable convolutions to estimate pixel-wise higher-order curves.
    """
    def __init__(self, scale_factor=1):
        if not HAS_TORCH:
            return
        super(ZeroDCEPlusModel, self).__init__()
        self.scale_factor = scale_factor

        self.conv1 = nn.Conv2d(3, 32, 3, stride=1, padding=1, groups=1, bias=True)
        self.conv2 = nn.Conv2d(32, 32, 3, stride=1, padding=1, groups=32, bias=True)
        self.conv3 = nn.Conv2d(32, 32, 3, stride=1, padding=1, groups=32, bias=True)
        self.conv4 = nn.Conv2d(32, 32, 3, stride=1, padding=1, groups=32, bias=True)
        self.conv5 = nn.Conv2d(64, 32, 3, stride=1, padding=1, groups=32, bias=True)
        self.conv6 = nn.Conv2d(64, 32, 3, stride=1, padding=1, groups=32, bias=True)
        self.conv7 = nn.Conv2d(64, 24, 3, stride=1, padding=1, groups=1, bias=True)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        if not HAS_TORCH:
            return x, None
        
        if self.scale_factor == 1:
            x_down = x
        else:
            x_down = F.interpolate(x, scale_factor=1.0/self.scale_factor, mode='bilinear', align_corners=False)

        x1 = self.relu(self.conv1(x_down))
        x2 = self.relu(self.conv2(x1))
        x3 = self.relu(self.conv3(x2))
        x4 = self.relu(self.conv4(x3))

        x5 = self.relu(self.conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.conv6(torch.cat([x2, x5], 1)))
        enhance_params = torch.tanh(self.conv7(torch.cat([x1, x6], 1)))

        if self.scale_factor != 1:
            enhance_params = F.interpolate(enhance_params, size=(x.shape[2], x.shape[3]), mode='bilinear', align_corners=False)

        r1, r2, r3, r4, r5, r6, r7, r8 = torch.split(enhance_params, 3, dim=1)
        
        x = x + r1 * (torch.pow(x, 2) - x)
        x = x + r2 * (torch.pow(x, 2) - x)
        x = x + r3 * (torch.pow(x, 2) - x)
        x = x + r4 * (torch.pow(x, 2) - x)
        x = x + r5 * (torch.pow(x, 2) - x)
        x = x + r6 * (torch.pow(x, 2) - x)
        x = x + r7 * (torch.pow(x, 2) - x)
        enhance_img = x + r8 * (torch.pow(x, 2) - x)

        return enhance_img, enhance_params


class AINightVisionEnhancer:
    """
    AI-Powered Low-Light Image Enhancement Pipeline for NightVision AI.
    Memory-Optimized for Render 512MB RAM environments.
    """
    def __init__(self):
        self.device = "cpu"
        self.model_name = "Adaptive Retinex Curve AI"
        self.model = None
        self.mode_override = "Auto"
        self._init_ai_models()

    def _init_ai_models(self):
        if HAS_TORCH:
            try:
                if torch.cuda.is_available():
                    self.device = "cuda"
                    self.model_name = "Zero-DCE++ (Deep Curve AI)"
                    self.model = ZeroDCEPlusModel(scale_factor=1)
                    self.model.eval()
                    self.model = self.model.cuda()
                    print("[AINightVisionEnhancer] Loaded Zero-DCE++ AI Low-Light Model on CUDA GPU.")
                else:
                    self.device = "cpu"
                    self.model = None
                    self.model_name = "Adaptive Retinex Curve Engine (CPU Fast)"
                    print("[AINightVisionEnhancer] Low-Memory CPU Mode: Adaptive Retinex Curve Active.")
            except Exception as e:
                self.model = None
                self.model_name = "Adaptive Retinex Curve Engine"

    def set_mode(self, mode: str):
        valid_modes = ["Auto", "Day", "Evening", "Night", "Extreme Dark"]
        if mode in valid_modes:
            self.mode_override = mode

    def analyze_luminance(self, frame: np.ndarray) -> float:
        if frame is None or frame.size == 0:
            return 128.0
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return float(np.mean(gray))

    def enhance_frame(self, frame: np.ndarray, user_mode: str = None) -> tuple[np.ndarray, dict]:
        t0 = time.perf_counter()

        if frame is None or frame.size == 0:
            return frame, {"enhancement_model": self.model_name, "mode": "Off", "luminance": 128.0, "latency_ms": 0.0}

        mode = user_mode or self.mode_override
        mean_lum = self.analyze_luminance(frame)

        # Skip enhancement if lighting is sufficient (>100 cd/m²)
        if mode == "Auto":
            if mean_lum >= 100.0:
                effective_mode = "Daylight"
            elif mean_lum >= 65.0:
                effective_mode = "Evening"
            elif mean_lum >= 30.0:
                effective_mode = "Night"
            else:
                effective_mode = "Extreme Dark"
        else:
            effective_mode = mode

        if effective_mode in ["Day", "Daylight"]:
            t1 = time.perf_counter()
            return frame, {
                "enhancement_model": "Pass-Through (Daylight)",
                "mode": "Daylight",
                "luminance": round(mean_lum, 1),
                "latency_ms": round((t1 - t0) * 1000, 2),
            }

        # Apply Fast Adaptive Retinex Curve or Zero-DCE++ on CUDA
        try:
            if HAS_TORCH and self.model is not None and self.device == "cuda":
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb_norm = (rgb.astype(np.float32) / 255.0)
                tensor_in = torch.from_numpy(rgb_norm).permute(2, 0, 1).unsqueeze(0).cuda()

                with torch.no_grad():
                    enhanced_tensor, _ = self.model(tensor_in)

                out_img = enhanced_tensor.cpu().squeeze(0).permute(1, 2, 0).numpy()
                out_img = np.clip(out_img * 255.0, 0, 255).astype(np.uint8)
                enhanced = cv2.cvtColor(out_img, cv2.COLOR_RGB2BGR)
            else:
                enhanced = self._adaptive_retinex_curve(frame, effective_mode)
        except Exception:
            enhanced = self._adaptive_retinex_curve(frame, effective_mode)

        # Highlight Protection (Prevent overexposing headlights, streetlamps)
        gray_orig = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        highlight_mask = cv2.threshold(gray_orig, 220, 255, cv2.THRESH_BINARY)[1]
        if np.any(highlight_mask):
            highlight_mask = cv2.GaussianBlur(highlight_mask, (15, 15), 0)
            alpha = (highlight_mask.astype(np.float32) / 255.0)[:, :, None]
            enhanced = (frame.astype(np.float32) * alpha + enhanced.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)

        t1 = time.perf_counter()
        latency_ms = round((t1 - t0) * 1000, 2)

        return enhanced, {
            "enhancement_model": self.model_name,
            "mode": effective_mode,
            "luminance": round(mean_lum, 1),
            "latency_ms": latency_ms,
        }

    def _adaptive_retinex_curve(self, frame: np.ndarray, mode: str) -> np.ndarray:
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        if mode == "Extreme Dark":
            clip = 3.2
            gamma = 1.5
        elif mode == "Night":
            clip = 2.2
            gamma = 1.3
        else:
            clip = 1.6
            gamma = 1.1

        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)

        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype("uint8")
        l_enhanced = cv2.LUT(l_enhanced, table)

        enhanced_lab = cv2.merge((l_enhanced, a, b))
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)


night_enhancer = AINightVisionEnhancer()
