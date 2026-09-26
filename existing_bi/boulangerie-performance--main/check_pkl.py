import pickle
import os

# Chercher les fichiers .pkl
pkl_files = [f for f in os.listdir('.') if f.endswith('.pkl')]
print('Fichiers .pkl trouvés:', pkl_files)

if pkl_files:
    with open(pkl_files[0], 'rb') as f:
        data = pickle.load(f)
    print('Clés dans le fichier .pkl:')
    for key in data.keys():
        print(f'  - {key}: {type(data[key])}')
    
    # Structure forecast_saison
    fs = data.get('forecast_saison')
    print('\nStructure forecast_saison:')
    print(f'Type: {type(fs)}')
    if hasattr(fs, 'columns'):
        print(f'Colonnes: {list(fs.columns)}')
        print(f'Shape: {fs.shape}')
        print(f'\nPremières lignes:')
        print(fs.head())
