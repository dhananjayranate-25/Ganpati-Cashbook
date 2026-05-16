const express = require('express');
const cors = require('cors');
const path = require('path');
const initSqlJs = require('sql.js');
const fs = require('fs');
const multer = require('multer');
const { PDFDocument, rgb } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Explicit root route to prevent browser cache issues
app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, 'index.html'));
});

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname)));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const year = req.body.year || 'unknown';
        cb(null, `cashbook_${year}_${Date.now()}.pdf`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const DB_PATH = path.join(__dirname, 'cashbook.db');
const DATABASE_URL = process.env.DATABASE_URL || '';

let db;
let isPostgres = false;

// Convert ? placeholders to PostgreSQL $1, $2, ... style
function convertParams(sql, params) {
    if (!isPostgres || !params || params.length === 0) return { sql, params };
    let idx = 0;
    const converted = sql.replace(/\?/g, () => `$${++idx}`);
    return { sql: converted, params };
}

async function initDatabase() {
    if (DATABASE_URL) {
        // PostgreSQL mode (Render)
        const { Pool } = require('pg');
        db = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        isPostgres = true;

        await db.query(`
            CREATE TABLE IF NOT EXISTS entries (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                mode TEXT NOT NULL CHECK(mode IN ('Online', 'Cash')),
                cash_in DOUBLE PRECISION DEFAULT 0,
                cash_out DOUBLE PRECISION DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('PostgreSQL database initialized');
    } else {
        // SQLite mode (local development)
        const SQL = await initSqlJs();

        let fileBuffer = null;
        if (fs.existsSync(DB_PATH)) {
            fileBuffer = fs.readFileSync(DB_PATH);
        }

        db = new SQL.Database(fileBuffer);

        db.run(`
            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                mode TEXT NOT NULL CHECK(mode IN ('Online', 'Cash')),
                cash_in REAL DEFAULT 0,
                cash_out REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        saveDatabase();
        console.log('SQLite database initialized');
    }
}

function saveDatabase() {
    if (!isPostgres && db && db.export) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

async function queryAll(sql, params = []) {
    if (isPostgres) {
        const { sql: pgSql, params: pgParams } = convertParams(sql, params);
        const result = await db.query(pgSql, pgParams);
        return result.rows;
    } else {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }
}

async function queryOne(sql, params = []) {
    if (isPostgres) {
        const { sql: pgSql, params: pgParams } = convertParams(sql, params);
        const result = await db.query(pgSql, pgParams);
        return result.rows[0] || null;
    } else {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
            result = stmt.getAsObject();
        }
        stmt.free();
        return result;
    }
}

async function runQuery(sql, params = []) {
    if (isPostgres) {
        const { sql: pgSql, params: pgParams } = convertParams(sql, params);
        await db.query(pgSql, pgParams);
    } else {
        db.run(sql, params);
        saveDatabase();
    }
}

// Helper: convert strftime SQLite syntax to PostgreSQL TO_CHAR
function convertYearSql(column) {
    if (isPostgres) {
        return `TO_CHAR(${column}, 'YYYY')`;
    }
    return `strftime('%Y', ${column})`;
}


app.get('/api/entries', async (req, res) => {
    try {
        const { year } = req.query;
        let sql = 'SELECT * FROM entries';
        let params = [];

        if (year) {
            sql += ` WHERE ${convertYearSql('date')} = ?`;
            params.push(year);
        }

        sql += ' ORDER BY date ASC, created_at ASC';
        const entries = await queryAll(sql, params);
        res.json({ success: true, data: entries });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/years', async (req, res) => {
    try {
        const years = await queryAll(`SELECT DISTINCT ${convertYearSql('date')} as year FROM entries ORDER BY year DESC`);
        res.json({ success: true, data: years.map(y => y.year) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/entries', async (req, res) => {
    try {
        const { name, date, mode, cashIn, cashOut } = req.body;

        if (!name || !date || !mode) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        await runQuery(
            'INSERT INTO entries (name, date, mode, cash_in, cash_out) VALUES (?, ?, ?, ?, ?)',
            [name, date, mode, cashIn || 0, cashOut || 0]
        );

        const result = await queryOne('SELECT * FROM entries ORDER BY id DESC LIMIT 1');

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await queryOne('SELECT * FROM entries WHERE id = ?', [id]);
        
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Entry not found' });
        }
        
        res.json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const before = await queryOne('SELECT COUNT(*) as count FROM entries WHERE id = ?', [id]);
        
        await runQuery('DELETE FROM entries WHERE id = ?', [id]);
        
        if (before.count === 0) {
            return res.status(404).json({ success: false, error: 'Entry not found' });
        }
        
        res.json({ success: true, message: 'Entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, mode, cashIn, cashOut } = req.body;
        
        if (!name || !date || !mode) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        
        await runQuery(
            'UPDATE entries SET name = ?, date = ?, mode = ?, cash_in = ?, cash_out = ? WHERE id = ?',
            [name, date, mode, cashIn || 0, cashOut || 0, id]
        );
        
        const result = await queryOne('SELECT * FROM entries WHERE id = ?', [id]);
        
        res.json({ success: true, data: result, message: 'Entry updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/entries', async (req, res) => {
    try {
        const before = await queryOne('SELECT COUNT(*) as count FROM entries');
        await runQuery('DELETE FROM entries');
        res.json({ success: true, message: 'All entries deleted', deletedCount: before.count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/entries/year/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const before = await queryOne(`SELECT COUNT(*) as count FROM entries WHERE ${convertYearSql('date')} = ?`, [year]);

        await runQuery(`DELETE FROM entries WHERE ${convertYearSql('date')} = ?`, [year]);

        res.json({ success: true, message: `All entries for year ${year} deleted`, deletedCount: before.count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/summary', async (req, res) => {
    try {
        const summary = await queryOne(`
            SELECT 
                COALESCE(SUM(cash_in), 0) as totalCashIn,
                COALESCE(SUM(cash_out), 0) as totalCashOut,
                COUNT(*) as totalEntries
            FROM entries
        `);

        summary.finalBalance = summary.totalCashIn - summary.totalCashOut;

        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

initDatabase().then(() => {
    app.listen(PORT, () => {
        const dbType = isPostgres ? 'PostgreSQL' : 'SQLite';
        console.log(`Ganpati Vargani Cashbook running at http://localhost:${PORT}`);
        console.log(`Database: ${dbType}${isPostgres ? '' : ' (' + DB_PATH + ')'}`);
        console.log(`Uploads directory: ${UPLOAD_DIR}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
        const { year, subtitle, tagline, orgName } = req.body;
        if (!year || !req.file) {
            return res.status(400).json({ success: false, error: 'Year and PDF file required' });
        }

        const originalName = req.file.originalname;
        const oldPath = req.file.path;
        const newName = `cashbook_${year}_${Date.now()}.pdf`;
        const newPath = path.join(UPLOAD_DIR, newName);
        fs.renameSync(oldPath, newPath);

        // Save metadata with per-PDF subtitle/tagline/orgName
        const metaPath = path.join(UPLOAD_DIR, newName.replace('.pdf', '.meta.json'));
        fs.writeFileSync(metaPath, JSON.stringify({
            year,
            originalName,
            subtitle: subtitle || '',
            tagline: tagline || '',
            orgName: orgName || '',
            uploadedAt: new Date().toISOString()
        }));

        console.log('PDF uploaded:', newName, '| Original:', originalName);
        res.json({ success: true, filename: newName, year });
    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/uploaded-pdfs', (req, res) => {
    try {
        if (!fs.existsSync(UPLOAD_DIR)) {
            return res.json({ success: true, data: [] });
        }
        const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.pdf') && !f.endsWith('.meta.json.pdf'));
        const pdfList = files.map(f => {
            const match = f.match(/cashbook_(\d+|unknown)_(\d+)\.pdf/);
            const year = match ? match[1] : 'unknown';
            const metaPath = path.join(UPLOAD_DIR, f.replace('.pdf', '.meta.json'));
            let originalName = f;
            let uploadedAt = '';
            let subtitle = '';
            let tagline = '';
            let orgName = '';
            
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    originalName = meta.originalName || f;
                    subtitle = meta.subtitle || '';
                    tagline = meta.tagline || '';
                    orgName = meta.orgName || '';
                    uploadedAt = meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '';
                } catch (e) {
                    // Use fallback
                }
            }
            
            return {
                filename: f,
                year,
                displayName: originalName,
                subtitle,
                tagline,
                orgName,
                uploadedAt,
                path: `/uploads/${f}`,
                mergedPath: `/api/merged-pdf/${f}/${year}`
            };
        });
        pdfList.sort((a, b) => a.year.localeCompare(b.year));
        res.json({ success: true, data: pdfList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/uploaded-pdfs/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOAD_DIR, filename);
        const metaPath = path.join(UPLOAD_DIR, filename.replace('.pdf', '.meta.json'));
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        fs.unlinkSync(filePath);
        if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
        }
        res.json({ success: true, message: 'PDF deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/uploaded-pdfs/:filename/rename', (req, res) => {
    try {
        const { filename } = req.params;
        const { displayName } = req.body;
        if (!displayName || !displayName.trim()) {
            return res.status(400).json({ success: false, error: 'Display name is required' });
        }
        const metaPath = path.join(UPLOAD_DIR, filename.replace('.pdf', '.meta.json'));
        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ success: false, error: 'Metadata not found' });
        }
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.originalName = displayName.trim();
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        res.json({ success: true, message: 'Renamed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/uploaded-pdfs/:filename/cover', (req, res) => {
    try {
        const { filename } = req.params;
        const { subtitle, tagline, orgName } = req.body;
        const metaPath = path.join(UPLOAD_DIR, filename.replace('.pdf', '.meta.json'));
        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ success: false, error: 'Metadata not found' });
        }
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (subtitle !== undefined) meta.subtitle = subtitle;
        if (tagline !== undefined) meta.tagline = tagline;
        if (orgName !== undefined) meta.orgName = orgName;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        res.json({ success: true, message: 'Cover settings updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const MERGE_CACHE_DIR = path.join(__dirname, 'merged-cache');
if (!fs.existsSync(MERGE_CACHE_DIR)) {
    fs.mkdirSync(MERGE_CACHE_DIR, { recursive: true });
}

async function generateMergedPdf(filename, year, subtitle, tagline, orgName) {
    const pdfPath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF not found: ' + filename);
    }

    subtitle = subtitle || '\u0917\u0923\u0947\u0936 \u0909\u0924\u094D\u0938\u0935 \u0915\u0945\u0936\u092C\u0941\u0915';
    tagline = tagline || 'Ganpati Festival Cashbook';
    orgName = orgName || 'ShivSrushti Boyz';

    const existingPdfBytes = fs.readFileSync(pdfPath);
    const existingPdf = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });

    const mergedPdf = await PDFDocument.create();
    const page = mergedPdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const cx = width / 2;

    const saffron = rgb(1, 0.55, 0);
    const gold = rgb(1, 0.84, 0);
    const lightGold = rgb(0.83, 0.72, 0.58);
    const bgDark = rgb(0.06, 0.01, 0.0);
    const bgMaroon = rgb(0.18, 0.05, 0.03);
    const red = rgb(0.86, 0.08, 0.1);

    page.drawRectangle({ x: 0, y: 0, width, height, color: bgDark });

    const panelMargin = 35;
    page.drawRectangle({
        x: panelMargin, y: panelMargin,
        width: width - panelMargin * 2, height: height - panelMargin * 2,
        color: bgMaroon
    });

    page.drawRectangle({
        x: panelMargin, y: panelMargin,
        width: width - panelMargin * 2, height: height - panelMargin * 2,
        borderColor: saffron, borderWidth: 3
    });

    const innerMargin = panelMargin + 14;
    page.drawRectangle({
        x: innerMargin, y: innerMargin,
        width: width - innerMargin * 2, height: height - innerMargin * 2,
        borderColor: gold, borderWidth: 1.5
    });

    const cornerSize = 20;
    const corners = [
        { x: innerMargin, y: height - innerMargin - cornerSize },
        { x: width - innerMargin - cornerSize, y: height - innerMargin - cornerSize },
        { x: innerMargin, y: innerMargin },
        { x: width - innerMargin - cornerSize, y: innerMargin }
    ];
    corners.forEach(c => {
        page.drawRectangle({ x: c.x, y: c.y, width: cornerSize, height: cornerSize, color: gold, opacity: 0.6 });
        page.drawRectangle({ x: c.x, y: c.y, width: cornerSize, height: cornerSize, borderColor: gold, borderWidth: 1 });
    });

    const logoPath = path.join(__dirname, 'logo', 'logo.jpeg');
    const logoSize = 180;
    const logoY = 560;
    const logoX = cx - logoSize / 2;
    const logoCenterY = logoY + logoSize / 2;

    if (fs.existsSync(logoPath)) {
        try {
            const logoBytes = fs.readFileSync(logoPath);
            const logoImage = await mergedPdf.embedJpg(logoBytes);

            for (let i = 3; i >= 1; i--) {
                page.drawCircle({
                    x: cx, y: logoCenterY, size: logoSize / 2 + i * 12,
                    color: saffron, opacity: 0.12 / i
                });
            }

            page.drawCircle({
                x: cx, y: logoCenterY, size: logoSize / 2,
                color: rgb(0.98, 0.98, 0.98)
            });

            page.drawImage(logoImage, {
                x: logoX, y: logoY, width: logoSize, height: logoSize
            });

            page.drawCircle({
                x: cx, y: logoCenterY, size: logoSize / 2,
                borderColor: gold, borderWidth: 5
            });
            page.drawCircle({
                x: cx, y: logoCenterY, size: logoSize / 2 + 8,
                borderColor: saffron, borderWidth: 2
            });
        } catch (e) {
            console.warn('Logo skipped:', e.message);
        }
    }

    const nameY = logoY - 8;
    const nameBoxWidth = 340;
    const nameBoxHeight = 40;
    const nameBoxX = cx - nameBoxWidth / 2;

    page.drawRectangle({
        x: nameBoxX, y: nameY, width: 5, height: nameBoxHeight, color: red
    });
    page.drawRectangle({
        x: nameBoxX + nameBoxWidth - 5, y: nameY, width: 5, height: nameBoxHeight, color: red
    });

    const orgText = (orgName && /^[\x00-\x7F\s]+$/.test(orgName)) ? orgName : 'ShivSrushti Boyz';
    page.drawText(orgText, {
        x: cx - 70, y: nameY + 15, size: 20,
        color: gold
    });

    const div1Y = nameY - 6;
    page.drawRectangle({ x: cx - 120, y: div1Y, width: 240, height: 2, color: saffron });
    page.drawRectangle({ x: cx - 70, y: div1Y - 3, width: 140, height: 1, color: gold });

    const festY = nameY - 50;
    const bookText = (subtitle && /^[\x00-\x7F\s]+$/.test(subtitle)) ? subtitle : 'GANPATI FESTIVAL CASHBOOK';
    const tagText = (tagline && /^[\x00-\x7F\s]+$/.test(tagline)) ? tagline : 'Ganpati Festival Cashbook';
    page.drawText(bookText, {
        x: cx - 100, y: festY + 18, size: 18,
        color: saffron
    });
    page.drawText(tagText, {
        x: cx - 80, y: festY - 2, size: 16,
        color: saffron
    });

    page.drawRectangle({ x: cx - 60, y: festY - 16, width: 120, height: 1, color: lightGold });

    const badgeW = 110;
    const badgeH = 45;
    const badgeX = cx - badgeW / 2;
    const badgeY = festY - 70;

    page.drawRectangle({
        x: badgeX, y: badgeY, width: badgeW, height: badgeH,
        borderColor: gold, borderWidth: 2
    });
    page.drawRectangle({
        x: badgeX + 1, y: badgeY + 1, width: badgeW - 2, height: badgeH - 2,
        borderColor: saffron, borderWidth: 0.5
    });
    page.drawText('YEAR', {
        x: cx - 14, y: badgeY + 26, size: 9,
        color: lightGold
    });
    page.drawText(year, {
        x: cx - 16, y: badgeY + 6, size: 20,
        color: gold
    });

    page.drawRectangle({ x: cx - 100, y: 110, width: 200, height: 1, color: lightGold });
    page.drawCircle({ x: cx - 105, y: 112, size: 2, color: saffron });
    page.drawCircle({ x: cx + 105, y: 112, size: 2, color: saffron });

    page.drawText('Developed by | Dhananjay Ranate', {
        x: cx - 80, y: 75, size: 9,
        color: lightGold
    });

    const pagesToCopy = existingPdf.getPageIndices();
    if (pagesToCopy.length > 0) {
        const copiedPages = await mergedPdf.copyPages(existingPdf, pagesToCopy);
        copiedPages.forEach(p => mergedPdf.addPage(p));
    }

    return await mergedPdf.save();
}

app.get('/api/merged-pdf/:filename/:year', async (req, res) => {
    try {
        const { filename, year } = req.params;
        const subtitle = req.query.subtitle || '';
        const tagline = req.query.tagline || '';
        const orgName = req.query.orgName || '';
        const cacheKey = `${filename}_${year}_${subtitle}_${tagline}_${orgName}`;
        const cacheFilename = Buffer.from(cacheKey).toString('base64') + '.pdf';
        const cachePath = path.join(MERGE_CACHE_DIR, cacheFilename);

        if (fs.existsSync(cachePath)) {
            const cachedBytes = fs.readFileSync(cachePath);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="Ganpati_Cashbook_' + year + '.pdf"');
            return res.send(Buffer.from(cachedBytes));
        }

        const mergedBytes = await generateMergedPdf(filename, year, subtitle, tagline, orgName);
        fs.writeFileSync(cachePath, Buffer.from(mergedBytes));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Ganpati_Cashbook_' + year + '.pdf"');
        res.send(Buffer.from(mergedBytes));
    } catch (error) {
        console.error('Merge error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/merge-pdf', express.json(), async (req, res) => {
    try {
        const { filename, year } = req.body;
        console.log('Merge request:', filename, year);
        if (!filename || !year) {
            return res.status(400).json({ success: false, error: 'Filename and year required' });
        }

        const mergedBytes = await generateMergedPdf(filename, year);
        console.log('Merged PDF generated');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Ganpati_Cashbook_' + year + '.pdf"');
        res.setHeader('Content-Length', mergedBytes.length);
        res.send(Buffer.from(mergedBytes));
    } catch (error) {
        console.error('Merge error:', error.message);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
});
