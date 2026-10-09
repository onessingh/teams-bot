import wave, struct
with wave.open('bot/silence.wav', 'w') as f:
    f.setnchannels(1) # mono
    f.setsampwidth(2) # 16-bit
    f.setframerate(44100)
    # 1 second of silence
    data = struct.pack('<h', 0) * 44100
    f.writeframes(data)
