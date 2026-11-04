import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { useCreateThread, useSendMessage } from "../../app-server/hooks";
import { useBranding } from "../../app/branding-context";
import type { v2 } from "../../protocol";
import { closeQuickPanel } from "../../platform/native";

function readBlobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read captured audio."));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Unable to read captured audio.")),
    );
    reader.readAsDataURL(blob);
  });
}

function readFileDataUrl(file: File): Promise<string> {
  return readBlobDataUrl(file);
}

export function QuickPanelPage() {
  const branding = useBranding();
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      audioStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !file.type.startsWith("image/")) {
      setImageFile(null);
      setError("Only image attachments are supported.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setError(null);
  }

  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen capture is unavailable.");
      return;
    }
    setIsCapturing(true);
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const canvas = document.createElement("canvas");
      canvas.width = settings.width ?? 1280;
      canvas.height = settings.height ?? 720;
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Screen capture is unavailable.");
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      setImageFile(new File([blob], "screen-capture.png", { type: "image/png" }));
    } catch {
      setError("Screen capture cancelled.");
    } finally {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      setIsCapturing(false);
    }
  }

  async function startRecording() {
    if (typeof MediaRecorder === "undefined") {
      setError("Audio recording is unavailable.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is unavailable.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void readBlobDataUrl(blob)
          .then(setAudioUrl)
          .catch(() => setError("Unable to read recorded audio."));
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        audioStreamRef.current = null;
      };
      audioStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Audio recording was cancelled.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }

  async function handleSubmit() {
    const text = message.trim();
    if ((!text && !imageFile && !audioUrl) || createThread.isPending || sendMessage.isPending) {
      return;
    }
    setError(null);
    try {
      const thread = await createThread.mutateAsync({});
      const input: v2.UserInput[] = [];
      if (text) {
        input.push({ type: "text", text, text_elements: [] });
      }
      if (imageFile) {
        input.push({ type: "image", url: await readFileDataUrl(imageFile) });
      }
      if (audioUrl) {
        input.push({ type: "audio", url: audioUrl });
      }
      await sendMessage.mutateAsync({ threadId: thread.thread.id, input });
      await closeQuickPanel();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send quick request.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-base-200 p-4">
      <section className="mx-auto max-w-xl rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Quick request</h1>
          <span className="text-xs text-base-content/60">
            {branding?.assistantName ?? "Ruxex"}
          </span>
        </div>
        <textarea
          aria-label="Quick request"
          className="textarea textarea-bordered min-h-24 w-full resize-none"
          disabled={createThread.isPending || sendMessage.isPending}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask something…"
          value={message}
        />
        <input
          accept="image/*"
          aria-label="Image attachment"
          className="hidden"
          onChange={handleImageChange}
          type="file"
        />
        {(imageFile || audioUrl) && (
          <p className="mt-2 text-xs text-base-content/70">
            {imageFile ? "Image attached" : "Audio recorded"}
            {imageFile && audioUrl ? " · audio recorded" : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            disabled={isCapturing}
            onClick={() => void captureScreen()}
            type="button"
          >
            {isCapturing ? "Capturing…" : "Capture screen"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              document.querySelector<HTMLInputElement>(
                'input[aria-label="Image attachment"]',
              )?.click()
            }
            type="button"
          >
            Attach image
          </button>
          {isRecording ? (
            <button
              className="btn btn-warning btn-sm"
              onClick={stopRecording}
              type="button"
            >
              Stop recording
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void startRecording()}
              type="button"
            >
              Record audio
            </button>
          )}
          <button
            className="btn btn-primary btn-sm ml-auto"
            disabled={
              createThread.isPending ||
              sendMessage.isPending ||
              (!message.trim() && !imageFile && !audioUrl)
            }
            onClick={() => void handleSubmit()}
            type="button"
          >
            {createThread.isPending || sendMessage.isPending ? "Sending…" : "Send"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
