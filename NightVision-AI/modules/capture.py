import cv2
import time

class VideoCaptureSource:
    def __init__(self, source_type='webcam', source_path=0):
        """
        source_type: 'webcam', 'video', or 'image'
        source_path: camera index (int) or file path (str)
        """
        self.source_type = source_type
        self.source_path = source_path
        self.cap = None
        self.static_image = None
        self.is_opened = False
        
        self.setup_source()

    def setup_source(self):
        if self.source_type == 'image':
            self.static_image = cv2.imread(self.source_path)
            if self.static_image is not None:
                self.is_opened = True
            else:
                print(f"Error: Unable to read image file {self.source_path}")
        else:
            # For webcam or video
            try:
                # If webcam, source_path should be integer
                src = int(self.source_path) if self.source_type == 'webcam' else self.source_path
                self.cap = cv2.VideoCapture(src)
                if self.cap.isOpened():
                    self.is_opened = True
                else:
                    print(f"Error: Unable to open capture source: {src}")
            except Exception as e:
                print(f"Error opening source: {e}")

    def read_frame(self):
        if not self.is_opened:
            return False, None

        if self.source_type == 'image':
            # Return same image continuously
            return True, self.static_image.copy()

        # Read from video/webcam
        ret, frame = self.cap.read()
        if not ret:
            if self.source_type == 'video':
                # Loop video
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
            else:
                return False, None
        return ret, frame

    def release(self):
        if self.cap is not None:
            self.cap.release()
            self.is_opened = False
