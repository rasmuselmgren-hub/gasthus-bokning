const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Bookings";

const apiUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

async function getBookings() {
  const response = await fetch(`${apiUrl}?sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=asc`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Kunde inte hämta bokningar från Airtable.");
  }

  return (data.records || []).map((record) => ({
    id: record.id,
    name: record.fields.Name || "",
    start: record.fields.Start,
    end: record.fields.End
  })).filter((booking) => booking.start && booking.end);
}

function diffDays(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function rangesOverlapOrTouch(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export default async function handler(req, res) {
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        error: "Airtable saknar inställningar i Vercel."
      });
    }

    if (req.method === "GET") {
      const bookings = await getBookings();
      return res.status(200).json({ bookings });
    }

    if (req.method === "POST") {
      const { name, start, end } = req.body || {};
      if (!name || !start || !end) {
        return res.status(400).json({ error: "Namn, incheckning och utcheckning behövs." });
      }

      const nights = diffDays(start, end);
      if (nights < 1) return res.status(400).json({ error: "Utcheckning måste vara efter incheckning." });
      if (nights > 3) return res.status(400).json({ error: "Max antal nätter per bokning är 3." });

      const existingBookings = await getBookings();
      const hasConflict = existingBookings.some((booking) =>
        rangesOverlapOrTouch(start, end, booking.start, booking.end)
      );

      if (hasConflict) {
        return res.status(400).json({
          error: "Datumen krockar med en befintlig bokning, eller ligger direkt före/efter en annan bokning."
        });
      }

      const createResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          records: [{ fields: { Name: name, Start: start, End: end } }]
        })
      });

      const createData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createData.error?.message || "Kunde inte skapa bokningen i Airtable.");
      }

      const bookings = await getBookings();
      return res.status(200).json({ bookings });
    }

    if (req.method === "DELETE") {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: "Boknings-ID saknas." });

      const deleteResponse = await fetch(`${apiUrl}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });

      const deleteData = await deleteResponse.json();
      if (!deleteResponse.ok) {
        throw new Error(deleteData.error?.message || "Kunde inte ta bort bokningen från Airtable.");
      }

      const bookings = await getBookings();
      return res.status(200).json({ bookings });
    }

    return res.status(405).json({ error: "Metoden stöds inte." });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Något gick fel med Airtable." });
  }
}
