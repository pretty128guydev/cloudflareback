const express = require('express');
const cors = require('cors');
const fs = require('fs');
const csvParser = require('csv-parser');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const csvFilePath = path.join(__dirname, 'urls.csv');

// Ensure the CSV file exists; if not, create it
if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, ''); // Create an empty file if it doesn't exist
}

// Endpoint to get URLs from the CSV file
app.get('/api/urls', (req, res) => {
    const urls = [];

    fs.createReadStream(csvFilePath)
        .pipe(csvParser({ headers: false }))
        .on('data', (row) => {
            if (row[0]) {
                urls.push(row[0].trim());
            }
        })
        .on('end', () => {
            res.json(urls);
        })
        .on('error', (err) => {
            res.status(500).json({ message: 'Error reading the CSV file' });
        });
});

// Endpoint to add new URLs to the CSV file
app.post('/api/urls', (req, res) => {
    const { newUrls } = req.body;

    if (!Array.isArray(newUrls) || newUrls.length === 0) {
        return res.status(400).json({ message: 'Invalid input: newUrls must be a non-empty array' });
    }

    const csvContent = newUrls.map(url => `"${url}"`).join('\n') + '\n';

    fs.appendFile(csvFilePath, csvContent, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error writing to CSV' });
        }
        res.json({ message: 'URLs added successfully' });
    });
});



// Endpoint to get URLs from the CSV file including individual url setting
app.get('/api/get_individual', (req, res) => {

    fs.readFile('urls.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }
        const jsonData = JSON.parse(data);
        res.json(jsonData.url)
    })

});



// Endpoint to add new URLs to the CSV file
app.post('/api/set_individual', (req, res) => {
    const { newUrls } = req.body;
    const domain = newUrls[0];

    fs.readFile('urls.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }
        const jsonData = JSON.parse(data);

        let isExist = jsonData.url.includes(domain);

        if (!isExist) {
            const newURLs = jsonData.url;
            newURLs.push(domain);

            const newData = {
                url: newURLs
            }

            const newJsonData = JSON.stringify(newData, null, 2);
            fs.writeFileSync('urls.json', newJsonData, 'utf-8');
        }

        return res.json({ message: "Set edit configuration flag" })

    });

});


// delete individual url setting in csv file
app.post('/api/del_individual', (req, res) => {
    const { domain } = req.body;

    fs.readFile('urls.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }
        const jsonData = JSON.parse(data);
        const newURLs = jsonData.url.filter(item => item !== domain);

        const newData = {
            url: newURLs
        }
        const newJsonData = JSON.stringify(newData, null, 2);
        fs.writeFileSync('urls.json', newJsonData, 'utf-8');
    })

});


// save the global settings into json file
app.post('/api/set_settings', (req, res) => {
    const data = req.body;
    const jsonData = JSON.stringify(data, null, 2);

    fs.writeFile('save.json', jsonData, (err) => {
        if (err) {
            console.error('Error writing file', err);
        } else {
            console.log('File written successfully');
        }
    });
})

// get global settings from json file
app.get('/api/get_settings', (req, res) => {

    fs.readFile('save.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }
        const jsonData = JSON.parse(data);
        res.json(jsonData);
    });
})



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
