with open('.github/workflows/class-bot.yml', 'r') as f:
    text2 = f.read()
text2 = text2.replace(
    "pactl set-default-source teams_sink.monitor",
    "pactl load-module module-null-sink sink_name=fake_mic sink_properties=device.description=FakeMic\n          pactl set-default-source fake_mic.monitor"
)
with open('.github/workflows/class-bot.yml', 'w') as f:
    f.write(text2)
