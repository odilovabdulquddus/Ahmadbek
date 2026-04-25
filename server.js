const express = require("express");
const path = require("path");

const app = express();

// static fayllar (index.html)
app.use(express.static(path.join(__dirname)));

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server ishlayapti: http://localhost:${PORT}`);
});