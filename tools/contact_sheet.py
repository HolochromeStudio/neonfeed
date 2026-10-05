import sys, os, glob
from PIL import Image, ImageDraw
def sheet(pattern, out, cols=8, cell=(150,120), scale=2, bg=(80,110,95)):
    files = sorted(glob.glob(pattern, recursive=True))
    rows = (len(files)+cols-1)//cols
    S = Image.new("RGB",(cols*cell[0], rows*cell[1]), bg)
    d = ImageDraw.Draw(S)
    for i,f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        k = min(scale, (cell[0]-8)/im.width, (cell[1]-18)/im.height)
        im2 = im.resize((max(1,int(im.width*k)), max(1,int(im.height*k))), Image.LANCZOS)
        x=(i%cols)*cell[0]; y=(i//cols)*cell[1]
        S.paste(im2,(x+(cell[0]-im2.width)//2, y+(cell[1]-18-im2.height)//2),im2)
        d.text((x+3,y+cell[1]-14), os.path.basename(f)[:24], fill=(255,255,255))
    S.save(out); print(len(files), out)
if __name__=="__main__":
    sheet(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 8,
          (int(sys.argv[4]),int(sys.argv[5])) if len(sys.argv)>5 else (150,120))
