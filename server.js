const express = require('express');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcrypt');
const csvParser = require('csv-parser');
const path = require('path');
const http = require('http');
const https = require('https');
const linkCheck = require('link-check');

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


// Save the data in Global Variable from all sites
let analyzeData = [];
let chartData = [];

// setDataFromURLs();

// function setDataFromURLs () {
//     // initalize analyzeData
//     let inital_analyzeData = [];
//     // Read the JSON file asynchronously
//     fs.readFile('domain.json', 'utf8', async (err, data) => {
//         if (err) {
//             console.error('Error reading file', err);
//             return;
//         }
//         // Parse JSON data
//         const jsonData = JSON.parse(data);

//         // get Data based on URLs
//         for (const site of jsonData) {

//             linkCheck(`${site.url}`, async function (err, result) {
//                 if (err) {
//                     console.error(err);
//                     return;
//                 }

//                 if (result.status == 'alive') {
//                     const result = await getDataFromURLs(site);
//                     inital_analyzeData.push(result);
//                 }

//                 if (result.status == 'dead') {
//                     let tmpData = {};
//                     tmpData.url = site.url;
//                     tmpData.visitors = '--';
//                     tmpData.totalDownloads = '--';
//                     tmpData.lastDownload = '--';
//                     tmpData.countryCode = '--';
//                     tmpData.countryName = '--';
//                     tmpData.downloadCount = '--';
//                     tmpData.isLive = false;
//                     tmpData.isReset = site.reset;
//                     tmpData.who = site.who;

//                     inital_analyzeData.push(tmpData);
//                 }
//                 if (inital_analyzeData.length == jsonData.length) {
//                     analyzeData = inital_analyzeData;
//                     setDataFromURLs();
//                 }
//             });
//         }
//     });
// }


setDataFromURLs();

let readyData = [];
let removeURLs = [];
let ready_chartData = [];

function setDataFromURLs() {
    fs.readFile('domain.json', 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }

        const jsonData = JSON.parse(data);

        ready_chartData = [];

        const promises = jsonData.map((site) => {
            return new Promise((resolve) => {
                linkCheck(`${site.url}`, async function (err, result) {
                    if (err) {
                        console.error(err);
                        resolve(); // Resolve without data if there's an error
                        return;
                    }

                    if (result.status === 'alive') {
                        const resultData = await getDataFromURLs(site);

                        let readyCount = 0, index = 0;
                        for (const data of readyData) {
                            if (data.url == site.url) {
                                readyData[index] = resultData;
                                readyCount++;
                            }
                            index++;
                        }
                        if (readyCount == 0) readyData.push(resultData);

                        resolve(resultData); // Resolve with live site data
                    } else if (result.status === 'dead') {
                        const tmpData = {
                            url: site.url,
                            visitors: '--',
                            totalDownloads: '--',
                            lastDownload: '--',
                            countryCode: '--',
                            countryName: '--',
                            downloadCount: '--',
                            isLive: false,
                            isReset: site.reset,
                            who: site.who,
                        };

                        let readyCount = 0, index = 0;
                        for (const data of readyData) {
                            if (data.url == site.url) {
                                readyData[index] = tmpData;
                                readyCount++;
                            }
                            index++;
                        }
                        if (readyCount == 0) readyData.push(tmpData);

                        resolve(tmpData); // Resolve with dead site data
                    }
                });
            });
        });

        try {
            const results = await Promise.all(promises);
            // analyzeData = results;

            if (removeURLs.length > 0) {

                removeURLs.forEach((remove) => {
                    readyData.forEach((item, index) => {
                        if (remove == item.url) {
                            readyData.splice(index, 1);
                        }
                    })
                })

                removeURLs = [];
            }

            analyzeData = readyData;
            chartData = ready_chartData;

            // Add a delay before calling the function again to prevent immediate re-run
            setTimeout(() => {
                setDataFromURLs();
            }, 6000); // Wait 6 seconds before rerunning the function
        } catch (error) {
            console.error('Error in processing URLs:', error);
        }
    });
}

async function getDataFromURLs(site) {
    const isHttps = site.url.includes('https://');
    const protocal = isHttps ? https : http;

    const options = {
        hostname: isHttps ? site.url.replace('https://', '') : site.url.replace('http://', ''),
        port: isHttps ? 443 : 80,
        path: '/api/getData.php',
        method: 'POST',
    };

    try {
        const data = await new Promise((resolve, reject) => {
            const req = protocal.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.end();
        });

        const res_data = JSON.parse(data);

        let tmpData = {};
        tmpData.url = site.url;
        tmpData.visitors = res_data.length;
        tmpData.totalDownloads = res_data.filter((el) => el.isDownload === 'Downloaded').length;
        tmpData.lastDownload = res_data.filter((el) => el.isDownload === 'Downloaded').length > 0
            ? res_data.reverse().filter((el) => el.isDownload === 'Downloaded')[0].date
            : '--';
        tmpData.countryCode = getCountryCodeAndCount(res_data)[0]?.country;
        tmpData.downloadCount = getCountryCodeAndCount(res_data)[0]?.count;
        tmpData.visitorCount = getCountryCodeAndCount(res_data)[0]?.visit;
        tmpData.countryCode1 = getCountryCodeAndCount(res_data)[1]?.country;
        tmpData.downloadCount1 = getCountryCodeAndCount(res_data)[1]?.count;
        tmpData.visitorCount1 = getCountryCodeAndCount(res_data)[1]?.visit;
        tmpData.countryCode2 = getCountryCodeAndCount(res_data)[2]?.country;
        tmpData.downloadCount2 = getCountryCodeAndCount(res_data)[2]?.count;
        tmpData.visitorCount2 = getCountryCodeAndCount(res_data)[2]?.visit;
        tmpData.isLive = true;
        tmpData.isReset = site.reset;
        tmpData.who = site.who;
        tmpData.visitCount = res_data.length;
        tmpData.all = res_data;

        ready_chartData.push(res_data);

        return tmpData;

    } catch (error) {
        let tmpData = {};
        tmpData.url = site.url;
        tmpData.visitors = '--';
        tmpData.totalDownloads = '--';
        tmpData.lastDownload = '--';
        tmpData.countryCode = '--';
        tmpData.downloadCount = '--';
        tmpData.countryCode1 = '--';
        tmpData.downloadCount1 = '--';
        tmpData.countryCode2 = '--';
        tmpData.downloadCount2 = '--';
        tmpData.isLive = false;
        tmpData.isReset = site.reset;
        tmpData.who = site.who;

        return tmpData;
    }
}


// get country code and count
const getCountryCodeAndCount = (data) => {

    let country = [];
    data.map(el => {
        if (!country.includes(el.country_code)) country.push(el.country_code);
    });

    let final = [];
    for (const el of country) {
        let count = 0;
        let countVisit = 0;
        let visit = 0;
        for (const all of data) {
            if (el == all.country_code && all.isDownload == 'Downloaded') count++;
            if (el == all.country_code && all.isDownload != 'Downloaded') countVisit++;
            if (el == all.country_code) visit++;
        }
        final.push({
            country: el,
            count: count,
            visit: countVisit,
            total: visit
        })
    }

    for (let i = 0; i < final.length; i++) {
        for (let j = 0; j < final.length; j++) {
            if (final[i].total > final[j].total) {
                const c = final[i];
                final[i] = final[j];
                final[j] = c;
            }
        }
    }

    return final;
};


//  Function to get analyzed data based on URLs
app.get('/api/get_result', (req, res) => {
    res.json(analyzeData);
})

// Function to get data for chart
// app.post('/api/get_chartData', (req, res) => {

//     const demo_req = {
//         mark: req.body.mark,
//         month_from: getYearMonth(req.body.day_from),
//         month_to: getYearMonth(req.body.day_to),
//         week_from: getISOWeek(req.body.day_from),
//         week_to: getISOWeek(req.body.day_to),
//         day_from: req.body.day_from,
//         day_to: req.body.day_to,
//         version: req.body.version,
//         country: req.body.country
//     }

//     const readyAllData = [];
//     let readyCountry = [];

//     chartData.map(el => {
//         el.map(item => readyAllData.push(item));
//     })

//     readyAllData.map(i => {
//         let count = 0;
//         readyCountry.map(j => {
//             if (i.country_code == j.country) count++;
//         })
//         if (count == 0) {
//             readyCountry.push({
//                 country: i.country_code,
//                 data: []
//             })
//         }
//     })

//     switch (demo_req.mark) {
//         case "day":

//             // when day
//             const everyday = getDatesInRange(demo_req.day_from, demo_req.day_to);

//             for (const day of everyday) {
//                 for (const country of readyCountry) {
//                     let count = 0;
//                     for (const data of readyAllData) {
//                         if (country.country == data.country_code && day == data.date.split(' ')[0] && data.isDownload == 'Downloaded' && demo_req.version.includes(data.version)) count++;
//                     }

//                     readyCountry.map(el => {
//                         if (el.country == country.country) el.data.push(count);
//                     })
//                 }
//             }

//             const resultDay = {
//                 mainData: readyCountry,
//                 date: everyday
//             }

//             let countryFilter = [];
//             resultDay.mainData.map(el => {
//                 if (demo_req.country.includes(el.country)) countryFilter.push(el);
//             })

//             resultDay.mainData = countryFilter;

//             res.json(resultDay);

//             break;

//         case "month":

//             // when month
//             const everymonth = getMonthlyDatesInRange(demo_req.month_from, demo_req.month_to);

//             for (const month of everymonth) {
//                 for (const country of readyCountry) {
//                     let count = 0;
//                     for (const data of readyAllData) {
//                         const isMonth = isDateInMonth(data.date, month);
//                         if (isMonth && data.isDownload == 'Downloaded' && demo_req.version.includes(data.version) && country.country == data.country_code) count++;
//                     }

//                     readyCountry.map(el => {
//                         if (el.country == country.country) el.data.push(count);
//                     })
//                 }
//             }

//             const resultMonth = {
//                 mainData: readyCountry,
//                 date: everymonth
//             }

//             let countryFilter_month = [];
//             resultMonth.mainData.map(el => {
//                 if (demo_req.country.includes(el.country)) countryFilter_month.push(el);
//             })

//             resultMonth.mainData = countryFilter_month;

//             res.json(resultMonth);

//             break;

//         case "week":

//             // when week
//             const everyweek = getWeeksInRange(demo_req.week_from, demo_req.week_to);

//             for (const week of everyweek) {
//                 for (const country of readyCountry) {
//                     let count = 0;
//                     for (const data of readyAllData) {
//                         const isWeek = isDateInISOWeek(data.date, week);
//                         if (isWeek && data.isDownload == 'Downloaded' && demo_req.version.includes(data.version) && country.country == data.country_code) count++;
//                     }

//                     readyCountry.map(el => {
//                         if (el.country == country.country) el.data.push(count);
//                     })
//                 }
//             }

//             const resultWeek = {
//                 mainData: readyCountry,
//                 date: everyweek
//             }

//             let countryFilter_week = [];
//             resultWeek.mainData.map(el => {
//                 if (demo_req.country.includes(el.country)) countryFilter_week.push(el);
//             })

//             resultWeek.mainData = countryFilter_week;

//             res.json(resultWeek);

//             break;

//         default:
//             break;
//     }


// })

// Asssit Function

function getISOWeek(dateString) {
    const date = new Date(dateString);
    // Set date to Thursday of the same week to align with ISO week rules
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    // Start of the year
    const yearStart = new Date(date.getFullYear(), 0, 1);
    // Calculate ISO week number
    const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    // ISO format: "YYYY-W##"
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getYearMonth(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');  // Months are 0-indexed
    return `${year}-${month}`;
}

function getDatesInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateArray = [];

    // Iterate over each day
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        dateArray.push(new Date(current).toISOString().split("T")[0]);  // Format as YYYY-MM-DD
    }

    return dateArray;
}


function getMonthlyDatesInRange(startMonth, endMonth) {
    const dates = [];
    const start = new Date(startMonth + "-01");
    const end = new Date(endMonth + "-01");

    // Iterate over each month
    for (let current = new Date(start); current <= end; current.setMonth(current.getMonth() + 1)) {
        dates.push(new Date(current).toISOString().slice(0, 7));  // Format as YYYY-MM
    }

    return dates;
}

function isDateInMonth(dateString, monthString) {
    const date = new Date(dateString);
    const targetYearMonth = monthString.split("-");

    const yearMatches = date.getFullYear() === parseInt(targetYearMonth[0], 10);
    const monthMatches = (date.getMonth() + 1) === parseInt(targetYearMonth[1], 10);

    return yearMatches && monthMatches;
}


function getWeeksInRange(startWeek, endWeek) {
    const weeks = [];

    // Parse year and week number from start and end inputs
    let [startYear, startWeekNum] = startWeek.split("-W").map(Number);
    const [endYear, endWeekNum] = endWeek.split("-W").map(Number);

    // Iterate through each week from start to end
    while (startYear < endYear || (startYear === endYear && startWeekNum <= endWeekNum)) {
        weeks.push(`${startYear}-W${String(startWeekNum).padStart(2, '0')}`);

        // Increment week, roll over to next year if necessary
        startWeekNum++;
        if (startWeekNum > 52) {
            startWeekNum = 1;
            startYear++;
        }
    }

    return weeks;
}

function isDateInISOWeek(dateString, weekString) {
    const date = new Date(dateString);

    // Get the year and week number from the target week string
    const [targetYear, targetWeek] = weekString.split("-W").map(Number);

    // Adjust the date to Thursday of the same week to align with ISO week rules
    date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));

    // Get the ISO week year
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const weekNumber = Math.ceil(((date - yearStart) / (7 * 24 * 60 * 60 * 1000)) + 1);

    // Check if the date's ISO year and week match the target
    return date.getUTCFullYear() === targetYear && weekNumber === targetWeek;
}


// Function to get data for all count
app.post('/api/allCount', (req, res) => {
    const readyAllData = [];
    let readyCountry = [];
    let result = [];

    const dateType = req.body.type;
    const day = getCurrentDate();
    const week = getCurrentWeek();
    const month = getCurrentMonth();


    switch (dateType) {
        case "all":
            analyzeData.map(el => {
                el.all?.map(item => readyAllData.push(item));
            })
            break;
        case "day":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (item.date?.split(' ')[0] == day) readyAllData.push(item);
                });
            })
            break;
        case "month":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (isDateInMonth(item.date?.split(' ')[0], month)) readyAllData.push(item);
                });
            })
            break;
        case "week":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (isDateInISOWeek(item.date?.split(' ')[0], week)) readyAllData.push(item);
                });
            })
            break;
        default:
            break;
    }


    readyAllData.map(el => {
        if (!readyCountry.includes(el.country_code)) readyCountry.push(el.country_code);
    })

    for (const i of readyCountry) {
        let count = 0;
        let visitorCount = 0;
        for (const j of readyAllData) {
            if (i == j.country_code && j.isDownload == 'Downloaded') count++;
            if (i == j.country_code && j.isDownload != 'Downloaded') visitorCount++;
        }

        result.push({
            countryCode: i,
            downloadCount: count,
            visitorCount: visitorCount,
        })
    }

    res.json(result);
})

// Function to get data for all count
app.post('/api/allVersions', (req, res) => {
    const readyAllData = [];
    let result = [];

    const dateType = req.body.type;
    const day = getCurrentDate();
    const week = getCurrentWeek();
    const month = getCurrentMonth();

    switch (dateType) {
        case "all":
            analyzeData.map(el => {
                el.all?.map(item => readyAllData.push(item));
            })
            break;
        case "day":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (item.date?.split(' ')[0] == day) readyAllData.push(item);
                });
            })
            break;
        case "month":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (isDateInMonth(item.date?.split(' ')[0], month)) readyAllData.push(item);
                });
            })
            break;
        case "week":
            analyzeData.map(el => {
                el.all?.map(item => {
                    if (isDateInISOWeek(item.date?.split(' ')[0], week)) readyAllData.push(item);
                });
            })
            break;
        default:
            break;
    }




    let version1 = 0;
    let version2 = 0;
    let version3 = 0;
    let visitor1 = 0;
    let visitor2 = 0;
    let visitor3 = 0;
    for (const j of readyAllData) {
        if (j.isDownload == 'Downloaded' && j.version == 'V1') version1++;
        if (j.isDownload == 'Downloaded' && j.version == 'V2') version2++;
        if (j.isDownload == 'Downloaded' && j.version == 'V3') version3++;
        if (j.isDownload !== 'Downloaded' && j.version == 'V1') visitor1++;
        if (j.isDownload !== 'Downloaded' && j.version == 'V2') visitor2++;
        if (j.isDownload !== 'Downloaded' && j.version == 'V3') visitor3++;
    }

    result.push({
        version1: version1,
        version2: version2,
        version3: version3,
        visitor1: visitor1,
        visitor2: visitor2,
        visitor3: visitor3
    })

    res.json(result);
})


// Function to get country's download order
app.post('/api/getCountryOrder', (req, res) => {

    fs.readFile('domain.json', 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }

        const jsonData = JSON.parse(data);

        let site = '';
        jsonData.map(el => {
            if (el.url.includes(req.body.domain)) site = el.url;
        })

        const response = await getDataFromURLs({ url: site });
        const resData = {
            first: { country: response.countryCode, download: response.downloadCount, visitor: response.visitorCount },
            second: { country: response.countryCode1, download: response.downloadCount1, visitor: response.visitorCount1 },
            third: { country: response.countryCode2, download: response.downloadCount2, visitor: response.visitorCount2 }
        }

        res.json(resData);
    });

})

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

    removeURLs.push(removeURL);

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

async function checkSites(data) {
    const jsonData = JSON.parse(data);

    let alives = [];

    // Use Promise.all to handle the async map
    await Promise.all(
        jsonData.map(site => {
            return new Promise((resolve, reject) => {
                linkCheck(site.url, (err, result) => {
                    if (err) {
                        console.error(err);
                        resolve(); // Resolve without data if there's an error
                        return;
                    }
                    if (result.status === 'alive') {
                        alives.push(result.link);
                    }
                    resolve(); // Resolve even if the status is not 'alive'
                });
            });
        })
    );
    return alives; // Return the array of alive links after all checks are done
}


// Endpoint to add new URLs to the CSV file
app.post('/api/set_individual', (req, res) => {
    const { newUrls } = req.body;
    const domain = newUrls[0];

    for (const data of analyzeData) {
        if (data.url == domain) data.isReset = 1;
    }
    for (const data of readyData) {
        if (data.url == domain) data.isReset = 1;
    }

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', async (err, data) => {
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

    for (const data of analyzeData) {
        if (data.url == domain) data.isReset = 0;
    }
    for (const data of readyData) {
        if (data.url == domain) data.isReset = 0;
    }

    // Read the JSON file asynchronously
    fs.readFile('domain.json', 'utf8', async (err, data) => {
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


// get one based on domain
app.post('/api/getOne', (req, res) => {

    fs.readFile('domain.json', 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading file', err);
            return;
        }

        const jsonData = JSON.parse(data);

        jsonData.map(el => {
            if (el.url.toLowerCase().includes(req.body.domain)) {
                res.json({ url: el.url, who: el.who });
            }
        })
    });
})


// Function to get top 10 country's info
app.post('/api/getTop10Country', (req, res) => {

    const dateType = req.body.type;
    const day = getCurrentDate();
    const week = getCurrentWeek();
    const month = getCurrentMonth();

    let ownData = [];

    const analyzeDataDemo = analyzeData.filter(item => item.visitCount);

    switch (dateType) {
        case "all":
            analyzeDataDemo.map((i, index) => {
                let visitor = 0;
                let download = 0;
                chartData[index].map(j => {
                    visitor++;
                    if (j.isDownload == 'Downloaded') download++;
                })
                ownData.push({
                    url: i.url,
                    visitors: visitor,
                    totalDownloads: download
                })
            })
            break;
        case "day":
            analyzeDataDemo.map((i, index) => {
                let visitor = 0;
                let download = 0;
                chartData[index].map(j => {
                    if (j.date?.split(' ')[0] == day) visitor++;
                    if (j.isDownload == 'Downloaded' && j.date?.split(' ')[0] == day) download++;
                })
                ownData.push({
                    url: i.url,
                    visitors: visitor,
                    totalDownloads: download
                })
            })
            break;
        case "month":
            analyzeDataDemo.map((i, index) => {
                let visitor = 0;
                let download = 0;
                chartData[index].map(j => {
                    if (isDateInMonth(j.date?.split(' ')[0], month)) visitor++;
                    if (j.isDownload == 'Downloaded' && isDateInMonth(j.date?.split(' ')[0], month)) download++;
                })
                ownData.push({
                    url: i.url,
                    visitors: visitor,
                    totalDownloads: download
                })
            })
            break;
        case "week":
            analyzeDataDemo.map((i, index) => {
                let visitor = 0;
                let download = 0;
                chartData[index].map(j => {
                    if (isDateInISOWeek(j.date?.split(' ')[0], week)) visitor++;
                    if (j.isDownload == 'Downloaded' && isDateInISOWeek(j.date?.split(' ')[0], week)) download++;
                })
                ownData.push({
                    url: i.url,
                    visitors: visitor,
                    totalDownloads: download
                })
            })
            break;
        default:
            break;
    }


    for (let i = 0; i < ownData.length; i++) {
        for (let j = 0; j > ownData; j++) {
            if (ownData[i].visitCount < ownData[j].visitCount) {
                const C = ownData[i];
                ownData[i] = ownData[j];
                ownData[j] = C;
            }
        }
    }

    let needData = [];
    let ownLength;
    if (ownData.length >= 10) ownLength = 10;
    else ownLength = ownData.length;

    for (let i = 0; i < ownLength; i++) {
        const data = {
            site: ownData[i].url,
            visit: ownData[i].visitors,
            download: ownData[i].totalDownloads
        }
        needData.push(data);
    }

    res.json(needData);

})

// Function to check if the date is in week
function getISOWeek(date) {
    const tempDate = new Date(date);
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
    return `${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isDateInISOWeek(dateString, isoWeekString) {
    return getISOWeek(new Date(dateString)) === isoWeekString;
}



// Function to get current date
function getCurrentDate() {
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(currentDate.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}

// Function to get current week
function getCurrentWeek() {
    function getISOWeekNumber(date) {
        // Copy date to avoid modifying the original
        const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        // Set to nearest Thursday: current date + 4 - current day number
        current.setUTCDate(current.getUTCDate() + 4 - (current.getUTCDay() || 7));

        // First day of the year
        const startOfYear = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));

        // Calculate full weeks to nearest Thursday
        const weekNumber = Math.ceil(((current - startOfYear) / 86400000 + 1) / 7);

        return weekNumber;
    }

    function getISOWeekString() {
        const date = new Date();
        const year = date.getFullYear();
        const week = getISOWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    return getISOWeekString();
}

// Function to get current month
function getCurrentMonth() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Add 1 to getMonth() and pad with zero if needed

    const formattedDate = `${year}-${month}`;
    return formattedDate;
}


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
