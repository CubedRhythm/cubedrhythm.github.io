from PIL import Image
import os
import sys

def remove_white_background(image_path):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Change all white (also shades of whites) to transparent
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(image_path, "PNG")
        print(f"Processed {image_path}")
    except Exception as e:
        print(f"Failed to process {image_path}: {e}")

if __name__ == "__main__":
    assets_dir = 'assets'
    files = [
        'cat_run_1.png',
        'cat_run_2.png',
        'cat_attack.png',
        'zombie_dino.png' 
    ]
    
    # Also check for dino variants if I add them later, but for now just these.
    # Actually, let's just process all pngs in assets except background.png
    
    for filename in os.listdir(assets_dir):
        if filename.endswith(".png") and filename != "background.png":
            file_path = os.path.join(assets_dir, filename)
            remove_white_background(file_path)
