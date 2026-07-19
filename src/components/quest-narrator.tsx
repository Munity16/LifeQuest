"use client";

import { Radio, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type NarrationState = "idle" | "connecting" | "playing";

export function QuestNarrator({ campaignId, questId, title, storyIntro, objective, isDemo }: { campaignId: string; questId: string; title: string; storyIntro: string; objective: string; isDemo: boolean }) {
  const [state, setState] = useState<NarrationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    window.speechSynthesis?.cancel();
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setState("idle");
  }

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    peerRef.current?.close();
  }, []);

  function playDeviceDemo() {
    if (!("speechSynthesis" in window)) {
      setError("Device speech is not available in this browser.");
      return;
    }
    setError(null);
    const utterance = new SpeechSynthesisUtterance(`${title}. ${storyIntro}. Your objective: ${objective}`);
    utterance.rate = 0.92;
    utterance.pitch = 0.86;
    utterance.onstart = () => setState("playing");
    utterance.onend = () => setState("idle");
    utterance.onerror = () => { setState("idle"); setError("Device speech could not play."); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function playLiveNarration() {
    setState("connecting");
    setError(null);
    try {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTransceiver("audio", { direction: "recvonly" });
      peer.ontrack = (event) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.srcObject = event.streams[0];
        void audio.play();
      };
      peer.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(peer.connectionState)) setState("idle");
      };
      const channel = peer.createDataChannel("oai-events");
      channel.onopen = () => {
        channel.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: [{ type: "input_text", text: "Read the server-supplied quest briefing now." }] },
        }));
        channel.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"] } }));
        setState("playing");
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const query = new URLSearchParams({ campaignId, questId });
      const response = await fetch(`/api/realtime/narration?${query}`, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp });
      if (!response.ok) throw new Error("OpenAI narration could not connect.");
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (caught) {
      peerRef.current?.close();
      peerRef.current = null;
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Narration could not start.");
    }
  }

  return (
    <div className="quest-narrator">
      <audio ref={audioRef} autoPlay aria-label="Quest narration" />
      <span className="quest-narrator-mode"><Radio size={13} /> {isDemo ? "Device voice demo" : "OpenAI live voice"}</span>
      {state === "idle" ? (
        <button type="button" onClick={() => isDemo ? playDeviceDemo() : void playLiveNarration()}><Volume2 size={16} /> Hear quest briefing</button>
      ) : (
        <button type="button" onClick={stop}><Square size={14} /> {state === "connecting" ? "Connecting..." : "Stop narration"}</button>
      )}
      {error && <span className="quest-narrator-error" role="alert">{error}</span>}
    </div>
  );
}
