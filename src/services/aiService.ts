import { GoogleGenAI, Modality } from "@google/genai";

interface VoiceSettings {
  voice: string;
  tone: string;
  speed: string;
  text: string;
}

// Convert base64 PCM string to a valid WAV Blob
function convertBase64PcmToWavBlob(base64: string, sampleRate: number = 24000): Blob {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  // PCM data is composed of 16-bit little-endian samples
  const pcmData = new Int16Array(len / 2);
  
  for (let i = 0; i < len; i += 2) {
    // Reconstruct 16-bit integer from two bytes
    const lowByte = binaryString.charCodeAt(i);
    const highByte = binaryString.charCodeAt(i + 1);
    const word = (highByte << 8) | lowByte;
    // Sign-extend to 16 bits if necessary.
    // In JS bitwise operations use 32-bit signed ints.
    // the binary | operation already handles it properly for short
    pcmData[i / 2] = word >= 0x8000 ? word - 0x10000 : word; 
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export async function generateAudio(
  text: string,
  settings: VoiceSettings,
  apiKey: string,
  modelString: string
): Promise<{ blob: Blob, textLength: number }> {
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  
  // Apply speed modifier to the prompt context if needed, though native speed control 
  // is limited in the basic TTS response. Tone can be slightly guided by prompting.
  let prompt = text;
  if (settings.tone !== 'Neutral' || settings.speed !== 'Normal') {
    prompt = `[Speak in a ${settings.tone.toLowerCase()} tone at a ${settings.speed.toLowerCase()} speed]: ${text}`;
  }
  
  // Voices supported for Gemini TTS: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'
  const response = await ai.models.generateContent({
    model: modelString,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO], // Use the Modality enum value "AUDIO"
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: settings.voice || 'Puck' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("No audio data returned from the API.");
  }

  const blob = convertBase64PcmToWavBlob(base64Audio, 24000);
  return { blob, textLength: text.length };
}

export async function generateCaptions(
  audioBlob: Blob,
  apiKey: string,
  modelString: string
): Promise<string> {
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  // Convert Blob to Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const mimeType = audioBlob.type || 'audio/wav';

  const prompt = `You are a professional transcriptionist. 
Listen to this audio and generate exact WebVTT file format captions.
Format your response exactly as a valid VTT file starting with 'WEBVTT'.
Include timestamps for the spoken words. Try to split captions into short, readable lines (e.g., 2-4 seconds per cue).
Return ONLY the raw WebVTT content. Do not include any introductory or concluding text.`;

  const response = await ai.models.generateContent({
    model: modelString,
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
      ]
    }]
  });

  let text = response.text || '';
  
  // Clean up markdown code blocks and intro text more aggressively
  const vttMatch = text.match(/WEBVTT[\s\S]*/i);
  if (vttMatch) {
    text = vttMatch[0];
  }
  
  // Also remove trailing markdown if it exists
  text = text.replace(/```.*/g, '').trim();

  return text;
}
