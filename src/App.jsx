import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const categories = [
  "Καθαριότητα / Σκουπίδια",
  "Οδικό δίκτυο / Λακκούβες",
  "Πεζοδρόμια / Προσβασιμότητα",
  "Δημοτικός φωτισμός",
  "Πάρκα / Πράσινο / Δέντρα",
  "Παιδικές χαρές",
  "Στάθμευση / Parking",
  "Κυκλοφοριακό / Σημάνσεις",
  "ΑμεΑ / Ράμπες / Προσβασιμότητα",
  "Ύδρευση / Διαρροές νερού",
  "Αποχέτευση / Φρεάτια",
  "Ανακύκλωση",
  "Παράνομα ογκώδη αντικείμενα",
  "Αδέσποτα / Ζώα",
  "Θόρυβος / Οχληρία",
  "Παράνομη στάθμευση",
  "Εγκαταλελειμμένα οχήματα",
  "Αστική ασφάλεια",
  "Βανδαλισμοί / Γκράφιτι",
  "Παραλία / Παράκτιο μέτωπο",
  "Δημόσια κτίρια / Υποδομές",
  "Πολιτιστικοί / Αθλητικοί χώροι",
  "Ψηφιακές υπηρεσίες δήμου",
  "Ιδέα βελτίωσης / Νέα πρόταση",
  "Άλλο"
];

const statuses = ["Νέα", "Υπό εξέταση", "Σε εξέλιξη", "Ολοκληρώθηκε", "Απορρίφθηκε"];

export default function App() {
  const [view, setView] = useState("citizen");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Όλες");
  const [statusFilter, setStatusFilter] = useState("Όλες");

  const [form, setForm] = useState({
    email: "",
    location: "",
    latitude: "",
    longitude: "",
    category: categories[0],
    description: "",
    photo: null
  });

  async function loadSuggestions() {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    setSuggestions(data || []);
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

  const stats = useMemo(() => {
    return {
      total: suggestions.length,
      newCount: suggestions.filter((x) => x.status === "Νέα").length,
      progressCount: suggestions.filter((x) => x.status === "Σε εξέλιξη").length,
      doneCount: suggestions.filter((x) => x.status === "Ολοκληρώθηκε").length
    };
  }, [suggestions]);

  function getGpsLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);

      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        location: `GPS: ${lat}, ${lng}`
      }));
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      email: form.email,
      location: form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      category: form.category,
      description: form.description,
      status: "Νέα"
    };

    await supabase.from("suggestions").insert([payload]);

    setForm({
      email: "",
      location: "",
      latitude: "",
      longitude: "",
      category: categories[0],
      description: "",
      photo: null
    });

    await loadSuggestions();
    setView("dashboard");
  }

  const selectedSuggestion = suggestions.find((s) => s.id === selectedId);

  return (
    <div style={{ maxWidth: "1200px", margin: "auto", padding: "20px" }}>
      <h1>Snap2Shape</h1>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={() => setView("citizen")}>Φόρμα Πολίτη</button>
        <button onClick={() => setView("dashboard")} style={{ marginLeft: "10px" }}>
          Dashboard Δήμου
        </button>
      </div>

      {view === "citizen" ? (
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <textarea
            placeholder="Περιγραφή"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <button type="button" onClick={getGpsLocation}>
            Χρήση GPS
          </button>

          <input value={form.location} readOnly />

          <button type="submit">Καταχώριση</button>
        </form>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          <div>
            {/* STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
              <Stat title="Σύνολο" value={stats.total} />
              <Stat title="Νέες" value={stats.newCount} />
              <Stat title="Σε εξέλιξη" value={stats.progressCount} />
              <Stat title="Ολοκληρώθηκαν" value={stats.doneCount} />
            </div>

            {/* MAP */}
            <div style={{ marginTop: "20px" }}>
              <h2>Χάρτης εισηγήσεων</h2>

              <div style={{ height: "420px" }}>
                <MapContainer
                  center={[34.775, 32.424]}
                  zoom={11}
                  style={{ height: "100%" }}
                >
                  <TileLayer
                    attribution="OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {suggestions
                    .filter((s) => s.latitude && s.longitude)
                    .map((s) => (
                      <Marker
                        key={s.id}
                        position={[parseFloat(s.latitude), parseFloat(s.longitude)]}
                      >
                        <Popup>
                          <b>{s.category}</b>
                          <br />
                          {s.location}
                          <br />
                          Status: {s.status}
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              </div>
            </div>

            {/* LIST */}
            <div style={{ marginTop: "20px" }}>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    padding: "10px",
                    border: "1px solid #ccc",
                    marginBottom: "8px",
                    cursor: "pointer"
                  }}
                >
                  <b>{s.category}</b>
                  <div>{s.location}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DETAILS */}
          <div>
            {selectedSuggestion && (
              <div>
                <h3>{selectedSuggestion.category}</h3>
                <p>{selectedSuggestion.description}</p>
                <p>{selectedSuggestion.location}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={{ background: "#eee", padding: "10px", borderRadius: "8px" }}>
      <div>{title}</div>
      <b>{value}</b>
    </div>
  );
}