const express = require('express');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcrypt');
const csvParser = require('csv-parser');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const usersCsvFile = path.join(__dirname, 'users.csv');

// Ensure the CSV file exists; if not, create it
if (!fs.existsSync(usersCsvFile)) {
    fs.writeFileSync(usersCsvFile, ''); // Create an empty file if it doesn't exist
}

// Function to read users from CSV and validate login
const hashPassword = async (password) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};

// Function to read users from CSV and validate login
app.post('/api/login', (req, res) => {
    const { passkey } = req.body;
    
    if (!passkey) {
        return res.status(400).json({ message: 'Passkey is required' });
    }

    const users = [];
    fs.createReadStream(usersCsvFile)
        .pipe(csvParser({ headers: ['username', 'hashedPasskey'] }))
        .on('data', (row) => {
            users.push(row);
        })
        .on('end', async () => {
            let userFound = null;
            for (const user of users) {
                const isMatch = await bcrypt.compare(passkey, user.hashedPasskey);
                if (isMatch) {
                    userFound = user;
                    break;
                }
            }

            if (userFound) {
                res.json({
                    success: true,
                    username: userFound.username,
                    isAdmin: userFound.username === 'Admin',
                });
            } else {
                res.status(401).json({ success: false, message: 'Invalid passkey' });
            }
        })
        .on('error', (err) => {
            res.status(500).json({ success: false, message: 'Error reading users CSV file' });
        });
});


// Hash passkeys when adding a new user
app.post('/api/add-user', async (req, res) => {
    const { username, passkey } = req.body;

    if (!username || !passkey) {
        return res.status(400).json({ message: 'Username and passkey are required' });
    }

    // Hash the passkey
    const hashedPasskey = await hashPassword(passkey);

    // Save the username and hashed passkey to the CSV file
    const newUser = `${username},${hashedPasskey}\n`;
    fs.appendFile(usersCsvFile, newUser, (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error writing to CSV file' });
        }
        res.json({ message: 'User added successfully' });
    });
});

// Endpoint to save configuration settings (Admin only)
app.post('/api/config', (req, res) => {
    const { username, settings } = req.body;

    if (username !== 'Admin') {
        return res.status(403).json({ message: 'Forbidden: Only Admin can update settings' });
    }

    const jsonData = JSON.stringify(settings, null, 2);
    fs.writeFile('config.json', jsonData, (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error saving configuration' });
        }
        res.json({ message: 'Configuration saved successfully' });
    });
});

// Endpoint to get URLs from the json file
app.get('/api/urls', (req, res) => {

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }
        // Parse JSON data
        const jsonData = JSON.parse(data);
        res.json(jsonData);
    });
});

// Endpoint to add new URLs to the json file
app.post('/api/set_urls', async (req, res) => {
    const { newUrls, who } = req.body;

    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth() + 1;
    const utcDay = now.getUTCDate();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcSeconds = now.getUTCSeconds();

    const formattedUTCDateTime = `${utcYear}-${utcMonth}-${utcDay} ${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

    let data = [];

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', (err, preData) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }
        // Parse JSON data
        data = JSON.parse(preData);

        newUrls.map(el => {
            data.push({
                url: el,
                date: formattedUTCDateTime,
                who: who,
                reset: 0
            })
        });

        const jsonData = JSON.stringify(data, null, 2); // 'null, 2' for pretty formatting

        fs.writeFile('domain.json', jsonData, (err) => {
            if (err) {
                console.error('Error writing file', err);
            } else {
                console.log('File successfully written');
                res.json({ msg: 'success' });
            }
        });
    });

});

// Delete manageURL
app.post('/api/urls', (req, res) => {
    
    const { removeURL } = req.body;

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }
        // Parse JSON data
        const preData = JSON.parse(data);
        
        const updated = preData.filter(el => el.url != removeURL);

        const jsonData = JSON.stringify(updated, null, 2); // 'null, 2' for pretty formatting

        fs.writeFile('domain.json', jsonData, (err) => {
            if (err) {
                console.error('Error writing file', err);
            } else {
                console.log('File successfully written');
                res.json({ msg: 'success' });
            }
        });
    });
})



// Endpoint to add new URLs to the CSV file
app.post('/api/set_individual', (req, res) => {
    const { newUrls } = req.body;
    const domain = newUrls[0];

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', async(err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }
        // Parse JSON data
        const preData = JSON.parse(data);
        
        await preData.map(el => {
            if (el.url == domain) {
                el.reset = 1;
            }
        });

        const jsonData = JSON.stringify(preData, null, 2); // 'null, 2' for pretty formatting

        fs.writeFile('domain.json', jsonData, (err) => {
            if (err) {
                console.error('Error writing file', err);
            } else {
                console.log('File successfully written');
                res.json({ msg: 'success' });
            }
        });
        
    });

});


// delete individual url setting in csv file
app.post('/api/del_individual', (req, res) => {
    const { domain } = req.body;

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', async(err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }
        // Parse JSON data
        const preData = JSON.parse(data);
        
        await preData.map(el => {
            if (el.url == domain) {
                el.reset = 0;
            }
        });

        const jsonData = JSON.stringify(preData, null, 2); // 'null, 2' for pretty formatting

        fs.writeFile('domain.json', jsonData, (err) => {
            if (err) {
                console.error('Error writing file', err);
            } else {
                console.log('File successfully written');
                res.json({ msg: 'success' });
            }
        });
        
    });

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
