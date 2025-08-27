import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const listingsFilePath = path.join(__dirname, "listings.json");

// Ensure listings file exists
async function ensureListingsFileExists() {
  try {
    try {
      await fs.access(listingsFilePath);
    } catch {
      await fs.writeFile(listingsFilePath, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to initialize listings file:", err);
  }
}
ensureListingsFileExists();

// Helpers to read/write listings
async function readListings() {
  try {
    const data = await fs.readFile(listingsFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading listings:", error);
    return [];
  }
}

async function writeListings(listings) {
  try {
    await fs.writeFile(listingsFilePath, JSON.stringify(listings, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing listings:", error);
    throw error;
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "samanthasu2028@u.northwestern.edu",
      subject: `New message from ${name}`,
      html: `<p><strong>Email:</strong> ${email}</p><p>${message}</p>`,
    });

    res.status(200).json({ success: true, message: "Email sent!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});

// Listings API
app.get("/listings", async (req, res) => {
  try {
    const listings = await readListings();
    res.json(listings);
  } catch (error) {
    console.error("Read listings error:", error);
    res.status(500).json({ success: false, message: "Failed to read listings" });
  }
});

app.post("/listings", async (req, res) => {
  const { title, price, description, contact, imageUrl } = req.body;
  if (!title || !price || !description || !contact) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }
  try {
    const listings = await readListings();
    const newListing = {
      id: Date.now().toString(),
      title,
      price: Number(price),
      description,
      contact,
      imageUrl: imageUrl || "",
      likes: 0,
      sold: false,
      createdAt: new Date().toISOString(),
    };
    listings.push(newListing);
    await writeListings(listings);
    res.status(201).json(newListing);
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ success: false, message: "Failed to create listing" });
  }
});

app.post("/listings/:id/like", async (req, res) => {
  try {
    const listings = await readListings();
    const listing = listings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: "Not found" });
    listing.likes += 1;
    await writeListings(listings);
    res.json({ success: true, likes: listing.likes });
  } catch (error) {
    console.error("Like listing error:", error);
    res.status(500).json({ success: false, message: "Failed to like listing" });
  }
});

app.post("/listings/:id/buy", async (req, res) => {
  try {
    const listings = await readListings();
    const listing = listings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: "Not found" });
    if (listing.sold) return res.status(400).json({ success: false, message: "Already sold" });
    listing.sold = true;
    await writeListings(listings);
    res.json({ success: true, sold: true });
  } catch (error) {
    console.error("Buy listing error:", error);
    res.status(500).json({ success: false, message: "Failed to mark as sold" });
  }
});

app.delete("/listings/:id", async (req, res) => {
  try {
    const listings = await readListings();
    const index = listings.findIndex(l => l.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: "Not found" });
    const [removed] = listings.splice(index, 1);
    await writeListings(listings);
    res.json({ success: true, removedId: removed.id });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({ success: false, message: "Failed to delete listing" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
