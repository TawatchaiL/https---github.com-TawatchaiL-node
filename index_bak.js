const { RPCServer, createRPCError } = require('ocpp-rpc');

const mysql = require('mysql');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'evchart1'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database: ', err);
        return;
    }
    console.log('Connected to MySQL database');
});

const server = new RPCServer({
    protocols: ['ocpp1.6'], 
    strictMode: true,      
});

server.auth((accept, reject, handshake) => {
    accept({
        sessionId: 'XYZ123'
    });
});

server.on('client', async (client) => {
    console.log(`${client.session.sessionId} connected!`); 
    
    client.handle('BootNotification', ({params}) => {
        console.log(`Server got BootNotification from ${client.identity}:`, params);

        const clientIdentity = client.identity;
        const chargePointVendor = params.chargePointVendor;
        const chargePointModel = params.chargePointModel;
        const chargePointSerialNumber = params.chargePointSerialNumber;
        const chargeBoxSerialNumber = params.chargeBoxSerialNumber;
        const firmwareVersion = params.firmwareVersion;
        const iccid =  params.iccid;
        const imsi = params.imsi;
        const meterType = params.meterType;
        const meterSerialNumber = params.meterSerialNumber;
        const currentTime = new Date().toISOString();
    
        // Insert the data into the MySQL database
        const query = 'INSERT INTO bootnotification (clientIdentity, chargePointVendor, chargePointModel, chargePointSerialNumber, chargeBoxSerialNumber, firmwareVersion, iccid, imsi, meterType, meterSerialNumber, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [clientIdentity, chargePointVendor, chargePointModel, chargePointSerialNumber, chargeBoxSerialNumber, firmwareVersion, iccid, imsi, meterType, meterSerialNumber, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });

        return {
            status: "Accepted",
            interval: 300,
            currentTime: new Date().toISOString()
        };
    });

    client.handle('Heartbeat', ({params}) => {
        console.log(`Server got Heartbeat from ${client.identity}:`, params);

        // respond with the server's current time.
        return {
            currentTime: new Date().toISOString()
        };
    });
    
    // create a specific handler for handling StatusNotification requests
    client.handle('StatusNotification', ({params}) => {
        console.log(`Server got StatusNotification from ${client.identity}:`, params);
        return {};
    });
/*
    client.handle('Authorize', ({params}) => {
        console.log(`Server got Authorize from ${client.identity}:`, params);

        const { idTag } = params;

        if (idTag === 'B4A63CDF' || idTag === '23F532C35' || idTag === '829FEAB') {
            return {
                idTagInfo: {
                    status: 'Accepted'
                }
            };
        } else {
            return {
                idTagInfo: {
                    status: 'Invalid'
                }
            };
        }
    });
*/

    client.handle('Authorize', async ({ params }) => {
        console.log(`Server got Authorize from ${client.identity}:`, params);

        const { idTag } = params;

        try {
            const results = await executeQuery(`SELECT * FROM rfids WHERE rfidid = '${idTag}'`);

            if (results.length > 0) {
                return {
                    idTagInfo: {
                        status: 'Accepted'
                    }
                };
            } else {
                return {
                    idTagInfo: {
                        status: 'Invalid'
                    }
                };
            }
        } catch (err) {
            console.error('Error executing SQL query:', err);
            return {
                idTagInfo: {
                    status: 'Error'
                }
            };
        }
    });

    // Function to execute SQL query
    const executeQuery = (query) => {
        return new Promise((resolve, reject) => {
            connection.query(query, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    };
    
    client.handle('StartTransaction', ({ params }) => {
            console.log(`Server got StartTransaction from ${client.identity}:`, params);
    
            const { idTag, meterStart, timestamp, connectorId } = params;

            const transactionId = Math.floor(Math.random() * 100000);
    
            return {
                idTagInfo: {
                    status: 'Accepted'
                },
                transactionId: transactionId
            };
    });
/*
    client.handle('MeterValues', ({ params }) => {
            console.log(`Server got MeterValues from ${client.identity}:`, params);
    
            const { connectorId, transactionId, meterValue } = params;

            meterValue.forEach(value => {
                console.log(`Meter Value: ${JSON.stringify(value)}`);
            });
    
            return {};
    });
*/

        client.handle('MeterValues', ({ params }) => {
            console.log(`Server got MeterValues from ${client.identity}:`, params);
    
            const { connectorId, transactionId, meterValue } = params;
    
            // Process meter values
            meterValue.forEach(value => {
                console.log(`Meter Value: ${JSON.stringify(value)}`);
    
                // Check if power exceeds threshold (e.g., 7 kW)
                if (!chargingStopped && value.value > 7) {
                    console.log(`Power threshold exceeded. Stopping charging.`);
                    chargingStopped = true;
                    // Send StopTransaction to stop charging
                    client.call('StopTransaction', {
                        transactionId: transactionId,
                        idTag: "stopCharge",
                        timestamp: new Date().toISOString(),
                        meterStop: value.value,
                        reason: "TimeLimitReached" // You can specify your own reason
                    }).then(response => {
                        console.log(`StopTransaction response:`, response);
                    }).catch(error => {
                        console.error(`Failed to send StopTransaction:`, error);
                    });
                }
            });
    
            return {}; // Respond with an empty object to acknowledge receipt
        });

    client.handle(({method, params}) => {
        console.log(`Server got ${method} from ${client.identity}:`, params);
        throw createRPCError("NotImplemented");
    });
});

server.listen(3000);