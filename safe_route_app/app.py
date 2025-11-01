from flask import Flask, render_template, request, jsonify
import requests
import pandas as pd
import math

app = Flask(__name__)

# --- Load Safety Data ---
data = pd.read_csv("safety_data.csv")

# --- Helper: Haversine formula ---
def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dlon / 2)**2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c

# --- Helper: Geocode place names into coordinates using OpenStreetMap ---
def get_coordinates(place_name):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={place_name}"
    try:
        response = requests.get(url, headers={'User-Agent': 'safe-route-app'})
        data = response.json()
        if data:
            return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print("Geocoding error:", e)
    return None, None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get_safest_route', methods=['POST'])
def get_safest_route():
    data_req = request.json
    start_name = data_req['start']
    end_name = data_req['end']

    # Convert names to coordinates
    start_lat, start_lng = get_coordinates(start_name)
    end_lat, end_lng = get_coordinates(end_name)

    if not start_lat or not end_lat:
        return jsonify({'error': 'Invalid location entered! Please try again.'})

    # Simulate multiple routes (A, B, C)
    routes = [
        {'name': 'Route A', 'path': [(start_lat, start_lng), (end_lat, end_lng)]},
        {'name': 'Route B', 'path': [(start_lat + 0.01, start_lng), (end_lat, end_lng + 0.01)]},
        {'name': 'Route C', 'path': [(start_lat, start_lng + 0.01), (end_lat + 0.01, end_lng)]}
    ]

    # --- Calculate Real Safety Score using safety_data.csv ---
    for route in routes:
        nearest = data.iloc[((data['latitude'] - route['path'][0][0])**2 +
                             (data['longitude'] - route['path'][0][1])**2).idxmin()]

        lighting = nearest['lighting']
        crowd = nearest['crowd']
        police = nearest['police_distance']
        crime = nearest['crime_rate']

        # Weighted safety formula
        score = (0.4 * lighting) + (0.3 * crowd) + (0.2 * (1 - crime)) + (0.1 * (1 - police))
        route['safety_score'] = round(score, 2)

    # --- Choose the safest route ---
    safest = max(routes, key=lambda r: r['safety_score'])

    return jsonify({'safest_route': safest, 'all_routes': routes})

if __name__ == '__main__':
    app.run(debug=True)
