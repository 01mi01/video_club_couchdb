require('dotenv').config();
const express = require('express');
const cors = require('cors');
const healthRoute = require('./routes/health');

// --- Rutas y middlewares agregados en esta fase (backend completo) ---
const authRoute = require('./routes/auth');
const genresRoute = require('./routes/genres');
const oscarCategoriesRoute = require('./routes/oscarCategories');
const zonesRoute = require('./routes/zones');
const videosRoute = require('./routes/videos');
const clientsRoute = require('./routes/clients');
const loansRoute = require('./routes/loans');
const invoicesRoute = require('./routes/invoices');
const configRoute = require('./routes/config');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', healthRoute);

// Rutas PÚBLICAS: diagnóstico (/api/health, ya montada arriba) y login.
app.use('/api', authRoute);

// A partir de aquí, TODO exige `Authorization: Bearer <token>`.
// La app tiene un único usuario: el propietario del videoclub.
app.use('/api', authMiddleware);

app.use('/api/genres', genresRoute);
app.use('/api/oscar-categories', oscarCategoriesRoute);
app.use('/api/zones', zonesRoute);
app.use('/api/videos', videosRoute);
app.use('/api/clients', clientsRoute);
app.use('/api/loans', loansRoute);
app.use('/api/invoices', invoicesRoute);
app.use('/api/config', configRoute);

// Manejo de errores central (AppError, conflictos _rev 409, errores nano).
// Debe ir al final, después de todas las rutas.
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
