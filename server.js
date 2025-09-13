const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY CONFIGURATION ---
// In a real production environment, use a strong, randomly generated string.
// Set this in your hosting environment (e.g., Render.com).
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'secret123';

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());

// --- In-Memory Data Store ---
const bookings = {}; 
const availabilityOverrides = {};
const validTokens = new Set(); // Stores active session tokens

// --- Helper Functions ---
function getStandardAvailability(dateObj) {
    const dayOfWeek = dateObj.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { return []; }
    return ["08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM"];
}

// ====== AUTHENTICATION MIDDLEWARE ======
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is required.' });
    }
    const token = authHeader.split(' ')[1];
    if (!validTokens.has(token)) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    next(); // Token is valid, proceed to the requested route
};


// ====== PUBLIC API ROUTES ====== (No authentication required)
const publicRouter = express.Router();

publicRouter.get('/api/availability', (req, res) => {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'A valid date in YYYY-MM-DD format is required.' });
    }
    const dateObj = new Date(date + 'T00:00:00.000Z');
    const allTimes = getStandardAvailability(dateObj);
    const bookedTimesForDate = (bookings[date] || []).map(b => b.time);
    const dayOverrides = availabilityOverrides[date] || {};
    const availableTimes = allTimes.filter(time => {
        const isManuallyDisabled = dayOverrides[time] === false;
        const isBooked = bookedTimesForDate.includes(time);
        return !isManuallyDisabled && !isBooked;
    });
    console.log(`[PUBLIC] Availability check for ${date}: ${availableTimes.length} slots.`);
    res.json({ date, availableTimes });
});

publicRouter.post('/api/book', (req, res) => {
    const { date, time, name, email, address, notes } = req.body;
    if (!date || !time || !name || !email || !address) {
        return res.status(400).json({ message: 'Missing required booking information.' });
    }
    if ((bookings[date] && bookings[date].some(b => b.time === time)) || (availabilityOverrides[date] && availabilityOverrides[date][time] === false)) {
        return res.status(409).json({ message: 'This time slot is no longer available.' });
    }
    if (!bookings[date]) { bookings[date] = []; }
    const newBooking = { time, name, email, address, notes };
    bookings[date].push(newBooking);
    console.log('--- NEW BOOKING ---', JSON.stringify(newBooking, null, 2));
    res.status(201).json({ success: true, message: 'Booking confirmed!' });
});

app.use(publicRouter);


// ====== ADMIN API ROUTES ======
const adminRouter = express.Router();

// This login route is NOT protected by the authMiddleware
adminRouter.post('/login', (req, res) => {
    const { passcode } = req.body;
    if (passcode === ADMIN_PASSCODE) {
        const token = crypto.randomBytes(16).toString('hex');
        validTokens.add(token);
        console.log(`[ADMIN] Successful login. Token generated.`);
        res.json({ success: true, token });
    } else {
        console.log(`[ADMIN] Failed login attempt.`);
        res.status(401).json({ message: 'Invalid passcode.' });
    }
});

// All routes defined below this point will be protected by the authMiddleware
adminRouter.use(authMiddleware);

adminRouter.get('/bookings', (req, res) => {
    console.log('[ADMIN] Fetched all bookings (authenticated).');
    res.json(bookings);
});

adminRouter.get('/availability', (req, res) => {
    console.log('[ADMIN] Fetched availability overrides (authenticated).');
    res.json(availabilityOverrides);
});

adminRouter.post('/availability', (req, res) => {
    const { date, slots } = req.body;
    if (!date || !slots) {
        return res.status(400).json({ message: 'Date and slots object are required.' });
    }
    if (!availabilityOverrides[date]) {
        availabilityOverrides[date] = {};
    }
    Object.assign(availabilityOverrides[date], slots);
    console.log(`[ADMIN] Updated availability for ${date} (authenticated).`);
    res.status(200).json({ success: true, message: `Availability for ${date} updated.` });
});

// Mount the admin router under the /api/admin path
app.use('/api/admin', adminRouter);


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('IMPORTANT: Set the ADMIN_PASSCODE environment variable for production.');
});

