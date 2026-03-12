import os
from PIL import Image

src_assets_dir = r"C:\Users\luizcypriano\Documents\Python\Ferramenta_de_visitas\src\assets"
icones = [
    "Calendário de Visitas.png",
    "Planejar Visitas.png",
    "Registro de Visitas.png",
    "Relatórios Gerenciais.png"
]

for icone in icones:
    p = os.path.join(src_assets_dir, icone)
    if os.path.exists(p):
        img = Image.open(p)
        w, h = img.size
        # Crop 15% na direita e na base para sumir logo da IA
        crop_percent_x = int(w * 0.15)
        crop_percent_y = int(h * 0.15)
        
        # left, top, right, bottom
        cropped = img.crop((0, 0, w - crop_percent_x, h - crop_percent_y))
        cropped.save(p)
        print(f"Cropped {icone}")
