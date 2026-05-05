import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const dayNames = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function diffDays(startKey, endKey) {
  return Math.round((fromDateKey(endKey) - fromDateKey(startKey)) / (1000 * 60 * 60 * 24));
}

function formatDate(key) {
  return fromDateKey(key).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function dateRange(startKey, endKey) {
  const nights = diffDays(startKey, endKey);
  return Array.from({ length: nights }, (_, index) => toDateKey(addDays(fromDateKey(startKey), index)));
}

function rangesOverlapOrTouch(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const firstMondayIndex = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -firstMondayIndex);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function App() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [bookings, setBookings] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [message, setMessage] = React.useState("Välj in- och utcheckningsdatum i kalendern.");

  const days = React.useMemo(() => getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

  const bookedNights = React.useMemo(() => {
    const map = new Map();
    bookings.forEach((booking) => dateRange(booking.start, booking.end).forEach((key) => map.set(key, booking)));
    return map;
  }, [bookings]);

  const selectedNights = React.useMemo(() => {
    if (!start || !end || end <= start) return new Set();
    return new Set(dateRange(start, end));
  }, [start, end]);

  const bookingNights = start && end && end > start ? diffDays(start, end) : 0;

  async function loadBookings() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/bookings");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kunde inte hämta bokningar.");
      setBookings(data.bookings || []);
    } catch (error) {
      setMessage(error.message || "Något gick fel när bokningarna skulle hämtas.");
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadBookings();
  }, []);

  function handleDayClick(day) {
    const key = toDateKey(day);
    if (key < toDateKey(today)) {
      setMessage("Du kan inte boka datum som redan har passerat.");
      return;
    }

    if (!start || (start && end)) {
      setStart(key);
      setEnd("");
      setMessage("Välj utcheckningsdatum. Max 3 nätter.");
      return;
    }

    if (key <= start) {
      setStart(key);
      setEnd("");
      setMessage("Startdatum uppdaterat. Välj ett senare utcheckningsdatum.");
      return;
    }

    setEnd(key);
    const nights = diffDays(start, key);
    setMessage(nights > 3 ? "Bokningen är längre än 3 nätter. Välj ett tidigare utcheckningsdatum." : `${nights} natt${nights === 1 ? "" : "er"} vald${nights === 1 ? "" : "a"}.`);
  }

  async function createBooking(event) {
    event.preventDefault();

    if (!name.trim()) return setMessage("Skriv in ett namn för bokningen.");
    if (!start || !end || end <= start) return setMessage("Välj både incheckning och utcheckning.");

    const nights = diffDays(start, end);
    if (nights > 3) return setMessage("Max antal nätter per bokning är 3.");

    const overlapOrTouch = bookings.some((booking) => rangesOverlapOrTouch(start, end, booking.start, booking.end));
    if (overlapOrTouch) return setMessage("Datumen krockar med en befintlig bokning, eller ligger direkt före/efter en annan bokning. Lämna minst en natt ledig mellan bokningar.");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), start, end })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bokningen kunde inte sparas.");

      setBookings(data.bookings || []);
      setName("");
      setStart("");
      setEnd("");
      setMessage("Bokningen är registrerad och sparad för alla.");
    } catch (error) {
      setMessage(error.message || "Något gick fel när bokningen skulle sparas.");
    }
  }

  async function removeBooking(id) {
    try {
      const response = await fetch(`/api/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bokningen kunde inte tas bort.");
      setBookings(data.bookings || []);
      setMessage("Bokningen är borttagen för alla.");
    } catch (error) {
      setMessage(error.message || "Något gick fel när bokningen skulle tas bort.");
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="heroInner">
          <div className="badge">🏡 Gästhuset</div>
          <h1>Boka en lugn vistelse i familjen Elmgrens gästhus</h1>
          <p>Enkel kalenderbokning med tydliga regler: max 3 nätter per bokning och minst en natt ledig mellan separata bokningar.</p>
          <div className="infoBox">
            Senaste tid för utcheckning är kl 11.00 avresedagen. Ansvarig bokare skall även se till att gästhuset städas.
            Vid bristfällig städning ges personen först en varning men skulle det upprepas kommer man bli förpassad till den lilla friggeboden.
          </div>
        </div>
      </section>

      <main className="layout">
        <section className="card">
          <div className="calendarHeader">
            <div>
              <span className="eyebrow">📅 Kalender</span>
              <h2>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
            </div>
            <div className="monthButtons">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>‹</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>›</button>
            </div>
          </div>

          <div className="weekdays">{dayNames.map((day) => <div key={day}>{day}</div>)}</div>
          <div className="calendarGrid">
            {days.map((day) => {
              const key = toDateKey(day);
              const booking = bookedNights.get(key);
              const isSelected = selectedNights.has(key) || key === start || key === end;

              return (
                <button
                  key={key}
                  onClick={() => handleDayClick(day)}
                  className={[
                    "day",
                    day.getMonth() === currentMonth.getMonth() ? "" : "outside",
                    key < toDateKey(today) ? "past" : "",
                    booking ? "booked" : "",
                    isSelected ? "selected" : ""
                  ].join(" ")}
                >
                  <strong>{day.getDate()}</strong>
                  {booking && <small>Bokad</small>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="side">
          <section className="card">
            <h2>Ny bokning</h2>
            <p className="muted">Ingen gräns för antal bokningar</p>
            <form onSubmit={createBooking} className="bookingForm">
              <label>Namn<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Anna Andersson" /></label>
              <div className="twoCols">
                <label>Incheckning<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
                <label>Utcheckning<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
              </div>
              <div className="stats">
                <div>Valda nätter <strong>{bookingNights}</strong></div>
                <div>Bokningar <strong>{bookings.length}</strong></div>
              </div>
              <p className="message">{message}</p>
              <button className="submitButton" type="submit">Lägg till bokning</button>
            </form>
          </section>

          <section className="card">
            <h2>Aktiva bokningar</h2>
            {isLoading && <p className="empty">Hämtar bokningar...</p>}
            {!isLoading && bookings.length === 0 && <p className="empty">Inga bokningar ännu.</p>}
            {bookings.map((booking) => (
              <div key={booking.id} className="bookingItem">
                <div>
                  <strong>{booking.name}</strong>
                  <p>{formatDate(booking.start)} – {formatDate(booking.end)} · {diffDays(booking.start, booking.end)} natt{diffDays(booking.start, booking.end) === 1 ? "" : "er"}</p>
                </div>
                <button onClick={() => removeBooking(booking.id)}>Ta bort</button>
              </div>
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
