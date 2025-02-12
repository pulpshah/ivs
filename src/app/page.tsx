"use client";

import { useEffect, useRef, useState } from "react";
import IVSBroadcastClient, {
  Errors,
  BASIC_LANDSCAPE,
} from "amazon-ivs-web-broadcast";

export default function Home() {
  const [client, setClient] = useState<any>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [devices, setDevices] = useState<{
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  }>({
    video: [],
    audio: [],
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<"pip" | "side-by-side">("pip");

  useEffect(() => {
    // Initialize IVS client
    const ivsClient = IVSBroadcastClient.create({
      streamConfig: IVSBroadcastClient.BASIC_LANDSCAPE,
      ingestEndpoint:
        "rtmps://c7a468ff1fce.global-contribute.live-video.net:443/app/",
    });
    setClient(ivsClient);

    // Get available devices
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          video: devices.filter((d) => d.kind === "videoinput"),
          audio: devices.filter((d) => d.kind === "audioinput"),
        });
      } catch (err) {
        console.error("Error getting devices:", err);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (client && canvasRef.current) {
      client.attachPreview(canvasRef.current);
    }
  }, [client]);

  const handlePermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Add camera to broadcast
      if (client) {
        client.addVideoInputDevice(stream, "camera1", {
          index: 0,
          position:
            layout === "pip"
              ? {
                  width: 0.25,
                  height: 0.25,
                  x: 0.7,
                  y: 0.7,
                }
              : {
                  width: 0.5,
                  height: 1,
                  x: 0,
                  y: 0,
                },
        });
        client.addAudioInputDevice(stream, "mic1");
      }

      return true;
    } catch (err) {
      console.error("Failed to get permissions:", err);
      return false;
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        if (client) {
          // Add video track
          client.addVideoInputDevice(screenStream, "screen1", {
            index: 1,
            position:
              layout === "pip"
                ? {
                    width: 1,
                    height: 1,
                    x: 0,
                    y: 0,
                  }
                : {
                    width: 0.5,
                    height: 1,
                    x: 0.5,
                    y: 0,
                  },
          });

          // Add audio track if it exists
          const audioTrack = screenStream.getAudioTracks()[0];
          if (audioTrack) {
            const audioStream = new MediaStream([audioTrack]);
            client.addAudioInputDevice(audioStream, "screen-audio");
          }
        }
        setIsScreenSharing(true);

        // Handle the case when user stops sharing through the browser's UI
        screenStream.getVideoTracks()[0].onended = () => {
          if (client) {
            client.removeVideoInputDevice("screen1");
            try {
              // Try to get the audio device before removing
              const audioDevice = client.getAudioInputDevice("screen-audio");
              if (audioDevice) {
                client.removeAudioInputDevice("screen-audio");
              }
            } catch (err) {
              // Ignore error if audio device doesn't exist
              console.log("No screen audio device to remove");
            }
          }
          setIsScreenSharing(false);
        };
      } else {
        if (client) {
          client.removeVideoInputDevice("screen1");
          try {
            // Try to get the audio device before removing
            const audioDevice = client.getAudioInputDevice("screen-audio");
            if (audioDevice) {
              client.removeAudioInputDevice("screen-audio");
            }
          } catch (err) {
            // Ignore error if audio device doesn't exist
            console.log("No screen audio device to remove");
          }
        }
        setIsScreenSharing(false);
      }
    } catch (err) {
      console.error("Failed to toggle screen share:", err);
      setIsScreenSharing(false);
    }
  };

  const toggleLayout = () => {
    const newLayout = layout === "pip" ? "side-by-side" : "pip";
    setLayout(newLayout);

    // Update positions of existing streams
    if (client) {
      const cameraDevice = client.getVideoInputDevice("camera1");
      const screenDevice = client.getVideoInputDevice("screen1");

      if (cameraDevice) {
        client.updateVideoDeviceComposition("camera1", {
          index: 0,
          position:
            newLayout === "pip"
              ? {
                  width: 0.25,
                  height: 0.25,
                  x: 0.7,
                  y: 0.7,
                }
              : {
                  width: 0.5,
                  height: 1,
                  x: 0,
                  y: 0,
                },
        });
      }

      if (screenDevice) {
        client.updateVideoDeviceComposition("screen1", {
          index: 1,
          position:
            newLayout === "pip"
              ? {
                  width: 1,
                  height: 1,
                  x: 0,
                  y: 0,
                }
              : {
                  width: 0.5,
                  height: 1,
                  x: 0.5,
                  y: 0,
                },
        });
      }
    }
  };

  const startBroadcast = async () => {
    try {
      const hasPermissions = await handlePermissions();
      if (!hasPermissions) return;

      const streamKey =
        "sk_us-east-1_NdHothZrG1a1_lBzSlBpHqbTRyS9ZwyJhZ4xASXi0Xt";
      await client.startBroadcast(streamKey);
      setIsBroadcasting(true);
    } catch (err) {
      console.error("Failed to start broadcast:", err);
    }
  };

  const stopBroadcast = () => {
    try {
      client.stopBroadcast();
      setIsBroadcasting(false);
      setIsScreenSharing(false);
    } catch (err) {
      console.error("Failed to stop broadcast:", err);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-8">IVS Broadcast Room</h1>

      <div className="mb-8">
        <canvas
          ref={canvasRef}
          className="border border-gray-300 rounded-lg"
          width={1280}
          height={720}
        />
      </div>

      <div className="flex gap-4 mb-4">
        {!isBroadcasting ? (
          <button
            onClick={startBroadcast}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Start Broadcasting
          </button>
        ) : (
          <button
            onClick={stopBroadcast}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
          >
            Stop Broadcasting
          </button>
        )}

        {isBroadcasting && (
          <>
            <button
              onClick={toggleScreenShare}
              className={`${
                isScreenSharing
                  ? "bg-purple-500 hover:bg-purple-600"
                  : "bg-green-500 hover:bg-green-600"
              } text-white px-6 py-2 rounded-lg`}
            >
              {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            </button>

            <button
              onClick={toggleLayout}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
            >
              {layout === "pip" ? "Switch to Side by Side" : "Switch to PiP"}
            </button>
          </>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Available Devices</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="font-medium mb-2">Video Devices</h3>
            <ul className="list-disc pl-5">
              {devices.video.map((device) => (
                <li key={device.deviceId}>
                  {device.label ||
                    `Video Device ${device.deviceId.slice(0, 8)}`}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Audio Devices</h3>
            <ul className="list-disc pl-5">
              {devices.audio.map((device) => (
                <li key={device.deviceId}>
                  {device.label ||
                    `Audio Device ${device.deviceId.slice(0, 8)}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
