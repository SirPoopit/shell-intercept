const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to list .csv files in the "hulls" folder
app.get('/hulls', (req, res) => {
  const hullsDir = path.join(__dirname, 'public', 'hulls');
  fs.readdir(hullsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list files' });
    }
    // Filter .csv files only
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    res.json(csvFiles);
  });
});

// Route to list .asset files in the "shells" folder
app.get('/shells', (req, res) => {
  const shellsDir = path.join(__dirname, 'public', 'shells');
  fs.readdir(shellsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list files' });
    }
    // Filter .asset files only
    const assetFiles = files.filter(file => file.endsWith('.asset'));
    res.json(assetFiles);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
