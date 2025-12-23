from PIL import Image
import sys
import os

def slice_sheet(sheet_path, output_dir, num_frames):
    img = Image.open(sheet_path)
    rows = 2
    cols = 4
    width, height = img.size
    frame_width = width // cols
    frame_height = height // rows
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            if i >= num_frames: break
            
            left = c * frame_width
            top = r * frame_height
            right = left + frame_width
            bottom = top + frame_height
            
            box = (left, top, right, bottom)
            frame = img.crop(box)
            output_path = os.path.join(output_dir, f"ptero_fly_{i+1}.png")
            frame.save(output_path)
            print(f"Saved {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python slice_sheet.py <sheet_path>")
        sys.exit(1)
        
    sheet_path = sys.argv[1]
    output_dir = "assets" 
    slice_sheet(sheet_path, output_dir, 8)
