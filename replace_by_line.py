with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

lines[459] = '                    console.log([DEBUG] Sudden mass exodus detected! Recent max was , now . Ending meeting.);\n'
lines[464] = '                    console.log([DEBUG] Small meeting drop detected! Recent max was , now . Ending meeting.);\n'

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
