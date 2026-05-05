export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "Bookings";

  if (!token || !baseId) {
    return res.status(500).json({
      error: "Saknar AIRTABLE_TOKEN eller AIRTABLE_BASE_ID",
      hasToken: !!token,
      hasBaseId: !!baseId,
      tableName
    });
  }

  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({
      error: "Airtable svarade med fel",
      status: response.status,
      details: data,
      baseId,
      tableName,
      tokenStartsWith: token.slice(0, 4)
    });
  }

  return res.status(200).json({
    bookings: data.records.map((record) => ({
      id: record.id,
      name: record.fields.Name || "",
      start: record.fields.Start,
      end: record.fields.End
    }))
  });
}
