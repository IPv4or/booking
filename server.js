const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Enable Cross-Origin Resource Sharing for all routes
app.use(cors());
// Parse incoming request bodies in JSON format
app.use(bodyParser.json());

// --- In-Memory Data Store (for demonstration) ---
// In a real application, you would use a database like PostgreSQL, MongoDB, or Firestore.
const bookings = {}; // e.g., { '2025-10-28': ['10:00 AM', '02:00 PM'] }

// --- Helper Functions ---
/**
 * Generates a standard list of available time slots for a given day.
 * @returns {string[]} An array of time slot strings.
 */
function getStandardAvailability() {
    return [
        "09:00 AM - 11:00 AM",
        "11:00 AM - 01:00 PM",
        "01:00 PM - 03:00 PM",
        "03:00 PM - 05:00 PM",
    ];
}

// --- API Routes ---

/**
 * @route GET /api/availability
 * @description Returns available time slots for a given date.
 * @query {string} date - The date to check in YYYY-MM-DD format.
 */
app.get('/api/availability', (req, res) => {
    const { date } = req.query; // e.g., "2025-10-28"

    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required.' });
    }

    // Simulate fetching availability.
    const allTimes = getStandardAvailability();
    const bookedTimesForDate = bookings[date] || [];

    // Filter out already booked times
    const availableTimes = allTimes.filter(time => !bookedTimesForDate.includes(time));

    console.log(`[AVAILABILITY] Checked for ${date}. Found ${availableTimes.length} available slots.`);

    res.json({
        date,
        availableTimes,
    });
});

/**
 * @route POST /api/book
 * @description Creates a new booking for a given date and time.
 * @body {object} bookingDetails - Contains date, time, name, email, address, notes.
 */
app.post('/api/book', (req, res) => {
    const { date, time, name, email, address } = req.body;

    // Basic validation
    if (!date || !time || !name || !email || !address) {
        return res.status(400).json({ message: 'Missing required booking information.' });
    }

    // Initialize the array for the date if it doesn't exist
    if (!bookings[date]) {
        bookings[date] = [];
    }

    // Check if the slot is already booked (double-booking prevention)
    if (bookings[date].includes(time)) {
        return res.status(409).json({ message: 'This time slot is no longer available.' });
    }

    // Add the new booking
    bookings[date].push(time);

    // In a real app, you would:
    // 1. Save the full booking details to a database.
    // 2. Send a confirmation email.
    console.log('--- NEW BOOKING ---');
    console.log(`Date: ${date}, Time: ${time}`);
    console.log(`Name: ${name}, Email: ${email}`);
    console.log(`Address: ${address}`);
    console.log('Current Bookings:', bookings);
    console.log('-------------------');


    res.status(201).json({
        success: true,
        message: 'Booking confirmed!',
        booking: req.body,
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Booking system backend is alive and listening for requests.');
});
