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
        const query = 'INSERT INTO mbootnotification (clientIdentity, chargePointVendor, chargePointModel, chargePointSerialNumber, chargeBoxSerialNumber, firmwareVersion, iccid, imsi, meterType, meterSerialNumber, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [clientIdentity, chargePointVendor, chargePointModel, chargePointSerialNumber, chargeBoxSerialNumber, firmwareVersion, iccid, imsi, meterType, meterSerialNumber, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });

        return {
            status: "Accepted",
            interval: 20,
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

        const { connectorId, status, errorCode, info, timestamp, vendorId, vendorErrorCode} = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();

        const query = 'INSERT INTO mstatusnotification (clientIdentity, connectorId, status, errorCode, info, timestamp, vendorId, vendorErrorCode, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [clientIdentity, connectorId, status, errorCode, info, timestamp, vendorId, vendorErrorCode, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });

        const updateQuery = 'UPDATE evdevices SET devicestatus = ? WHERE evdeviceid = ?';
        connection.query(updateQuery, [status, clientIdentity], (updateError, updateResults, updateFields) => {
            if (updateError) {
                console.error('Error updating evdevices table in MySQL:', updateError.stack);
                return;
            }
            console.log('evdevices table updated in MySQL, affected rows:', updateResults.affectedRows);
        });

        return {};
    });

    client.handle('Authorize', async ({ params }) => {
        console.log(`Server got Authorize from ${client.identity}:`, params);

        const { idTag } = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();

        try {
            const results = await executeQuery(`SELECT * FROM rfids WHERE rfidid = '${idTag}'`);

            let status;
            if (results.length > 0) {
                status = 'Accepted';
            } else {
                status = 'Invalid';
            }

            const query = 'INSERT INTO mauthorize (clientIdentity, idTag, status, currentTime) VALUES (?, ?, ?, ?)';
            connection.query(query, [clientIdentity, idTag, status, currentTime], (error, results, fields) => {
                if (error) {
                    console.error('Error inserting data into MySQL:', error.stack);
                    return;
                }
                console.log('Data inserted into MySQL, ID:', results.insertId);
            });

            return {
                idTagInfo: {
                    status: status
                }
            };
        } catch (err) {
            console.error('Error executing SQL query:', err);
            return {
                idTagInfo: {
                    status: 'Error'
                }
            };
        }
    });
    
    client.handle('StartTransaction', ({ params }) => {
            console.log(`Server got StartTransaction from ${client.identity}:`, params);
    
            const { idTag, meterStart, timestamp, connectorId, reservationId } = params;
            const clientIdentity = client.identity;
            const currentTime = new Date().toISOString();
            const transactionId = Math.floor(Math.random() * 100000);
            const status = 'Accepted';

            const query = 'INSERT INTO mstarttransaction (clientIdentity, connectorId, idTag, meterStart, reservationId, timestamp, transactionId, status, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            connection.query(query, [clientIdentity, connectorId, idTag, meterStart, reservationId, timestamp, transactionId, status, currentTime], (error, results, fields) => {
                if (error) {
                    console.error('Error inserting data into MySQL:', error.stack);
                    return;
                }
                console.log('Data inserted into MySQL, ID:', results.insertId);
            });

            return {
                idTagInfo: {
                    status: status
                },
                transactionId: transactionId
            };
    });

    client.handle('StopTransaction', ({ params }) => {
        console.log(`Server got StopTransaction from ${client.identity}:`, params);

        const { transactionId, idTag, timestamp, meterStop, reason } = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();
        const status = 'Accepted';

        const query = 'INSERT INTO mstoptransaction (clientIdentity, transactionId, idTag, timestamp, meterStop, reason, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?)';
        connection.query(query, [clientIdentity, transactionId, idTag, timestamp, meterStop, reason, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });

        return {
            //status: status
        };
    });

    client.handle('MeterValues', ({ params }) => {
        console.log(`Server got MeterValues from ${client.identity}:`, params);

        const { connectorId, transactionId,  meterValue } = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();
        meterValue.forEach(value => {
            const { timestamp, sampledValue } = value;
    
            if (sampledValue) {
                sampledValue.forEach(sample => {
                    const { value, context, format, measurand, phase, unit, location } = sample;
    
                    const query = 'INSERT INTO mmetervalues (clientIdentity, connectorId, transactionId, value, context, format, measurand, phase, unit, location, timestamp, currentTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                    connection.query(query, [clientIdentity, connectorId, transactionId, value, context, format, measurand, phase, unit, location, timestamp, currentTime], (error, results, fields) => {
                        if (error) {
                            console.error('Error inserting data into MySQL:', error.stack);
                            return;
                        }
                        console.log('Meter value inserted into MySQL, ID:', results.insertId);
                    });
                });
            }

        });
        
        return {};
    });

    client.handle('DataTransfer', ({ params }) => {
            console.log(`Server got DataTransfer from ${client.identity}:`, params);

            const { vendorId, messageId, data } = params;
            const clientIdentity = client.identity;
            const currentTime = new Date().toISOString();

            const query = 'INSERT INTO mdatatransfer (clientIdentity, vendorId, messageId, data, currentTime) VALUES (?, ?, ?, ?, ?)';
            connection.query(query, [clientIdentity, vendorId, messageId, data, currentTime], (error, results, fields) => {
                if (error) {
                    console.error('Error inserting data into MySQL:', error.stack);
                    return;
                }
                console.log('Data inserted into MySQL, ID:', results.insertId);
        });

        return {};
    });

    client.handle('FirmwareStatusNotification', ({ params }) => {
        console.log(`Server got FirmwareStatusNotification from ${client.identity}:`, params);
    
        const { status } = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();

        const query = 'INSERT INTO mfirmwarestatusnotifications (clientIdentity, status, currentTime) VALUES (?, ?, ?)';
        connection.query(query, [clientIdentity, status, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });
    
        return {};
    });

    client.handle('DiagnosticsStatusNotification', ({ params }) => {
        console.log(`Server got DiagnosticsStatusNotification from ${client.identity}:`, params);
    
        const { status } = params;
        const clientIdentity = client.identity;
        const currentTime = new Date().toISOString();
    
        const query = 'INSERT INTO mdiagnosticsstatus (clientIdentity, status, currentTime) VALUES (?, ?, ?)';
        connection.query(query, [clientIdentity, status, currentTime], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data into MySQL:', error.stack);
                return;
            }
            console.log('Data inserted into MySQL, ID:', results.insertId);
        });
    
        return {};
    });

    client.handle(({method, params}) => {
        console.log(`Server got ${method} from ${client.identity}:`, params);
        throw createRPCError("NotImplemented");
    });

    
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
});

server.listen(3000);