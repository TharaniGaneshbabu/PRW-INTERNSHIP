var map = L.map('map').setView([13.0827, 80.2707], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let routeSteps = [];
let destination = "";

// 🗣️ Voice synthesis helper
function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'en-IN'; // Indian English
    msg.rate = 1;
    msg.pitch = 1;
    window.speechSynthesis.speak(msg);
}

async function findSafeRoute() {
    const start = document.getElementById("start").value.trim();
    const end = document.getElementById("end").value.trim();
    const navButton = document.getElementById("startNav");

    if (!start || !end) {
        alert("⚠️ Please enter both locations!");
        return;
    }

    speak(`Finding safest route from ${start} to ${end}`);

    // 1️⃣ Geocode start and end
    async function geocode(place) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${place}`);
        const data = await res.json();
        if (data.length === 0) throw new Error("Location not found");
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }

    let startCoord, endCoord;
    try {
        startCoord = await geocode(start);
        endCoord = await geocode(end);
    } catch (error) {
        alert("❌ Error: " + error.message);
        return;
    }

    // 2️⃣ Get safest route info from Flask backend
    const res = await fetch('/get_safest_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end })
    });
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    const safest = data.safest_route;

    // 3️⃣ Get real route + step instructions from OpenRouteService
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQzMjIxMjdmNjA0NTRlMDQ5ZDE3NWIzMzZlNzZlMjliIiwiaCI6Im11cm11cjY0In0="; // 🔑 Replace with your key
    const orsURL = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startCoord[1]},${startCoord[0]}&end=${endCoord[1]},${endCoord[0]}&instructions=true`;

    const routeRes = await fetch(orsURL);
    const routeData = await routeRes.json();

    if (!routeData.features) {
        alert("⚠️ Could not fetch route data.");
        return;
    }

    const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    routeSteps = routeData.features[0].properties.segments[0].steps;
    destination = end;

    // 4️⃣ Clear old routes
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) map.removeLayer(layer);
    });

    // 5️⃣ Draw the route
    const routeLine = L.polyline(coords, {
        color: 'limegreen',
        weight: 6,
        opacity: 0.9,
        smoothFactor: 1.5
    }).addTo(map);

    L.marker(startCoord).addTo(map).bindPopup(`<b>Start:</b> ${start}`).openPopup();
    L.marker(endCoord).addTo(map).bindPopup(`<b>Destination:</b> ${end}`);

    map.fitBounds(routeLine.getBounds());

    alert(`✅ Safest Route: ${safest.name}\nSafety Score: ${safest.safety_score}`);
    speak(`Safest route found with score ${safest.safety_score}.`);

    // Enable the Start Navigation button
    navButton.disabled = false;
    navButton.style.backgroundColor = "#1e90ff";
}

// 🎤 Trigger turn-by-turn voice navigation
function startVoiceNavigation() {
    if (!routeSteps.length) {
        alert("No route loaded yet!");
        return;
    }

    speak("Starting turn by turn navigation.");
    document.getElementById("startNav").disabled = true;
    document.getElementById("startNav").style.backgroundColor = "gray";

    let i = 0;
    const delay = 7000; // delay between steps (ms)

    const speakNext = () => {
        if (i < routeSteps.length) {
            const text = routeSteps[i].instruction
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ');
            speak(text);
            i++;
            setTimeout(speakNext, delay);
        } else {
            speak(`You have arrived safely at ${destination}.`);
        }
    };

    setTimeout(speakNext, 2000);
}
