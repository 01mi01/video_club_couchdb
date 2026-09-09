require('dotenv').config();
const express = require('express');
const cors = require('cors');
const healthRoute = require('./routes/health');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', healthRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));