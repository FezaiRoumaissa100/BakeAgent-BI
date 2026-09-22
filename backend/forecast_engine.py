import pandas as pd
import numpy as np

def safe_num(v, default=0.0):
    try:
        if pd.isna(v) or np.isnan(v) or np.isinf(v):
            return default
        return float(v)
    except:
        return default

def get_forecast_data(daily_data_raw, forecast_14j_raw, forecast_sais_raw, mdape_cv_val):
    # History
    daily_data = daily_data_raw.copy()
    if 'date' in daily_data.columns:
        daily_data = daily_data.rename(columns={'date': 'ds'})
    daily_data['ds'] = pd.to_datetime(daily_data['ds'])
    
    nb_articles_col = 'nb_articles' if 'nb_articles' in daily_data.columns else 'ca_jour'
    moy_jour = safe_num(daily_data[nb_articles_col].mean())

    history_tail = daily_data.sort_values('ds').tail(60)
    history_series = []
    for _, r in history_tail.iterrows():
        history_series.append({
            "ds": r['ds'].strftime('%Y-%m-%d'),
            "label": r['ds'].strftime('%d/%m'),
            "y": safe_num(r[nb_articles_col])
        })

    # 14 days forecast
    fc14 = forecast_14j_raw.copy()
    if 'ds' not in fc14.columns and 'date' in fc14.columns:
        fc14 = fc14.rename(columns={'date': 'ds'})
    fc14['ds'] = pd.to_datetime(fc14['ds'])
    
    jours_map = {'Monday': 'Lundi', 'Tuesday': 'Mardi', 'Wednesday': 'Mercredi',
                 'Thursday': 'Jeudi', 'Friday': 'Vendredi', 'Saturday': 'Samedi', 'Sunday': 'Dimanche'}
    
    forecast_14j_list = []
    for i, (_, r) in enumerate(fc14.iterrows()):
        dow_en = r['ds'].strftime('%A')
        forecast_14j_list.append({
            "horizon": f"J+{i+1}",
            "ds": r['ds'].strftime('%Y-%m-%d'),
            "date_fr": r['ds'].strftime('%d/%m/%Y'),
            "jour_semaine": jours_map.get(dow_en, dow_en),
            "yhat": int(round(safe_num(r.get('yhat', 0)))),
            "yhat_lower": int(round(safe_num(r.get('yhat_lower', 0)))),
            "yhat_upper": int(round(safe_num(r.get('yhat_upper', 0)))),
            "is_ferme": int(r.get('is_ferme', 0) if 'is_ferme' in r else (1 if r.get('yhat', 0) == 0 else 0))
        })

    total_14j = sum(item['yhat'] for item in forecast_14j_list)

    # Season forecast (Juin - Sept)
    season_series = []
    if forecast_sais_raw is not None and not forecast_sais_raw.empty:
        fs = forecast_sais_raw.copy()
        if 'ds' not in fs.columns and 'date' in fs.columns:
            fs = fs.rename(columns={'date': 'ds'})
        fs['ds'] = pd.to_datetime(fs['ds'])
        for _, r in fs.sort_values('ds').iterrows():
            season_series.append({
                "ds": r['ds'].strftime('%Y-%m-%d'),
                "label": r['ds'].strftime('%d/%m'),
                "yhat": int(round(safe_num(r.get('yhat', 0)))),
                "yhat_lower": int(round(safe_num(r.get('yhat_lower', 0)))),
                "yhat_upper": int(round(safe_num(r.get('yhat_upper', 0)))),
            })

    return {
        "metrics": {
            "mdape_cv": safe_num(mdape_cv_val, 20.9),
            "moy_jour_historique": moy_jour,
            "total_prevision_14j": total_14j,
            "horizon_jours": 14
        },
        "history": history_series,
        "forecast_14j": forecast_14j_list,
        "forecast_season": season_series
    }
