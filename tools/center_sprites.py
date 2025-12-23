from PIL import Image
import sys
import os

def center_sprite(image_path):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # Get the bounding box of the non-transparent area
    bbox = img.getbbox()
    
    if not bbox:
        print(f"Skipping empty image: {image_path}")
        return

    # Calculate content width and height
    content_width = bbox[2] - bbox[0]
    content_height = bbox[3] - bbox[1]
    
    # Calculate the new top-left coordinates to center the content
    new_left = (width - content_width) // 2
    new_top = (height - content_height) // 2
    
    # Create a new empty image with transparent background
    new_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    
    # Paste the cropped content into the center
    content = img.crop(bbox)
    new_img.paste(content, (new_left, new_top))
    
    new_img.save(image_path)
    print(f"Centered {image_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python center_sprites.py <image_path> [image_path...]")
        sys.exit(1)
        
    for path in sys.argv[1:]:
        center_sprite(path)
