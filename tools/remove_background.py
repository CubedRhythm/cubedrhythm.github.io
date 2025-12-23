from PIL import Image
import os
import sys

def remove_white_background(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        # Get background color from top-left pixel
        bg_r, bg_g, bg_b, bg_a = pixels[0, 0]
        
        # Flood fill from all 4 corners to find connected background
        # This ensures we don't accidentally remove matching colors INSIDE the sprite
        queue = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
        visited = set(queue)
        
        background_pixels = set()
        
        while queue:
            x, y = queue.pop(0)
            
            # Identify this as background
            background_pixels.add((x, y))
            
            # Check neighbors
            for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    # Check if color matches background (tolerance)
                    r, g, b, a = pixels[nx, ny]
                    if abs(r - bg_r) < 50 and abs(g - bg_g) < 50 and abs(b - bg_b) < 50:
                        visited.add((nx, ny))
                        queue.append((nx, ny))

        # Apply transparency
        newData = []
        for y in range(height):
            for x in range(width):
                if (x, y) in background_pixels:
                    newData.append((255, 255, 255, 0))
                else:
                    newData.append(pixels[x, y])

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
