import os
from PIL import Image

def remove_background_color(input_path, output_path, bg_color=(28, 78, 63), tolerance=60):
    print(f"Processando: {input_path}")
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # Pega r, g, b, a
        r, g, b, a = item
        
        # Verifica se o pixel está próximo da cor de fundo
        # Usa uma tolerância simples
        if abs(r - bg_color[0]) < tolerance and abs(g - bg_color[1]) < tolerance and abs(b - bg_color[2]) < tolerance:
            newData.append((255, 255, 255, 0)) # Fundo transparente
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Salvo: {output_path}")

# Como não sabemos a cor exata do verde (se é (28, 78, 63)), podemos também verificar o pixel (0,0) (canto superior esquerdo)
def remove_background_corner_color(input_path, output_path, tolerance=50):
    print(f"Processando com base no pixel 0,0: {input_path}")
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    width, height = img.size
    
    # Pega cor do canto superior esquerdo para usar como referência de fundo
    bg_color = img.getpixel((2, 2))
    if len(bg_color) == 4:
         bg_color = bg_color[:3]
         
    newData = []
    for item in datas:
        r, g, b, a = item
        if abs(r - bg_color[0]) < tolerance and abs(g - bg_color[1]) < tolerance and abs(b - bg_color[2]) < tolerance:
            newData.append((255, 255, 255, 0)) # Fundo transparente
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    
icone_dir = r"C:\Users\luizcypriano\Documents\Python\Ferramenta_de_visitas\Icones"
src_assets_dir = r"C:\Users\luizcypriano\Documents\Python\Ferramenta_de_visitas\src\assets"

icones = [
    "Calendário de Visitas.png",
    "Planejar Visitas.png",
    "Registro de Visitas.png",
    "Relatórios Gerenciais.png"
]

for icone in icones:
    input_p = os.path.join(icone_dir, icone)
    output_p = os.path.join(src_assets_dir, icone)
    if os.path.exists(input_p):
        remove_background_corner_color(input_p, output_p, tolerance=40)
    else:
        print(f"Nao encontrado: {input_p}")

print("Fim do processamento de imagens.")
