import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
  "Άλλο",
];

const statuses = ["Νέα", "Υπό εξέταση", "Σε εξέλιξη", "Ολοκληρώθηκε", "Απορρίφθηκε"];

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("el-GR");
  } catch {
    return value;
  }
}

export default function App() {
  const [view, setView] = useState("citizen");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

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
    photo: null,
    photoPreview: "",
  });

  async function loadSuggestions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setSuggestions(data || []);
      if ((data || []).length && !selectedId) setSelectedId(data[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((item) => {
      const okCategory = categoryFilter === "Όλες" || item.category === categoryFilter;
      const okStatus = statusFilter === "Όλες" || item.status === statusFilter;
      const blob =
        `${item.email || ""} ${item.location || ""} ${item.category || ""} ${item.description || ""} ${item.status || ""}`.toLowerCase();
      const okQuery = blob.includes(query.toLowerCase());
      return okCategory && okStatus && okQuery;
    });
  }, [suggestions, categoryFilter, statusFilter, query]);

  const selectedSuggestion =
    suggestions.find((item) => item.id === selectedId) || filteredSuggestions[0] || null;

  const stats = useMemo(() => {
    return {
      total: suggestions.length,
      newCount: suggestions.filter((x) => x.status === "Νέα").length,
      progressCount: suggestions.filter((x) => x.status === "Σε εξέλιξη").length,
      doneCount: suggestions.filter((x) => x.status === "Ολοκληρώθηκε").length,
    };
  }, [suggestions]);

  function getGpsLocation() {
    if (!navigator.geolocation) {
      setMessage("Η συσκευή δεν υποστηρίζει GPS.");
      return;
    }

    setGpsLoading(true);
    setMessage("Γίνεται προσπάθεια ανάγνωσης τοποθεσίας...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);

        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          location: prev.location || `GPS: ${lat}, ${lng}`,
        }));

        setMessage("Η τοποθεσία διαβάστηκε επιτυχώς.");
        setGpsLoading(false);
      },
      (error) => {
        let msg = "Δεν μπόρεσα να διαβάσω την τοποθεσία.";
        if (error.code === 1) msg = "Απορρίφθηκε η άδεια τοποθεσίας.";
        if (error.code === 2) msg = "Η τοποθεσία δεν είναι διαθέσιμη.";
        if (error.code === 3) msg = "Η ανάγνωση τοποθεσίας άργησε και έληξε.";
        setMessage(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        photo: file,
        photoPreview: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(file) {
    if (!file) return null;

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("suggestion-photos")
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("suggestion-photos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("Καταχώριση...");

    try {
      const photoUrl = await uploadPhoto(form.photo);

      const payload = {
        email: form.email,
        location: form.location,
        category: form.category,
        description: form.description,
        photo_url: photoUrl,
        status: "Νέα",
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      };

      const { error } = await supabase.from("suggestions").insert([payload]);

      if (error) throw error;

      setForm({
        email: "",
        location: "",
        latitude: "",
        longitude: "",
        category: categories[0],
        description: "",
        photo: null,
        photoPreview: "",
      });

      setMessage("Η εισήγηση καταχωρίστηκε επιτυχώς.");
      await loadSuggestions();
      setView("dashboard");
    } catch (err) {
      setMessage(`Σφάλμα: ${err.message}`);
    }
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
    if (!error) {
      await loadSuggestions();
      setSelectedId(id);
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setAuthMessage("Γίνεται σύνδεση...");

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthMessage("Σφάλμα σύνδεσης: " + error.message);
    } else {
      setAuthMessage("");
      setView("dashboard");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setView("citizen");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f5f7", padding: "14px", color: "#1f2937" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "24px",
            padding: "22px",
            marginBottom: "16px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
          }}
        >
          <h1 style={{ margin: "0 0 8px 0", fontSize: "42px" }}>Snap2Shape</h1>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Πλατφόρμα εισηγήσεων πολιτών με GPS, φωτογραφίες και dashboard διαχείρισης.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
            <button
              onClick={() => setView("citizen")}
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: view === "citizen" ? "#2563eb" : "#e5e7eb",
                color: view === "citizen" ? "#fff" : "#111827",
              }}
            >
              Φόρμα Πολίτη
            </button>

            <button
              onClick={() => setView(session ? "dashboard" : "login")}
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: view === "dashboard" || view === "login" ? "#2563eb" : "#e5e7eb",
                color: view === "dashboard" || view === "login" ? "#fff" : "#111827",
              }}
            >
              Dashboard Δήμου
            </button>

            {session && (
              <button
                onClick={handleLogout}
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  background: "#111827",
                  color: "#fff",
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {view === "citizen" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,0.9fr)",
              gap: "16px",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "24px",
                padding: "20px",
                boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
              }}
            >
              <h2>Νέα εισήγηση</h2>

              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="name@example.com"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Κατηγορία</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={inputStyle}
                    >
                      {categories.map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "14px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Τοποθεσία</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
                    <input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      required
                      placeholder="π.χ. Γεροσκήπου, κεντρική πλατεία"
                      style={inputStyle}
                    />
                    <button type="button" onClick={getGpsLocation} style={secondaryButtonStyle}>
                      {gpsLoading ? "Ανάγνωση GPS..." : "Χρήση GPS"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Latitude</label>
                    <input
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Longitude</label>
                    <input
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "14px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Φωτογραφία</label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={inputStyle} />
                  <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "6px" }}>
                    Σε κινητό μπορεί να ανοίξει άλμπουμ ή κάμερα, ανάλογα με τη συσκευή.
                  </div>

                  {form.photoPreview && (
                    <img
                      src={form.photoPreview}
                      alt="preview"
                      style={{
                        width: "100%",
                        maxHeight: "280px",
                        objectFit: "cover",
                        borderRadius: "16px",
                        marginTop: "10px",
                      }}
                    />
                  )}
                </div>

                <div style={{ marginTop: "14px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Περιγραφή</label>
                  <textarea
                    rows="6"
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Περιγράψτε την εισήγηση..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginTop: "18px" }}>
                  <button type="submit" style={primaryButtonStyle}>
                    Καταχώριση εισήγησης
                  </button>

                  {message && (
                    <span style={{ color: message.startsWith("Σφάλμα") ? "#b91c1c" : "#15803d", fontWeight: "bold" }}>
                      {message}
                    </span>
                  )}
                </div>
              </form>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div
                style={{
                  background: "#fff",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
                }}
              >
                <h2>Στατιστικά</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <StatBox title="Σύνολο" value={stats.total} />
                  <StatBox title="Νέες" value={stats.newCount} />
                  <StatBox title="Σε εξέλιξη" value={stats.progressCount} />
                  <StatBox title="Ολοκληρωμένες" value={stats.doneCount} />
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
                }}
              >
                <h2>Τι περιλαμβάνει</h2>
                <ul style={{ lineHeight: 1.8, paddingLeft: "20px" }}>
                  <li>Mobile / tablet friendly χρήση</li>
                  <li>GPS location από κινητό</li>
                  <li>Φωτογραφία από άλμπουμ ή κάμερα</li>
                  <li>Πλήρεις κατηγορίες εισηγήσεων</li>
                  <li>Dashboard δήμου με φίλτρα και status</li>
                </ul>
              </div>
            </div>
          </div>
        ) : view === "login" ? (
          <div
            style={{
              maxWidth: "520px",
              margin: "0 auto",
              background: "#fff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <h2>Σύνδεση Δήμου</h2>
            <p style={{ color: "#6b7280" }}>
              Η διαχείριση εισηγήσεων είναι διαθέσιμη μόνο σε εξουσιοδοτημένους χρήστες.
            </p>

            <form onSubmit={handleAdminLogin}>
              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "18px", flexWrap: "wrap" }}>
                <button type="submit" style={primaryButtonStyle}>
                  Login
                </button>

                {authMessage && (
                  <span
                    style={{
                      color: authMessage.startsWith("Σφάλμα") ? "#b91c1c" : "#15803d",
                      fontWeight: "bold",
                    }}
                  >
                    {authMessage}
                  </span>
                )}
              </div>
            </form>
          </div>
        ) : !session ? (
          <div
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              background: "#fff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
            }}
          >
            <h2>Απαιτείται σύνδεση</h2>
            <p>Για πρόσβαση στο Dashboard Δήμου πρέπει πρώτα να συνδεθείτε.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(360px,0.9fr)",
              gap: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>
                <StatBox title="Σύνολο" value={stats.total} />
                <StatBox title="Νέες" value={stats.newCount} />
                <StatBox title="Σε εξέλιξη" value={stats.progressCount} />
                <StatBox title="Ολοκληρώθηκαν" value={stats.doneCount} />
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
                }}
              >
                <h2>Χάρτης εισηγήσεων</h2>

                <div style={{ height: "420px", borderRadius: "16px", overflow: "hidden" }}>
                  <MapContainer
                    center={[34.775, 32.424]}
                    zoom={11}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {suggestions
                      .filter(
                        (item) =>
                          item.latitude &&
                          item.longitude &&
                          !isNaN(parseFloat(item.latitude)) &&
                          !isNaN(parseFloat(item.longitude))
                      )
                      .map((item) => (
                        <Marker
                          key={item.id}
                          position={[parseFloat(item.latitude), parseFloat(item.longitude)]}
                        >
                          <Popup>
                            <div style={{ minWidth: "180px" }}>
                              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>{item.category}</div>
                              <div>{item.location}</div>
                              <div style={{ marginTop: "6px", color: "#6b7280" }}>Status: {item.status}</div>
                              <button
                                onClick={() => setSelectedId(item.id)}
                                style={{
                                  marginTop: "10px",
                                  padding: "8px 10px",
                                  border: "none",
                                  borderRadius: "8px",
                                  background: "#2563eb",
                                  color: "#fff",
                                  cursor: "pointer",
                                }}
                              >
                                Προβολή λεπτομερειών
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 180px auto", gap: "10px", marginBottom: "14px" }}>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Αναζήτηση..."
                    style={inputStyle}
                  />

                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={inputStyle}>
                    <option>Όλες</option>
                    {categories.map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>

                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
                    <option>Όλες</option>
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>

                  <button onClick={loadSuggestions} style={secondaryButtonStyle}>
                    Ανανέωση
                  </button>
                </div>

                {loading ? (
                  <div style={emptyBoxStyle}>Φόρτωση...</div>
                ) : filteredSuggestions.length === 0 ? (
                  <div style={emptyBoxStyle}>Δεν βρέθηκαν εισηγήσεις.</div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {filteredSuggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                          padding: "14px",
                          borderRadius: "16px",
                          border: selectedSuggestion?.id === item.id ? "1px solid #93c5fd" : "1px solid #dbe1e8",
                          background: selectedSuggestion?.id === item.id ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: "bold" }}>{item.category}</div>
                          <div style={{ color: "#6b7280" }}>{item.location}</div>
                          <small style={{ color: "#6b7280" }}>{formatDate(item.created_at)}</small>
                        </div>

                        <div
                          style={{
                            background: "#eef2f7",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            whiteSpace: "nowrap",
                            height: "fit-content",
                          }}
                        >
                          {item.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                borderRadius: "24px",
                padding: "20px",
                boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
              }}
            >
              <h2>Λεπτομέρειες</h2>

              {selectedSuggestion ? (
                <div style={{ display: "grid", gap: "12px" }}>
                  <DetailBox title="Email" value={selectedSuggestion.email} />
                  <DetailBox title="Κατηγορία" value={selectedSuggestion.category} />
                  <DetailBox title="Τοποθεσία" value={selectedSuggestion.location} />
                  <DetailBox title="Latitude" value={selectedSuggestion.latitude || "—"} />
                  <DetailBox title="Longitude" value={selectedSuggestion.longitude || "—"} />

                  {selectedSuggestion.latitude && selectedSuggestion.longitude && (
                    <div style={detailBoxStyle}>
                      <div style={detailTitleStyle}>Χάρτης</div>
                      <a
                        href={`https://maps.google.com/?q=${selectedSuggestion.latitude},${selectedSuggestion.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1d4ed8", fontWeight: "bold" }}
                      >
                        Άνοιγμα στο Google Maps
                      </a>
                    </div>
                  )}

                  <div style={detailBoxStyle}>
                    <div style={detailTitleStyle}>Περιγραφή</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{selectedSuggestion.description}</div>
                  </div>

                  <div style={detailBoxStyle}>
                    <div style={detailTitleStyle}>Φωτογραφία</div>
                    {selectedSuggestion.photo_url ? (
                      <img
                        src={selectedSuggestion.photo_url}
                        alt="suggestion"
                        style={{ width: "100%", maxHeight: "280px", objectFit: "cover", borderRadius: "16px" }}
                      />
                    ) : (
                      <div style={{ color: "#6b7280" }}>Δεν έχει επισυναφθεί φωτογραφία.</div>
                    )}
                  </div>

                  <div style={detailBoxStyle}>
                    <div style={detailTitleStyle}>Αλλαγή κατάστασης</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {statuses.map((status) => (
                        <button
                          key={status}
                          onClick={() => updateStatus(selectedSuggestion.id, status)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: selectedSuggestion.status === status ? "none" : "1px solid #dbe1e8",
                            background: selectedSuggestion.status === status ? "#2563eb" : "#fff",
                            color: selectedSuggestion.status === status ? "#fff" : "#111827",
                            cursor: "pointer",
                          }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={emptyBoxStyle}>Επιλέξτε μια εισήγηση από τη λίστα.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ title, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #edf2f7",
        borderRadius: "16px",
        padding: "14px",
      }}
    >
      <div style={{ color: "#6b7280", marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

function DetailBox({ title, value }) {
  return (
    <div style={detailBoxStyle}>
      <div style={detailTitleStyle}>{title}</div>
      <div>{value}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #dbe1e8",
  borderRadius: "14px",
  background: "#fff",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  padding: "12px 18px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "12px 14px",
  background: "#fff",
  color: "#111827",
  border: "1px solid #dbe1e8",
  borderRadius: "12px",
  cursor: "pointer",
};

const emptyBoxStyle = {
  padding: "18px",
  borderRadius: "16px",
  border: "1px dashed #dbe1e8",
  color: "#6b7280",
};

const detailBoxStyle = {
  background: "#f8fafc",
  border: "1px solid #edf2f7",
  borderRadius: "16px",
  padding: "14px",
};

const detailTitleStyle = {
  fontSize: "12px",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: "8px",
  fontWeight: "bold",
};