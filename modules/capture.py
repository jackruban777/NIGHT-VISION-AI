import cv2
import threading
import queue
import time
import sys


def scan_cameras(max_index=5):
    """
    Scan and return a list of available camera indices.
    Uses DirectShow on Windows for reliability.
    """
    found = []
    backend = cv2.CAP_DSHOW if sys.platform == 'win32' else cv2.CAP_ANY
    for i in range(max_index):
        cap = cv2.VideoCapture(i, backend)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                found.append({'index': i, 'width': w, 'height': h})
            cap.release()
    return found

class ThreadedCamera:
    """
    High-performance threaded camera reader.
    Runs capture on a dedicated background thread so the main thread
    is never blocked waiting for the next frame.
    """

    def __init__(self, source=0, width=1280, height=720, fps=30):
        self.source = source
        self.width = width
        self.height = height
        self.fps = fps
        self.cap = None
        self.frame_queue = queue.Queue(maxsize=2)  # Only keep latest 2 frames
        self.is_running = False
        self.is_opened = False
        self._lock = threading.Lock()
        self._thread = None
        self._last_frame = None
        self.actual_width = width
        self.actual_height = height
        self._setup()

    def _setup(self):
        try:
            backends = []
            if sys.platform == 'win32':
                backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
            else:
                backends = [cv2.CAP_ANY]

            for backend in backends:
                try:
                    self.cap = cv2.VideoCapture(self.source, backend)
                    if self.cap.isOpened():
                        ret, _ = self.cap.read()
                        if ret:
                            break
                    self.cap.release()
                except Exception:
                    continue

            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                self.cap.set(cv2.CAP_PROP_FPS, self.fps)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                try:
                    self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                except Exception:
                    pass
                self.actual_width  = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                self.actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                self.is_opened = True
                self._start_thread()
            else:
                self.is_opened = False
        except Exception as e:
            print(f"[ThreadedCamera] Setup error: {e}")
            self.is_opened = False

    def _start_thread(self):
        self.is_running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self):
        """Background thread: continuously reads frames and puts in queue."""
        while self.is_running and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret:
                # Drain queue before adding new frame to avoid stale frames
                with self._lock:
                    if not self.frame_queue.full():
                        self.frame_queue.put(frame)
                    else:
                        try:
                            self.frame_queue.get_nowait()  # Drop oldest
                        except queue.Empty:
                            pass
                        self.frame_queue.put(frame)
                self._last_frame = frame
            else:
                time.sleep(0.01)

    def read(self):
        """Non-blocking read: always returns latest frame immediately."""
        try:
            frame = self.frame_queue.get(timeout=0.05)
            self._last_frame = frame
            return True, frame
        except queue.Empty:
            if self._last_frame is not None:
                return True, self._last_frame.copy()
            return False, None

    def get_resolution(self):
        return self.actual_width, self.actual_height

    def release(self):
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()
        self.is_opened = False


class VideoFileSource:
    """Reads from a video file, loops automatically."""
    def __init__(self, path, width=1280, height=720):
        self.cap = cv2.VideoCapture(str(path))
        self.width = width
        self.height = height
        self.is_opened = self.cap.isOpened()
        self.actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) if self.is_opened else width
        self.actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) if self.is_opened else height

    def read(self):
        ret, frame = self.cap.read()
        if not ret:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()
        if frame is not None and (frame.shape[1] != self.width or frame.shape[0] != self.height):
            frame = cv2.resize(frame, (self.width, self.height), interpolation=cv2.INTER_LINEAR)
        return ret, frame

    def get_resolution(self):
        return self.actual_width, self.actual_height

    def release(self):
        self.cap.release()
        self.is_opened = False


class StaticImageSource:
    """Loops a single static image as if it were a live feed."""
    def __init__(self, path, width=1280, height=720):
        img = cv2.imread(str(path))
        self.width = width
        self.height = height
        if img is not None:
            self.frame = cv2.resize(img, (width, height), interpolation=cv2.INTER_LANCZOS4)
            self.is_opened = True
        else:
            self.frame = None
            self.is_opened = False

    def read(self):
        if self.frame is None:
            return False, None
        return True, self.frame.copy()

    def get_resolution(self):
        return self.width, self.height

    def release(self):
        self.is_opened = False
