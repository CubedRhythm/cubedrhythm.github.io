from PIL import Image, ImageOps
import sys
import os

def smart_slice(sheet_path, output_dir, output_prefix):
    img = Image.open(sheet_path).convert("RGBA")
    
    # improved detection: find separate objects
    # 1. Get alpha channel or convert to grayscale for thresholding
    # Assuming white background based on previous context, but let's handle transparent too
    # If background is white (255,255,255), we want to ignore it.
    
    # Create a mask: 1 where content exists, 0 where background
    # We'll assume background is white or transparent
    
    pixels = img.load()
    width, height = img.size
    
    visited = set()
    blobs = []
    
    # Simple flood fill or component finding
    # Since we can't use massive recursion, let's use a scanline or iterative approach
    # Actually, using a simple bounding box merger is better for this.
    
    # Let's simple scan for non-background pixels
    # Background definition: Alpha=0 OR (R>240 and G>240 and B>240)
    
    # Auto-detect background color from top-left pixel
    bg_r, bg_g, bg_b, bg_a = pixels[0, 0]
    
    def is_content(x, y):
        r, g, b, a = pixels[x, y]
        if a < 10: return False # Transparent is bg
        
        # Check distance from detected background color
        # Tolerance of 30
        if abs(r - bg_r) < 30 and abs(g - bg_g) < 30 and abs(b - bg_b) < 30:
            return False
            
        return True

    # Find connected components
    # Just simplistic "find bounding boxes of islands"
    
    # Iterative Blob detection
    # This acts like finding contours
    
    from collections import deque
    
    for y in range(height):
        for x in range(width):
            if (x, y) not in visited and is_content(x, y):
                # Found new blob
                min_x, max_x = x, x
                min_y, max_y = y, y
                stack = [(x, y)]
                visited.add((x, y))
                
                # Stack based flood fill to find extents
                idx = 0
                while idx < len(stack):
                    cx, cy = stack[idx]
                    idx += 1
                    
                    min_x = min(min_x, cx)
                    max_x = max(max_x, cx)
                    min_y = min(min_y, cy)
                    max_y = max(max_y, cy)
                    
                    # Check 4 neighbors
                    for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                         nx, ny = cx + dx, cy + dy
                         if 0 <= nx < width and 0 <= ny < height:
                             if (nx, ny) not in visited:
                                 if is_content(nx, ny):
                                     visited.add((nx, ny))
                                     stack.append((nx, ny))
                
                # Blob defined
                if (max_x - min_x) > 10 and (max_y - min_y) > 10: # Filter tiny noise
                    # Filter huge blobs (likely the whole page or borders)
                    if (max_x - min_x) < width * 0.9 and (max_y - min_y) < height * 0.9:
                        blobs.append((min_x, min_y, max_x, max_y))
    
    # Sort blobs: Top-to-bottom, then Left-to-right
    # Allow some slack for rows
    blobs.sort(key=lambda b: (b[1] // (height // 4), b[0])) 
    # Row heuristic: divide Y by rough row height to bucket them. 
    # Better: Sort by Y first. If Y difference is small, sort by X.
    
    def sort_key(b):
        return b[1] # primary sort by Y
        
    blobs.sort(key=sort_key)
    
    # Bucket into rows
    rows = []
    current_row = []
    if blobs:
        current_row_y = blobs[0][1]
        for b in blobs:
            if abs(b[1] - current_row_y) > 50: # New row if Y differs significantly
                rows.append(sorted(current_row, key=lambda b: b[0]))
                current_row = [b]
                current_row_y = b[1]
            else:
                current_row.append(b)
        rows.append(sorted(current_row, key=lambda b: b[0]))
    
    final_blobs = []
    for r in rows:
        final_blobs.extend(r)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    count = 0
    for i, bbox in enumerate(final_blobs):
        if count >= 8: break # Max 8 frames
        
        # Add a little padding
        pad = 2
        safe_box = (
            max(0, bbox[0]-pad), 
            max(0, bbox[1]-pad), 
            min(width, bbox[2]+1+pad), 
            min(height, bbox[3]+1+pad)
        )
        
        frame = img.crop(safe_box)
        output_path = os.path.join(output_dir, f"{output_prefix}_{i+1}.png")
        frame.save(output_path)
        print(f"Saved {output_path} (Size: {frame.size})")
        count += 1
        
    print(f"Extracted {count} sprites.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python smart_slice.py <sheet_path> <output_dir> [prefix]")
        sys.exit(1)
        
    sheet_path = sys.argv[1]
    output_dir = sys.argv[2]
    prefix = sys.argv[3] if len(sys.argv) > 3 else "sprite"
    smart_slice(sheet_path, output_dir, prefix)
