import time
import threading
import queue

# Try to import winsound for native Windows sound alerts, fallback to print/beep on other OS
import sys
if sys.platform == "win32":
    import winsound
else:
    winsound = None

import pyttsx3

class AlertSystem:
    def __init__(self, rate=150, audio_enabled=True):
        self.audio_enabled = audio_enabled
        self.speech_rate = rate
        self.msg_queue = queue.Queue()
        self.last_announced = {} # Track last time a label was spoken to prevent repeat spam
        self.cooldown_period = 6.0 # 6 seconds cooldown per object label alert
        
        # Start background TTS thread
        self.stop_event = threading.Event()
        self.worker_thread = threading.Thread(target=self._tts_worker, daemon=True)
        if self.audio_enabled:
            self.worker_thread.start()

    def _tts_worker(self):
        """
        Background worker that processes voice alerts sequentially so it doesn't block
        the main real-time inference loop.
        """
        # Engine must be initialized inside the thread it is used in
        try:
            engine = pyttsx3.init()
            engine.setProperty('rate', self.speech_rate)
        except Exception as e:
            print(f"Failed to initialize pyttsx3 speech engine: {e}")
            return

        while not self.stop_event.is_set():
            try:
                # Retrieve voice alert from queue, wait up to 0.5s
                msg = self.msg_queue.get(timeout=0.5)
                engine.say(msg)
                engine.runAndWait()
                self.msg_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error during TTS speech synthesis: {e}")

    def trigger_beep(self, frequency=1000, duration=200):
        """
        Triggers a short warning beep sound asynchronously to prevent frame stutter.
        """
        if not self.audio_enabled:
            return

        def beep_thread():
            if winsound:
                try:
                    winsound.Beep(frequency, duration)
                except Exception:
                    pass
            else:
                # System beep fallback
                print("\a", end="")

        threading.Thread(target=beep_thread, daemon=True).start()

    def trigger_voice(self, label, distance):
        """
        Adds a warning phrase to the speech queue.
        Example: "Warning: Stray Cow ahead"
        """
        if not self.audio_enabled:
            return

        current_time = time.time()
        last_time = self.last_announced.get(label, 0)

        # Check if the warning was already spoken within the cooldown period
        if (current_time - last_time) >= self.cooldown_period:
            self.last_announced[label] = current_time
            warning_msg = f"Warning: {label} detected ahead."
            if distance < 8.0:
                warning_msg = f"Danger! {label} very close!"
            
            # Put in queue for background speaking
            self.msg_queue.put(warning_msg)

    def shutdown(self):
        self.stop_event.set()
        if self.worker_thread.is_alive():
            self.worker_thread.join(timeout=1.0)
