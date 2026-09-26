import nbformat
import os

here = os.path.dirname(os.path.abspath(__file__))
nb_path = os.path.join(here, "Retail_Final_Mariem_Dridi (8) (1).ipynb")

nb = nbformat.read(nb_path, as_version=4)

for i, c in enumerate(nb.cells[:60]):
    if c.cell_type == "raw":
        continue
    print(f"\n===== CELL {i}  [{c.cell_type.upper()}] =====")
    src = c.source or ""
    if len(src) > 3500:
        print(src[:3500] + "\n...[TRUNCATED]")
    else:
        print(src)
